import { AiChatTurn, AppSettings } from '../types';
import { DEFAULT_SYSTEM_PROMPT } from './storage';

const EMPTY_RESPONSE_FALLBACK =
  'Empty response (try increasing max_tokens or switching model)';

export const DETAILED_AI_CHAT_SYSTEM_PROMPT =
  'You are a clear, rigorous math and academic tutor inside a graphing calculator. Provide well-structured, step-by-step solutions and explanations for open-ended math, SAT, calculus, algebra, or academic questions. Show key intermediate steps clearly, wrap mathematical expressions in LaTeX delimiters ($...$ for inline math, $$...$$ for standalone equations), and state the final answer clearly at the end. Use conversation context to answer follow-up questions naturally.';

function stripThinkBlocks(raw: string): string {
  return raw
    .replace(/<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>/gi, '')
    .replace(/<think(?:ing)?>[\s\S]*$/gi, '')
    .trim();
}

function cleanStealthOutput(raw: string): string {
  const lines = stripThinkBlocks(raw)
    .replace(/```[\w-]*\n?/g, '')
    .replace(/```/g, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .split('\n')
    .map((line) => line.trim())
    .filter(
      (line) =>
        line.length > 0 &&
        line.toLowerCase() !== 'undefined' &&
        line.toLowerCase() !== 'null'
    );

  if (lines.length === 0) return '';
  if (lines.length <= 6) return lines.join('\n').trim();
  // Preserve final answer lines if response is longer than 6 lines
  return [...lines.slice(0, 2), ...lines.slice(-3)].join('\n').trim();
}

function extractConciseFallbackFromReasoning(reasoningText: string): string {
  if (!reasoningText) return '';
  // Extract explicit \boxed{...} final answer if present
  const boxedMatches = [
    ...reasoningText.matchAll(/\\boxed\{([^{}]+(?:\{[^{}]*\}[^{}]*)*)\}/g),
  ];
  if (boxedMatches.length > 0) {
    const lastBoxed = boxedMatches[boxedMatches.length - 1][1]?.trim();
    if (lastBoxed && lastBoxed.toLowerCase() !== 'undefined') {
      return lastBoxed;
    }
  }
  return '';
}

function extractErrorMessage(bodyText: string, status: number): string {
  const trimmed = bodyText.trim();
  if (!trimmed) {
    return `HTTP ${status}`;
  }
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const first = parsed[0] as { error?: { message?: string }; message?: string };
      if (typeof first?.error?.message === 'string' && first.error.message.trim()) {
        return first.error.message.trim();
      }
      if (typeof first?.message === 'string' && first.message.trim()) {
        return first.message.trim();
      }
    } else if (parsed && typeof parsed === 'object') {
      const obj = parsed as {
        error?: { message?: string } | string;
        message?: string;
      };
      if (typeof obj.error === 'object' && obj.error !== null) {
        if (typeof obj.error.message === 'string' && obj.error.message.trim()) {
          return obj.error.message.trim();
        }
      } else if (typeof obj.error === 'string' && obj.error.trim()) {
        return obj.error.trim();
      }
      if (typeof obj.message === 'string' && obj.message.trim()) {
        return obj.message.trim();
      }
    }
  } catch {
    // Fall back to raw response text if not JSON
  }
  return trimmed;
}

export interface InlineAiResult {
  text: string;
  isError: boolean;
}

interface OpenAiContentPart {
  type?: string;
  text?: string;
  content?: string;
}

interface OpenAiChoiceMessage {
  content?: string | null | OpenAiContentPart[];
  reasoning?: string | null;
  reasoning_content?: string | null;
}

