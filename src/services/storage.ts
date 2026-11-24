import {
  AppSettings,
  ChatMessage,
  DESMOS_COLORS,
  ExpressionItem,
  SidebarItemType,
} from '../types';

const SETTINGS_KEY = 'desmos_calc_settings_v1';
const EXPRESSIONS_KEY = 'desmos_calc_expressions_v1';
const TITLE_KEY = 'desmos_calc_title_v1';
const CHAT_DISPLAY_NAME_KEY = 'desmos_chat_display_name_v1';
const CHAT_ROOM_KEY = 'desmos_chat_room_v1';
const CHAT_MESSAGES_CACHE_KEY = 'desmos_room_messages_2h_v1';

export const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

export const DEFAULT_SUPABASE_URL =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() || '';

export const DEFAULT_SUPABASE_ANON_KEY =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() || '';

export const DEFAULT_SYSTEM_PROMPT =
  'Return ONLY the final answer and at most 1–2 ultra-short steps. Do not include greetings, explanations, or filler text. Keep output as compact as possible.';

export const DEFAULT_DECOY_EQUATIONS = [
  'y = x^2 - 2x - 3',
  'y = 2x + 1',
  'y = \\sin(x)',
];

export const DEFAULT_SETTINGS: AppSettings = {
  provider: 'gemini',
  apiKey: '',
  model: 'gemini-2.5-flash',
  openaiBaseUrl: 'https://api.openai.com/v1',
  triggerMode: 'auto',
  prefixChar: '?',
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  decoyEquations: [...DEFAULT_DECOY_EQUATIONS],
  supabaseUrl: DEFAULT_SUPABASE_URL,
  supabaseAnonKey: DEFAULT_SUPABASE_ANON_KEY,
};

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      supabaseUrl: parsed.supabaseUrl?.trim() || DEFAULT_SUPABASE_URL,
      supabaseAnonKey: parsed.supabaseAnonKey?.trim() || DEFAULT_SUPABASE_ANON_KEY,
      decoyEquations:
        Array.isArray(parsed.decoyEquations) && parsed.decoyEquations.length > 0
          ? parsed.decoyEquations
          : [...DEFAULT_DECOY_EQUATIONS],
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage quota errors
  }
}

/**
 * Loads the user's saved display name from localStorage.
 * Defaults to '' so new users are required to enter their name before joining a room.
 */
export function loadChatSender(): string {
  try {
    const existing = localStorage.getItem(CHAT_DISPLAY_NAME_KEY);
    return existing ? existing.trim().slice(0, 24) : '';
  } catch {
    return '';
  }
}

export function saveChatSender(sender: string): void {
  try {
    const cleaned = sender.trim().slice(0, 24);
    if (cleaned) {
      localStorage.setItem(CHAT_DISPLAY_NAME_KEY, cleaned);
    }
  } catch {
    // Ignore
  }
}

export function loadSavedRoomCode(): string | null {
  try {
    const sender = loadChatSender();
    if (!sender) return null;
    const code = localStorage.getItem(CHAT_ROOM_KEY);
    return code && /^\d{4}$/.test(code) ? code : null;
  } catch {
    return null;
  }
}

export function saveRoomCode(code: string | null): void {
  try {
    if (code && /^\d{4}$/.test(code)) {
      localStorage.setItem(CHAT_ROOM_KEY, code);
    } else {
      localStorage.removeItem(CHAT_ROOM_KEY);
    }
  } catch {
    // Ignore
  }
}

/**
 * Prunes cached messages older than 2 hours and returns non-expired cached messages for `roomId`.
 */
