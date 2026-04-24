import http from './http';
import type { ApiResponse } from '../types/common';
import { getToken } from '../utils/storage';

export interface AIChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIModelEntry {
  display_name: string;
  model: string;
}

export interface AIPublicConfig {
  model: string;
  models: AIModelEntry[];
  configured: boolean;
  reasoning_enabled: boolean;
}

export interface AIFullConfig {
  base_url: string;
  model: string;
  models: AIModelEntry[];
  temperature: number;
  max_tokens: number;
  reasoning_enabled: boolean;
  system_prompt: string;
  system_prompt_admin: string;
  system_prompt_doctor: string;
  system_prompt_elder: string;
  system_prompt_family: string;
  api_key_masked: string;
  has_api_key: boolean;
}

export interface AIConfigUpdate {
  base_url?: string;
  api_key?: string;
  model?: string;
  models?: AIModelEntry[];
  temperature?: number;
  max_tokens?: number;
  reasoning_enabled?: boolean;
  system_prompt?: string;
  system_prompt_admin?: string;
  system_prompt_doctor?: string;
  system_prompt_elder?: string;
  system_prompt_family?: string;
}

export interface AITestPayload {
  base_url?: string;
  api_key?: string;
  model?: string;
}

export function getPublicConfig(): Promise<ApiResponse<AIPublicConfig>> {
  return http.get('/ai/public-config');
}

export function getAIConfig(): Promise<ApiResponse<AIFullConfig>> {
  return http.get('/ai/config');
}

export function updateAIConfig(
  payload: AIConfigUpdate,
): Promise<ApiResponse<AIFullConfig>> {
  return http.put('/ai/config', payload);
}

export function testAIConfig(
  payload: AITestPayload,
): Promise<ApiResponse<{ ok: boolean; model: string; reply: string }>> {
  return http.post('/ai/config/test', payload);
}

/** Chat-stream delta object emitted on each SSE `data:` line. */
export interface ChatDelta {
  content?: string;
  reasoning?: string;
  finish_reason?: string;
}

export interface ChatStreamHandlers {
  onDelta: (delta: ChatDelta) => void;
  onDone?: () => void;
  onError?: (message: string) => void;
  signal?: AbortSignal;
}

/**
 * Stream the assistant's reply via `fetch` (the axios client doesn't
 * expose a ReadableStream). Parses OpenAI-style `data: {...}` SSE lines
 * and forwards deltas to the caller.
 */
export async function streamChat(
  messages: AIChatMessage[],
  model: string | undefined,
  handlers: ChatStreamHandlers,
): Promise<void> {
  const token = getToken();
  const res = await fetch('/api/v1/ai/chat/stream', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : '',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify({ messages, model }),
    signal: handlers.signal,
  });

  if (!res.ok || !res.body) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      msg = j.message || j.detail || msg;
    } catch {
      /* noop */
    }
    handlers.onError?.(msg);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buf = '';
  let currentEvent = 'message';

  const flushEvent = (event: string, data: string) => {
    if (event === 'done') {
      handlers.onDone?.();
      return;
    }
    if (event === 'error') {
      try {
        const parsed = JSON.parse(data);
        handlers.onError?.(parsed.message || '流式错误');
      } catch {
        handlers.onError?.(data || '流式错误');
      }
      return;
    }
    if (!data) return;
    try {
      const parsed = JSON.parse(data) as ChatDelta;
      handlers.onDelta(parsed);
    } catch {
      /* ignore malformed chunks */
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    // SSE events are separated by a blank line.
    let idx: number;
    while ((idx = buf.indexOf('\n\n')) !== -1) {
      const raw = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      currentEvent = 'message';
      let data = '';
      for (const line of raw.split('\n')) {
        if (line.startsWith('event:')) currentEvent = line.slice(6).trim();
        else if (line.startsWith('data:')) data += line.slice(5).trim();
      }
      flushEvent(currentEvent, data);
    }
  }
  if (buf.trim()) {
    // Trailing non-terminated event.
    let data = '';
    for (const line of buf.split('\n')) {
      if (line.startsWith('event:')) currentEvent = line.slice(6).trim();
      else if (line.startsWith('data:')) data += line.slice(5).trim();
    }
    if (data) flushEvent(currentEvent, data);
  }
}
