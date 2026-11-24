import { createClient, RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { ChatMessage } from '../types';
import {
  cacheRoomMessages,
  DEFAULT_SUPABASE_ANON_KEY,
  DEFAULT_SUPABASE_URL,
  loadRecentCachedRoomMessages,
  TWO_HOURS_MS,
} from './storage';

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
  sendMessage: (senderName: string, content: string) => Promise<ChatMessage | null>;
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
    roomCode: roomId,
    supabaseUrl,
    supabaseAnonKey,
    onHistoryLoaded,
    onNewRealtimeMessage,
    onConnectionChange,
  } = options;

  const seenIds = new Set<string>();
  let isDisposed = false;

  // Hydrate immediately with any non-expired (< 2 hours) locally cached messages for instant UX
  const initialLocal = loadRecentCachedRoomMessages(roomId);
  for (const m of initialLocal) {
    seenIds.add(m.id);
  }
  if (initialLocal.length > 0) {
    onHistoryLoaded(initialLocal);
  }

  const client = getSupabaseClient(supabaseUrl, supabaseAnonKey);
  if (!client) {
    if (initialLocal.length === 0) onHistoryLoaded([]);
    return {
      sendMessage: async (senderName: string, content: string) => {
        const trimmed = content.trim();
        if (!trimmed || isDisposed) return null;
        const msg: ChatMessage = {
          id:
            typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
              ? crypto.randomUUID()
              : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
          room_id: roomId,
          sender_name: senderName.trim() || 'Guest',
          content: trimmed,
          created_at: new Date().toISOString(),
        };
        seenIds.add(msg.id);
        cacheRoomMessages([msg]);
        onNewRealtimeMessage(msg, false);
        return msg;
      },
      unsubscribe: () => {
        isDisposed = true;
      },
    };
  }

  // 1. Purge expired rows (> 2 hours old) and fetch active messages (< 2 hours old) ordered ASC
  void (async () => {
    const cutoffIso = new Date(Date.now() - TWO_HOURS_MS).toISOString();

    try {
      // Delete expired messages older than 2 hours
      await client.from('room_messages').delete().lt('created_at', cutoffIso);
    } catch {
      // Ignore cleanup permission errors if DELETE policy is not enabled
    }

    if (isDisposed) return;

    try {
      const { data, error } = await client
        .from('room_messages')
        .select('id, room_id, sender_name, content, created_at')
        .eq('room_id', roomId)
        .gte('created_at', cutoffIso)
        .order('created_at', { ascending: true });

      if (isDisposed) return;

      if (!error && Array.isArray(data)) {
        const rows: ChatMessage[] = [];
        for (const raw of data) {
          const item = raw as ChatMessage;
          if (item?.id && item.content) {
            seenIds.add(item.id);
            rows.push({
              id: item.id,
              room_id: String(item.room_id ?? roomId),
              sender_name: item.sender_name || 'Guest',
              content: item.content,
              created_at: item.created_at || new Date().toISOString(),
            });
          }
        }
        cacheRoomMessages(rows);
        onHistoryLoaded(rows);
      } else if (initialLocal.length === 0) {
        onHistoryLoaded([]);
      }
    } catch {
      if (!isDisposed && initialLocal.length === 0) {
        onHistoryLoaded([]);
      }
    }
  })();

  // 2. Subscribe to Supabase Realtime postgres_changes INSERT events on `room_messages` filtered by `room_id`
  // (plus Broadcast fallback deduplicated via `seenIds` so live messages never duplicate)
  const channel: RealtimeChannel = client.channel(`desmos-room-${roomId}`, {
    config: {
      broadcast: { self: false },
    },
  });

  const handleIncoming = (incoming: Partial<ChatMessage> | undefined) => {
    if (isDisposed || !incoming?.id || !incoming.content) return;
    if (incoming.room_id && String(incoming.room_id) !== roomId) return;
    if (seenIds.has(incoming.id)) return;

    // Ignore if older than 2 hours
    if (incoming.created_at) {
      const ts = new Date(incoming.created_at).getTime();
      if (!Number.isNaN(ts) && ts < Date.now() - TWO_HOURS_MS) {
        return;
      }
    }

    seenIds.add(incoming.id);
    const normalized: ChatMessage = {
      id: incoming.id,
      room_id: String(incoming.room_id || roomId),
      sender_name: incoming.sender_name || 'Guest',
      content: incoming.content,
      created_at: incoming.created_at || new Date().toISOString(),
    };
    cacheRoomMessages([normalized]);
    onNewRealtimeMessage(normalized, true);
  };

  channel
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'room_messages',
        filter: `room_id=eq.${roomId}`,
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
    senderName: string,
    content: string
  ): Promise<ChatMessage | null> => {
    const trimmed = content.trim();
    if (!trimmed || isDisposed) return null;

    const msg: ChatMessage = {
      id:
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      room_id: roomId,
      sender_name: senderName.trim() || 'Guest',
      content: trimmed,
      created_at: new Date().toISOString(),
    };

    seenIds.add(msg.id);
    cacheRoomMessages([msg]);
    onNewRealtimeMessage(msg, false);

    void channel.send({
      type: 'broadcast',
      event: 'new_message',
      payload: msg,
    });

    await client.from('room_messages').insert({
      id: msg.id,
      room_id: msg.room_id,
      sender_name: msg.sender_name,
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