export function loadRecentCachedRoomMessages(roomId: string): ChatMessage[] {
  try {
    const raw = localStorage.getItem(CHAT_MESSAGES_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ChatMessage[];
    if (!Array.isArray(parsed)) return [];

    const cutoffMs = Date.now() - TWO_HOURS_MS;
    const fresh = parsed.filter((m) => {
      const ts = new Date(m.created_at).getTime();
      return !Number.isNaN(ts) && ts >= cutoffMs;
    });

    if (fresh.length !== parsed.length) {
      localStorage.setItem(CHAT_MESSAGES_CACHE_KEY, JSON.stringify(fresh));
    }

    return fresh
      .filter((m) => m.room_id === roomId)
      .sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
  } catch {
    return [];
  }
}

export function cacheRoomMessages(messagesToMerge: ChatMessage[]): void {
  try {
    const raw = localStorage.getItem(CHAT_MESSAGES_CACHE_KEY);
    const existing: ChatMessage[] = raw ? (JSON.parse(raw) as ChatMessage[]) : [];
    const cutoffMs = Date.now() - TWO_HOURS_MS;

    const byId = new Map<string, ChatMessage>();
    for (const m of Array.isArray(existing) ? existing : []) {
      const ts = new Date(m.created_at).getTime();
      if (m?.id && !Number.isNaN(ts) && ts >= cutoffMs) {
        byId.set(m.id, m);
      }
    }
    for (const m of messagesToMerge) {
      const ts = new Date(m.created_at).getTime();
      if (m?.id && !Number.isNaN(ts) && ts >= cutoffMs) {
        byId.set(m.id, m);
      }
    }

    const merged = Array.from(byId.values())
      .sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      )
      .slice(-300);

    localStorage.setItem(CHAT_MESSAGES_CACHE_KEY, JSON.stringify(merged));
  } catch {
    // Ignore quota errors
  }
}

export function createSidebarItem(
  itemType: SidebarItemType = 'expression',
  index = 0,
  rawInput = '',
  extra?: Partial<ExpressionItem>
): ExpressionItem {
  const base: ExpressionItem = {
    id: `expr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    itemType,
    rawInput,
    color: DESMOS_COLORS[index % DESMOS_COLORS.length],
    hidden: false,
    isAiMode: false,
    ...extra,
  };

  if (itemType === 'table' && !base.tableRows) {
    base.tableSubscript = extra?.tableSubscript ?? 1;
    base.tableRows = [
      { x: '-2', y: '4' },
      { x: '-1', y: '1' },
      { x: '0', y: '0' },
      { x: '1', y: '1' },
      { x: '2', y: '4' },
      { x: '', y: '' },
    ];
  } else if (itemType === 'inference' && !rawInput) {
    base.rawInput = 'normaldist(0, 1)';
  } else if (itemType === 'folder') {
    base.folderCollapsed = false;
  } else if (itemType === 'image') {
    base.imageCenter = extra?.imageCenter ?? '(0, 0)';
    base.imageSize = extra?.imageSize ?? '10 × 10';
  }

  return base;
}

export function createBlankExpression(index = 0, rawInput = ''): ExpressionItem {
  return createSidebarItem('expression', index, rawInput);
}

export function loadExpressions(): ExpressionItem[] {
  try {
    const raw = localStorage.getItem(EXPRESSIONS_KEY);
    if (!raw) return [createBlankExpression(0)];
    const parsed = JSON.parse(raw) as ExpressionItem[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return [createBlankExpression(0)];
    }
    return parsed.map((item, i) => ({
      id: item.id || `expr-${i}-${Date.now()}`,
      itemType: item.itemType || 'expression',
      rawInput: item.rawInput ?? '',
      color: item.color || DESMOS_COLORS[i % DESMOS_COLORS.length],
      hidden: Boolean(item.hidden),
      isAiMode: Boolean(item.isAiMode),
      aiResponse: item.aiResponse,
      aiError: Boolean(item.aiError),
      aiLoading: false,
      tableRows: item.tableRows,
      tableSubscript: item.tableSubscript,
      folderCollapsed: item.folderCollapsed,
      imageDataUrl: item.imageDataUrl,
      imageCenter: item.imageCenter,
      imageSize: item.imageSize,
    }));
  } catch {
    return [createBlankExpression(0)];
  }
}

export function saveExpressions(items: ExpressionItem[]): void {
  try {
    const clean = items.map(({ aiLoading: _loading, ...rest }) => rest);
    localStorage.setItem(EXPRESSIONS_KEY, JSON.stringify(clean));
  } catch {
    // Ignore quota errors
  }
}

export function loadGraphTitle(): string {
  try {
    return localStorage.getItem(TITLE_KEY) || 'Untitled Graph';
  } catch {
    return 'Untitled Graph';
  }
}

export function saveGraphTitle(title: string): void {
  try {
    localStorage.setItem(TITLE_KEY, title.trim() || 'Untitled Graph');
  } catch {
    // Ignore
  }
}
