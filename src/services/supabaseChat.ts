import { createClient, RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { ChatMessage } from '../types';
import { DEFAULT_SUPABASE_ANON_KEY, DEFAULT_SUPABASE_URL } from './storage';

let cachedClient: SupabaseClient | null = null;
let cachedKeySig = '';

export function getSupabaseClient(
  customUrl?: string,
  customAnonKey?: string
): SupabaseClient | null {
  const url = (customUrl?.trim() || DEFAULT_SUPABASE_URL).replace(/\/+$/, '');
  const key = customAnonKey?.trim() || DEFAULT_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  const sig = `${url}::${key}`;
  if (cachedClient && cachedKeySig === sig) {
    return cachedClient;
  }

  cachedClient = createClient(url, key, {
    auth: { persistSession: false },
    realtime: { params: { eventsPerSecond: 20 } },
  });
  cachedKeySig = sig;
  return cachedClient;
}

export interface RoomSubscriptionHandle {
  sendMessage: (sender: string, content: string) => Promise<ChatMessage | null>;
  unsubscribe: () => void;
}

export function connectToChatRoom(options: {
  roomCode: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  onHistoryLoaded: (messages: ChatMessage[]) => void;
  onNewRealtimeMessage: (message: ChatMessage, isRemote: boolean) => void;
  onConnectionChange?: (connected: boolean) => void;
}): RoomSubscriptionHandle {
  const {
    roomCode,
    supabaseUrl,
    supabaseAnonKey,
    onHistoryLoaded,
    onNewRealtimeMessage,
    onConnectionChange,
  } = options;

  const client = getSupabaseClient(supabaseUrl, supabaseAnonKey);
  if (!client) {
    onHistoryLoaded([]);
    return {
      sendMessage: async () => null,
      unsubscribe: () => {},
    };
  }

  const seenIds = new Set<string>();
  let isDisposed = false;

  // 1. Load existing room history from `messages` table
  void (async () => {
    try {
      const { data, error } = await client
        .from('messages')
        .select('id, room_code, sender, content, created_at')
        .eq('room_code', roomCode)
        .order('created_at', { ascending: true })
        .limit(100);

      if (isDisposed) return;
      if (!error && Array.isArray(data)) {
        const rows: ChatMessage[] = [];
        for (const raw of data) {
          const msg = raw as ChatMessage;
          if (msg?.id && !seenIds.has(msg.id)) {
            seenIds.add(msg.id);
            rows.push(msg);
          }
        }
        onHistoryLoaded(rows);
      } else {
        onHistoryLoaded([]);
      }
    } catch {
      if (!isDisposed) onHistoryLoaded([]);
    }
  })();

  // 2. Subscribe to real-time INSERT events on `messages` filtered by room_code,
  // plus Realtime Broadcast on the same channel so cross-device sync works instantaneously
  // even if table replication/RLS is still being configured.
  const channel: RealtimeChannel = client.channel(`desmos-room-${roomCode}`, {
    config: {
      broadcast: { self: false },
    },
  });

  const handleIncoming = (incoming: Partial<ChatMessage> | undefined) => {
    if (isDisposed || !incoming?.id || !incoming.content) return;
    if (incoming.room_code && incoming.room_code !== roomCode) return;
    if (seenIds.has(incoming.id)) return;

    seenIds.add(incoming.id);
    const normalized: ChatMessage = {
      id: incoming.id,
      room_code: incoming.room_code || roomCode,
      sender: incoming.sender || 'User',
      content: incoming.content,
      created_at: incoming.created_at || new Date().toISOString(),
    };
    onNewRealtimeMessage(normalized, true);
  };

  channel
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `room_code=eq.${roomCode}`,
      },
      (payload) => {
        handleIncoming(payload.new as Partial<ChatMessage>);
      }
    )
    .on('broadcast', { event: 'new_message' }, (payload) => {
      handleIncoming(payload.payload as Partial<ChatMessage>);
    })
    .subscribe((status) => {
      if (isDisposed) return;
      onConnectionChange?.(status === 'SUBSCRIBED');
    });

  const sendMessage = async (
    sender: string,
    content: string
  ): Promise<ChatMessage | null> => {
    const trimmed = content.trim();
    if (!trimmed || isDisposed) return null;

    const msg: ChatMessage = {
      id:
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      room_code: roomCode,
      sender: sender.trim() || 'User',
      content: trimmed,
      created_at: new Date().toISOString(),
    };

    seenIds.add(msg.id);
    onNewRealtimeMessage(msg, false);

    // Broadcast immediately to connected room peers
    void channel.send({
      type: 'broadcast',
      event: 'new_message',
      payload: msg,
    });

    // Persist into Supabase `messages` table
    void client.from('messages').insert({
      id: msg.id,
      room_code: msg.room_code,
      sender: msg.sender,
      content: msg.content,
      created_at: msg.created_at,
    });

    return msg;
  };

  const unsubscribe = () => {
    isDisposed = true;
    void client.removeChannel(channel);
  };

  return {
    sendMessage,
    unsubscribe,
  };
}
