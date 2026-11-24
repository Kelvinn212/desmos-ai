export const DESMOS_COLORS = [
  '#c74440', // Red
  '#2d70b3', // Blue
  '#388c46', // Green
  '#6042a6', // Purple
  '#fa7e19', // Orange
  '#000000', // Black
] as const;

export type DesmosColor = (typeof DESMOS_COLORS)[number];

export type AiProvider = 'gemini' | 'openai';
export type AiTriggerMode = 'auto' | 'prefix';
export type PopoverViewMode = 'image' | 'chat' | 'ai';
export type SidebarItemType =
  | 'expression'
  | 'note'
  | 'table'
  | 'inference'
  | 'folder'
  | 'image';

export interface AiChatTurn {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isError?: boolean;
}

export interface ChatMessage {
  id: string;
  room_code: string;
  sender: string;
  content: string;
  created_at: string;
}

export interface TableRowPoint {
  x: string;
  y: string;
}

export interface ExpressionItem {
  id: string;
  itemType?: SidebarItemType;
  rawInput: string;
  color: string;
  hidden: boolean;
  isAiMode: boolean;
  aiResponse?: string;
  aiError?: boolean;
  aiLoading?: boolean;
  // Optional item-type specific fields
  tableRows?: TableRowPoint[];
  tableSubscript?: number;
  folderCollapsed?: boolean;
  imageDataUrl?: string;
  imageCenter?: string;
  imageSize?: string;
}

export interface DesmosEvaluation {
  isGraphable: boolean;
  isError: boolean;
  errorMessage?: string;
  numericValue?: number;
  listValue?: number[];
}

export interface AppSettings {
  provider: AiProvider;
  apiKey: string;
  model: string;
  openaiBaseUrl: string;
  triggerMode: AiTriggerMode;
  prefixChar: string;
  systemPrompt: string;
  decoyEquations: string[];
  supabaseUrl: string;
  supabaseAnonKey: string;
}

export interface StoredImage {
  id: string;
  name: string;
  mimeType: string;
  blob: Blob;
  createdAt: number;
}

export interface MathBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface DesmosTableColumnSpec {
  latex: string;
  values: string[];
  color?: string;
  hidden?: boolean;
}

export interface DesmosExpressionSpec {
  id: string;
  type?: 'expression' | 'table';
  latex?: string;
  color?: string;
  hidden?: boolean;
  columns?: DesmosTableColumnSpec[];
}

export interface DesmosHelperExpression {
  numericValue: number;
  listValue?: number[];
  observe: (eventName: string, callback: () => void) => void;
  unobserve: (eventName: string) => void;
}

export interface DesmosAnalysisEntry {
  isGraphable: boolean;
  isError: boolean;
  errorMessage?: string;
  evaluationDisplayed?: boolean;
  evaluation?: {
    type?: string;
    value?: number | number[];
  };
}

export interface DesmosCalculatorInstance {
  setExpression: (spec: DesmosExpressionSpec) => void;
  setExpressions: (specs: DesmosExpressionSpec[]) => void;
  removeExpression: (spec: { id: string }) => void;
  removeExpressions: (specs: Array<{ id: string }>) => void;
  getExpressions: () => Array<{ id: string; latex?: string }>;
  setMathBounds: (bounds: MathBounds) => void;
  graphpaperBounds: {
    mathCoordinates: MathBounds;
  };
  getState: () => unknown;
  setState: (state: unknown, options?: { allowUndo?: boolean }) => void;
  setBlank: (options?: { allowUndo?: boolean }) => void;
  resize: () => void;
  destroy: () => void;
  HelperExpression: (spec: { latex: string }) => DesmosHelperExpression;
  expressionAnalysis: Record<string, DesmosAnalysisEntry>;
  observe: (eventName: string, callback: () => void) => void;
  unobserve: (eventName: string) => void;
}

declare global {
  interface Window {
    Desmos?: {
      GraphingCalculator: (
        element: HTMLElement,
        options?: Record<string, unknown>
      ) => DesmosCalculatorInstance;
      Colors?: Record<string, string>;
      Styles?: Record<string, string>;
    };
  }
}