export async function queryInlineAi(
  prompt: string,
  settings: AppSettings,
  signal?: AbortSignal
): Promise<InlineAiResult> {
  const apiKey = settings.apiKey.trim();
  if (!apiKey) {
    return {
      text: 'API key unset (triple-click desmos logo to configure)',
      isError: true,
    };
  }

  const systemPrompt = (settings.systemPrompt || DEFAULT_SYSTEM_PROMPT).trim();

  if (settings.provider === 'gemini') {
    const cleanModel =
      (settings.model.trim() || 'gemini-2.5-flash')
        .replace(/^models\//i, '')
        .trim() || 'gemini-2.5-flash';

    const url = apiKey.startsWith('AQ.')
      ? `https://aiplatform.googleapis.com/v1/publishers/google/models/${cleanModel}:generateContent?key=${encodeURIComponent(
          apiKey
        )}`
      : `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:generateContent?key=${encodeURIComponent(
          apiKey
        )}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 4096,
        },
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      return {
        text: extractErrorMessage(errBody, res.status),
        isError: true,
      };
    }

    const data = (await res.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string; thought?: boolean }> };
      }>;
    };

    const parts = data.candidates?.[0]?.content?.parts || [];
    const visibleText = parts
      .filter((p) => !p.thought && typeof p.text === 'string')
      .map((p) => p.text)
      .join('\n')
      .trim();

    const cleaned = cleanStealthOutput(visibleText);
    if (cleaned) {
      return { text: cleaned, isError: false };
    }

    const thoughtText = parts
      .filter((p) => p.thought && typeof p.text === 'string')
      .map((p) => p.text)
      .join('\n');
    const fallback = extractConciseFallbackFromReasoning(thoughtText);
    if (fallback) {
      return { text: fallback, isError: false };
    }

    return {
      text: EMPTY_RESPONSE_FALLBACK,
      isError: true,
    };
  }

  // OpenAI-compatible provider (OpenAI, Groq, OpenRouter, etc.)
  const baseUrl = (settings.openaiBaseUrl.trim() || 'https://api.openai.com/v1').replace(
    /\/+$/,
    ''
  );
  const cleanModel =
    (settings.model.trim() || 'gpt-4o-mini').replace(/^models\//i, '').trim() ||
    'gpt-4o-mini';

  const normalizedLower = cleanModel.toLowerCase();
  const isGptOss120b =
    normalizedLower === 'openai/gpt-oss-120b' ||
    normalizedLower === 'gpt-oss-120b' ||
    normalizedLower.endsWith('/gpt-oss-120b');

  const requestBody: Record<string, unknown> = {
    model: cleanModel,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
    ],
    temperature: 0.1,
    max_tokens: 4096,
  };

  if (isGptOss120b) {
    requestBody.reasoning_effort = 'high';
  }

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    signal,
    body: JSON.stringify(requestBody),
  });

  if (!res.ok) {
    const errBody = await res.text();
    return {
      text: extractErrorMessage(errBody, res.status),
      isError: true,
    };
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: OpenAiChoiceMessage }>;
  };

  const message = data?.choices?.[0]?.message;
  let rawContent = '';
  if (typeof message?.content === 'string') {
    rawContent = message.content;
  } else if (Array.isArray(message?.content)) {
    rawContent = message.content
      .filter((part) => part?.type !== 'thinking' && part?.type !== 'reasoning')
      .map((part) => part?.text ?? part?.content ?? '')
      .join('\n');
  }

  const cleaned = cleanStealthOutput(rawContent);
  if (cleaned) {
    return {
      text: cleaned,
      isError: false,
    };
  }

  // Fallback: check reasoning / reasoning_content / <think> blocks for an explicit \boxed{...} answer
  const reasoningBlob = [
    typeof message?.reasoning === 'string' ? message.reasoning : '',
    typeof message?.reasoning_content === 'string' ? message.reasoning_content : '',
    rawContent,
  ]
    .filter(Boolean)
    .join('\n');

  const fallbackExtract = extractConciseFallbackFromReasoning(reasoningBlob);
  if (fallbackExtract) {
    return {
      text: fallbackExtract,
      isError: false,
    };
  }

  return {
    text: EMPTY_RESPONSE_FALLBACK,
    isError: true,
  };
}

/**
 * Multi-turn step-by-step AI Chat solver for the dedicated AI Chat View inside WrenchImagePopover.
 * Uses the exact same API key, provider, base URL, and model configured in AppSettings.
 */
export async function queryDetailedAiChat(
  turns: AiChatTurn[],
  settings: AppSettings,
  signal?: AbortSignal
): Promise<InlineAiResult> {
  const apiKey = settings.apiKey.trim();
  if (!apiKey) {
    return {
      text: 'API key unset (triple-click the desmos logo in the top bar to configure).',
      isError: true,
    };
  }

  const validTurns = turns.filter((t) => !t.isError && t.content.trim().length > 0);
  if (validTurns.length === 0) {
    return { text: EMPTY_RESPONSE_FALLBACK, isError: true };
  }

  if (settings.provider === 'gemini') {
    const cleanModel =
      (settings.model.trim() || 'gemini-2.5-flash')
        .replace(/^models\//i, '')
        .trim() || 'gemini-2.5-flash';

    const url = apiKey.startsWith('AQ.')
      ? `https://aiplatform.googleapis.com/v1/publishers/google/models/${cleanModel}:generateContent?key=${encodeURIComponent(
          apiKey
        )}`
      : `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:generateContent?key=${encodeURIComponent(
          apiKey
        )}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: DETAILED_AI_CHAT_SYSTEM_PROMPT }],
        },
        contents: validTurns.map((t) => ({
          role: t.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: t.content }],
        })),
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 4096,
        },
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      return {
        text: extractErrorMessage(errBody, res.status),
        isError: true,
      };
    }

    const data = (await res.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string; thought?: boolean }> };
      }>;
    };

    const parts = data.candidates?.[0]?.content?.parts || [];
    const visibleText = stripThinkBlocks(
      parts
        .filter((p) => !p.thought && typeof p.text === 'string')
        .map((p) => p.text)
        .join('\n')
    );

    if (visibleText) {
      return { text: visibleText, isError: false };
    }

    return { text: EMPTY_RESPONSE_FALLBACK, isError: true };
  }

  // OpenAI-compatible provider (Groq, OpenRouter, OpenAI, etc.)
  const baseUrl = (settings.openaiBaseUrl.trim() || 'https://api.openai.com/v1').replace(
    /\/+$/,
    ''
  );
  const cleanModel =
    (settings.model.trim() || 'gpt-4o-mini').replace(/^models\//i, '').trim() ||
    'gpt-4o-mini';

  const normalizedLower = cleanModel.toLowerCase();
  const isGptOss120b =
    normalizedLower === 'openai/gpt-oss-120b' ||
    normalizedLower === 'gpt-oss-120b' ||
    normalizedLower.endsWith('/gpt-oss-120b');

  const requestBody: Record<string, unknown> = {
    model: cleanModel,
    messages: [
      { role: 'system', content: DETAILED_AI_CHAT_SYSTEM_PROMPT },
      ...validTurns.map((t) => ({
        role: t.role,
        content: t.content,
      })),
    ],
    temperature: 0.2,
    max_tokens: 4096,
  };

  if (isGptOss120b) {
    requestBody.reasoning_effort = 'high';
  }

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    signal,
    body: JSON.stringify(requestBody),
  });

  if (!res.ok) {
    const errBody = await res.text();
    return {
      text: extractErrorMessage(errBody, res.status),
      isError: true,
    };
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: OpenAiChoiceMessage }>;
  };

  const message = data?.choices?.[0]?.message;
  let rawContent = '';
  if (typeof message?.content === 'string') {
    rawContent = message.content;
  } else if (Array.isArray(message?.content)) {
    rawContent = message.content
      .filter((part) => part?.type !== 'thinking' && part?.type !== 'reasoning')
      .map((part) => part?.text ?? part?.content ?? '')
      .join('\n');
  }

  const cleaned = stripThinkBlocks(rawContent);
  if (cleaned && cleaned.toLowerCase() !== 'undefined' && cleaned.toLowerCase() !== 'null') {
    return { text: cleaned, isError: false };
  }

  const reasoningBlob = [
    typeof message?.reasoning === 'string' ? message.reasoning : '',
    typeof message?.reasoning_content === 'string' ? message.reasoning_content : '',
    rawContent,
  ]
    .filter(Boolean)
    .join('\n');

  const fallbackExtract = extractConciseFallbackFromReasoning(reasoningBlob);
  if (fallbackExtract) {
    return { text: fallbackExtract, isError: false };
  }

  return {
    text: EMPTY_RESPONSE_FALLBACK,
    isError: true,
  };
}
