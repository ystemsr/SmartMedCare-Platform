import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuthStore, getHomeRoute } from '../../store/auth';
import {
  getPublicConfig,
  streamChat,
  type AIChatMessage,
  type AIModelEntry,
} from '../../api/ai';
import ThinkingBubble from './ThinkingBubble';
import MarkdownStream from './MarkdownStream';
import './AIChatPage.css';

/* =========================================================================
 * Types
 * ======================================================================= */

interface UIMsg {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  reasoning?: string;
  /** Assistant message streaming-in-progress flag. */
  pending?: boolean;
  /** Reasoning/thinking state. */
  thinkingComplete?: boolean;
  thinkingStopped?: boolean;
  thinkingDuration?: number | null;
  errored?: boolean;
}

interface Conversation {
  id: string;
  title: string;
  messages: UIMsg[];
  updatedAt: number;
}

const STORAGE_KEY = 'smc.ai.conversations.v1';
const COLLAPSE_KEY = 'smc.ai.side.collapsed';
const MODEL_KEY = 'smc.ai.model.selected';

/* =========================================================================
 * Utilities
 * ======================================================================= */

function loadConversations(): Conversation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Conversation[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveConversations(list: Conversation[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, 50)));
  } catch {
    /* quota ignored */
  }
}

function titleFrom(text: string): string {
  const t = (text || '').trim().replace(/\s+/g, ' ');
  return Array.from(t).slice(0, 12).join('') || '新对话';
}

function greetingText(name: string): string {
  const h = new Date().getHours();
  let g = '你好';
  if (h >= 5 && h < 9) g = '早上好';
  else if (h >= 9 && h < 11) g = '上午好';
  else if (h >= 11 && h < 13) g = '中午好';
  else if (h >= 13 && h < 18) g = '下午好';
  else g = '晚上好';
  return `${g}，${name}`;
}

function makeId(prefix = 'c'): string {
  return `${prefix}${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)
    .toString(36)}`;
}

/** RFC 4122 v4 UUID. Falls back to a manual impl where the browser
 * doesn't expose `crypto.randomUUID` (e.g. over insecure origins). */
function makeUuid(): string {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID();
  }
  const rand = () => Math.random().toString(16).slice(2).padStart(8, '0');
  return `${rand().slice(0, 8)}-${rand().slice(0, 4)}-4${rand().slice(0, 3)}-${(
    (Math.random() * 4) | (0 + 8)
  ).toString(16)}${rand().slice(0, 3)}-${rand()}${rand().slice(0, 4)}`;
}

function useAutosize(ref: React.RefObject<HTMLTextAreaElement | null>, value: string) {
  useEffect(() => {
    const ta = ref.current;
    if (!ta) return;
    const MAX = 220;
    ta.style.height = 'auto';
    const h = Math.min(ta.scrollHeight, MAX);
    ta.style.height = `${h}px`;
    ta.style.overflowY = ta.scrollHeight > MAX ? 'auto' : 'hidden';
  }, [ref, value]);
}

/* =========================================================================
 * Icons — inline SVGs copied verbatim from the example
 * ======================================================================= */

const IcoSidebar = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M9 4v16" />
  </svg>
);
const IcoPlus = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5v14M5 12h14" />
  </svg>
);
const IcoPlusSm = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5v14M5 12h14" />
  </svg>
);
const IcoGlobe = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
    <path d="M2 12h20" />
  </svg>
);
const IcoKb = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6a2 2 0 0 0-2-2h-5.5L11 2.5A2 2 0 0 0 9.6 2H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h5" />
    <path d="m13.6 13.4 1.4 1.4" />
    <circle cx="17" cy="17" r="3" />
    <path d="m9.5 14.5-2 2 2 2" />
    <path d="m14.5 14.5 2 2-2 2" />
  </svg>
);
const IcoCaretDown = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m6 9 6 6 6-6" />
  </svg>
);
const IcoArrowUp = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 19V5" />
    <path d="m5 12 7-7 7 7" />
  </svg>
);
const IcoStop = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
    <rect x="6" y="6" width="12" height="12" rx="2" />
  </svg>
);
const IcoTrash = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18" />
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
  </svg>
);
const IcoBack = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="m15 18-6-6 6-6" />
  </svg>
);

/* chip icons */
const IcoPencil = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
  </svg>
);
const IcoCap = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 10 12 5 2 10l10 5 10-5z" />
    <path d="M6 12v5c3 2 9 2 12 0v-5" />
  </svg>
);
const IcoCode = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="m8 6-6 6 6 6" />
    <path d="m16 6 6 6-6 6" />
  </svg>
);
const IcoBag = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8a2 2 0 0 1 2 2v9H4v-9a2 2 0 0 1 2-2" />
    <path d="M8 8V6a4 4 0 1 1 8 0v2" />
  </svg>
);
const IcoBulb = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 18h6" />
    <path d="M10 22h4" />
    <path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1V17h6v-.2c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2Z" />
  </svg>
);

/* =========================================================================
 * Component
 * ======================================================================= */

const PRESET_CHIPS = [
  { label: '写作', prompt: '帮我起草一份', icon: <IcoPencil /> },
  { label: '学习', prompt: '帮我学习', icon: <IcoCap /> },
  { label: '代码', prompt: '我遇到一个代码问题：', icon: <IcoCode /> },
  { label: '生活', prompt: '推荐一些', icon: <IcoBag /> },
  { label: '灵感推荐', prompt: '今天最适合做什么？', icon: <IcoBulb /> },
];

const AIChatPage: React.FC = () => {
  const navigate = useNavigate();
  const { id: routeId } = useParams<{ id?: string }>();
  const user = useAuthStore((s) => s.user);
  const displayName =
    user?.real_name || user?.username || '朋友';

  const [sideCollapsed, setSideCollapsed] = useState<boolean>(
    () => localStorage.getItem(COLLAPSE_KEY) === '1',
  );
  useEffect(() => {
    localStorage.setItem(COLLAPSE_KEY, sideCollapsed ? '1' : '0');
  }, [sideCollapsed]);

  const [conversations, setConversations] = useState<Conversation[]>(() =>
    loadConversations(),
  );
  useEffect(() => {
    saveConversations(conversations);
  }, [conversations]);

  // activeId is derived from the URL — `/ai/<id>` selects the conv;
  // `/ai` bare means "empty / new chat" screen.
  const activeId = routeId ?? null;
  const activeConv = useMemo(
    () => conversations.find((c) => c.id === activeId) || null,
    [conversations, activeId],
  );
  const inConv = !!activeConv;

  // Ids we just minted in this tick — skip the "unknown id" redirect for
  // them so the brief window between `navigate(newId)` and the next
  // commit that carries the conversation into state doesn't bounce back
  // to `/ai`. Cleared once the conversation shows up in `conversations`.
  const freshIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!routeId) return;
    if (conversations.some((c) => c.id === routeId)) {
      freshIdsRef.current.delete(routeId);
      return;
    }
    if (freshIdsRef.current.has(routeId)) return;
    navigate('/ai', { replace: true });
  }, [routeId, conversations, navigate]);

  /* ---- composer state ---- */
  const [draftEmpty, setDraftEmpty] = useState('');
  const [draftConv, setDraftConv] = useState('');
  const taEmptyRef = useRef<HTMLTextAreaElement>(null);
  const taConvRef = useRef<HTMLTextAreaElement>(null);
  useAutosize(taEmptyRef, draftEmpty);
  useAutosize(taConvRef, draftConv);

  /* ---- pills (visual-only for now) ---- */
  const [pillOn1, setPillOn1] = useState<string | null>(null);
  const [pillOn2, setPillOn2] = useState<string | null>(null);

  /* ---- streaming state ---- */
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  // RAF-batched patch queue: multiple deltas within one frame collapse
  // into a single setState, keeping React re-renders at ≤60fps even when
  // the upstream stream fires tokens much faster.
  const pendingPatchRef = useRef<Partial<UIMsg> | null>(null);
  const rafRef = useRef<number | null>(null);

  /* ---- title rename ---- */
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');

  /* ---- model picker ---- */
  const [models, setModels] = useState<AIModelEntry[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    try {
      return localStorage.getItem(MODEL_KEY) || '';
    } catch {
      return '';
    }
  });
  const [configured, setConfigured] = useState<boolean>(true);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  useEffect(() => {
    getPublicConfig()
      .then((res) => {
        const list = res.data.models || [];
        setModels(list);
        setConfigured(res.data.configured);
        // Ensure current selection is valid; otherwise adopt server default
        // or first entry.
        setSelectedModel((prev) => {
          if (prev && list.some((m) => m.model === prev)) return prev;
          return res.data.model || list[0]?.model || '';
        });
      })
      .catch(() => {
        setModels([]);
      });
  }, []);
  useEffect(() => {
    try {
      if (selectedModel) localStorage.setItem(MODEL_KEY, selectedModel);
    } catch {
      /* quota ignored */
    }
  }, [selectedModel]);
  const selectedEntry = useMemo(
    () => models.find((m) => m.model === selectedModel),
    [models, selectedModel],
  );
  const modelDisplay =
    selectedEntry?.display_name ||
    selectedEntry?.model ||
    selectedModel ||
    'AI 助手';

  // Close the model menu when clicking outside.
  useEffect(() => {
    if (!modelMenuOpen) return;
    const onDoc = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-ai-model-pop]')) setModelMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [modelMenuOpen]);

  /* ---- smart autoscroll ----
   * Only auto-scroll when the user is already near the bottom; if they
   * scrolled up to read earlier messages, leave them there. */
  const msgsRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const SCROLL_BOTTOM_THRESHOLD = 48;

  const isNearBottom = useCallback(() => {
    const el = msgsRef.current;
    if (!el) return true;
    return (
      el.scrollHeight - el.scrollTop - el.clientHeight <=
      SCROLL_BOTTOM_THRESHOLD
    );
  }, []);

  const scrollToBottom = useCallback((force = false, smooth = false) => {
    const el = msgsRef.current;
    if (!el) return;
    if (!force && !stickToBottomRef.current) return;
    if (smooth) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    } else {
      el.scrollTop = el.scrollHeight;
    }
  }, []);

  const handleScroll = useCallback(() => {
    stickToBottomRef.current = isNearBottom();
  }, [isNearBottom]);

  // Run after every message update. Only scrolls if user was at bottom.
  useEffect(() => {
    scrollToBottom();
  }, [activeConv?.messages, scrollToBottom]);

  // Always snap to bottom when switching conversations.
  useEffect(() => {
    stickToBottomRef.current = true;
    scrollToBottom(true);
  }, [activeId, scrollToBottom]);

  /* =======================================================================
   * Actions
   * ===================================================================== */

  const backHome = () => {
    const roles = user?.roles || [];
    navigate(getHomeRoute(roles));
  };

  const startNewChat = () => {
    setDraftEmpty('');
    setDraftConv('');
    navigate('/ai');
    setTimeout(() => taEmptyRef.current?.focus(), 40);
  };

  const openConv = (id: string) => {
    navigate(`/ai/${id}`);
    setTimeout(() => taConvRef.current?.focus(), 40);
  };

  const deleteConv = (id: string) => {
    setConversations((list) => list.filter((c) => c.id !== id));
    if (activeId === id) navigate('/ai', { replace: true });
  };

  const beginTitleEdit = () => {
    if (!activeConv) return;
    setTitleDraft(activeConv.title);
    setEditingTitle(true);
  };
  const commitTitleEdit = () => {
    if (!activeConv) return;
    const next = (titleDraft || '').trim() || activeConv.title || '新对话';
    setConversations((list) =>
      list.map((c) => (c.id === activeConv.id ? { ...c, title: next } : c)),
    );
    setEditingTitle(false);
  };

  /* ---- send / stream ---- */

  const runStream = useCallback(
    async (conv: Conversation, newMessages: UIMsg[], placeholderId: string) => {
      setStreaming(true);
      const controller = new AbortController();
      abortRef.current = controller;
      const payload: AIChatMessage[] = newMessages
        .filter((m) => !m.pending && !m.errored)
        .map((m) => ({ role: m.role, content: m.content }));

      // Immediate patch (bypasses RAF batching — used for first-token /
      // state transitions / final cleanup).
      const patchBubbleNow = (patch: Partial<UIMsg>) => {
        setConversations((list) =>
          list.map((c) =>
            c.id === conv.id
              ? {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === placeholderId ? { ...m, ...patch } : m,
                  ),
                  updatedAt: Date.now(),
                }
              : c,
          ),
        );
      };

      // RAF-throttled patch. The pendingPatchRef accumulates the latest
      // content/reasoning snapshots; the rAF callback flushes them in a
      // single setState per frame.
      const scheduleFlush = () => {
        if (rafRef.current !== null) return;
        rafRef.current = window.requestAnimationFrame(() => {
          rafRef.current = null;
          const patch = pendingPatchRef.current;
          pendingPatchRef.current = null;
          if (patch) patchBubbleNow(patch);
        });
      };

      const queuePatch = (patch: Partial<UIMsg>) => {
        pendingPatchRef.current = { ...(pendingPatchRef.current || {}), ...patch };
        scheduleFlush();
      };

      const flushNow = () => {
        if (rafRef.current !== null) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
        const patch = pendingPatchRef.current;
        pendingPatchRef.current = null;
        if (patch) patchBubbleNow(patch);
      };

      let acc = '';
      let reasoning = '';
      let reasoningStarted = false;
      let reasoningStartedAt = 0;
      let contentStarted = false;
      let firstToken = true;

      // Compute and return the locked-in thinking duration (seconds).
      // Called at the moment the reasoning phase logically ends —
      // either because content started, the stream completed, errored,
      // or was aborted — so the value we persist is stable across
      // reloads and no longer depends on the bubble's local timer.
      const finalizeThinking = (): number | undefined =>
        reasoningStarted
          ? Math.max((Date.now() - reasoningStartedAt) / 1000, 0)
          : undefined;

      try {
        await streamChat(payload, selectedModel || undefined, {
          signal: controller.signal,
          onDelta: (delta) => {
            if (firstToken) {
              firstToken = false;
              patchBubbleNow({ pending: false });
            }
            if (delta.reasoning) {
              reasoning += delta.reasoning;
              if (!reasoningStarted) {
                reasoningStarted = true;
                reasoningStartedAt = Date.now();
                patchBubbleNow({
                  reasoning,
                  thinkingComplete: false,
                  thinkingStopped: false,
                });
              } else {
                queuePatch({ reasoning });
              }
            }
            if (delta.content) {
              acc += delta.content;
              if (!contentStarted) {
                contentStarted = true;
                flushNow();
                const duration = finalizeThinking();
                patchBubbleNow({
                  content: acc,
                  thinkingComplete: reasoningStarted ? true : undefined,
                  thinkingDuration:
                    duration !== undefined ? duration : undefined,
                });
              } else {
                queuePatch({ content: acc });
              }
            }
          },
          onDone: () => {
            flushNow();
            // If the model never produced content after reasoning (rare),
            // still close the timer here.
            const patch: Partial<UIMsg> = { pending: false };
            if (reasoningStarted) {
              patch.thinkingComplete = true;
              if (!contentStarted) {
                const duration = finalizeThinking();
                if (duration !== undefined) patch.thinkingDuration = duration;
              }
            }
            patchBubbleNow(patch);
          },
          onError: (msg) => {
            flushNow();
            const patch: Partial<UIMsg> = {
              pending: false,
              errored: true,
              content: acc || `⚠️ ${msg}`,
            };
            if (reasoningStarted) {
              patch.thinkingComplete = true;
              if (!contentStarted) {
                const duration = finalizeThinking();
                if (duration !== undefined) patch.thinkingDuration = duration;
              }
            }
            patchBubbleNow(patch);
          },
        });
      } catch (err) {
        flushNow();
        const patch: Partial<UIMsg> = { pending: false };
        const duration = finalizeThinking();
        if ((err as { name?: string })?.name === 'AbortError') {
          patch.content = acc;
          if (reasoningStarted) {
            patch.thinkingStopped = !contentStarted;
            patch.thinkingComplete = true;
            if (!contentStarted && duration !== undefined) {
              patch.thinkingDuration = duration;
            }
          }
        } else {
          patch.errored = true;
          patch.content = acc || `⚠️ ${(err as Error).message || '请求失败'}`;
          if (reasoningStarted) {
            patch.thinkingComplete = true;
            if (!contentStarted && duration !== undefined) {
              patch.thinkingDuration = duration;
            }
          }
        }
        patchBubbleNow(patch);
      } finally {
        flushNow();
        setStreaming(false);
        abortRef.current = null;
      }
    },
    [selectedModel],
  );

  const sendFromEmpty = () => {
    const v = draftEmpty.trim();
    if (!v || streaming) return;
    const convId = makeUuid();
    freshIdsRef.current.add(convId);

    const userMsg: UIMsg = { id: makeId('m'), role: 'user', content: v };
    const placeholderId = makeId('m');
    const aiMsg: UIMsg = {
      id: placeholderId,
      role: 'assistant',
      content: '',
      pending: true,
    };
    const newConv: Conversation = {
      id: convId,
      title: titleFrom(v),
      messages: [userMsg, aiMsg],
      updatedAt: Date.now(),
    };

    // React 18 auto-batches the state update + the router navigation
    // into a single commit. Updating state first guarantees that when
    // the router's new URL lands, `conversations` already contains
    // the new conv — no flicker, no unknown-id redirect.
    setConversations((list) => [newConv, ...list]);
    setDraftEmpty('');
    navigate(`/ai/${convId}`);
    runStream(newConv, [userMsg, aiMsg], placeholderId);
  };

  const sendFromConv = () => {
    if (!activeConv) return;
    const v = draftConv.trim();
    if (!v || streaming) return;
    const userMsg: UIMsg = { id: makeId('m'), role: 'user', content: v };
    const placeholderId = makeId('m');
    const aiMsg: UIMsg = {
      id: placeholderId,
      role: 'assistant',
      content: '',
      pending: true,
    };
    const nextMsgs = [...activeConv.messages, userMsg, aiMsg];
    const updated: Conversation = {
      ...activeConv,
      messages: nextMsgs,
      updatedAt: Date.now(),
    };
    setConversations((list) =>
      list.map((c) => (c.id === activeConv.id ? updated : c)),
    );
    setDraftConv('');
    runStream(updated, nextMsgs, placeholderId);
  };

  const stopStreaming = () => {
    abortRef.current?.abort();
  };

  /* =======================================================================
   * Render helpers
   * ===================================================================== */

  const renderMessage = (m: UIMsg) => {
    if (m.role === 'user') {
      return (
        <div key={m.id} className="ai-msg-user">
          <div className="ai-bubble-user">{m.content}</div>
        </div>
      );
    }

    // Streaming: reasoning is in-flight iff thinkingComplete is false AND
    // content hasn't started (contentStarted flips thinkingComplete → true).
    const hasReasoning = !!m.reasoning;
    const hasContent = !!m.content;
    const stillStreamingContent = !!m.pending && hasContent;

    return (
      <div key={m.id} className="ai-msg-ai">
        {hasReasoning && (
          <ThinkingBubble
            content={m.reasoning || ''}
            isComplete={!!m.thinkingComplete}
            isStopped={!!m.thinkingStopped}
            thinkingDuration={m.thinkingDuration ?? null}
          />
        )}
        {m.pending && !hasContent && !hasReasoning && (
          <div className="ai-body">
            <div className="ai-dots">
              <span />
              <span />
              <span />
            </div>
          </div>
        )}
        {hasContent && (
          <MarkdownStream
            content={m.content}
            isStreaming={stillStreamingContent}
          />
        )}
      </div>
    );
  };

  /* ---- composer block, shared between empty + conv ---- */

  const renderComposer = (where: 'empty' | 'conv') => {
    const isEmpty = where === 'empty';
    const value = isEmpty ? draftEmpty : draftConv;
    const setValue = isEmpty ? setDraftEmpty : setDraftConv;
    const taRef = isEmpty ? taEmptyRef : taConvRef;
    const sendFn = isEmpty ? sendFromEmpty : sendFromConv;
    const pillState = isEmpty ? pillOn1 : pillOn2;
    const setPill = isEmpty ? setPillOn1 : setPillOn2;
    const canSend = value.trim().length > 0 && !streaming;
    const showStop = streaming && !isEmpty;

    const togglePill = (key: string) => {
      setPill((prev) => (prev === key ? null : key));
    };

    return (
      <div className="ai-composer-wrap">
        <div className="ai-composer">
          <textarea
            ref={taRef}
            className="ai-ta"
            rows={1}
            placeholder={isEmpty ? '今天我能帮你做些什么？' : '回复…'}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (canSend) sendFn();
              }
            }}
          />
          <div className="ai-composer-row">
            <div className="ai-actions-left">
              <button
                className="ai-icon-btn"
                title="附件（即将支持）"
                type="button"
              >
                <IcoPlusSm />
              </button>
              <button
                className={`ai-pill v-search${pillState === 'search' ? ' on' : ''}`}
                title="联网搜索（即将支持）"
                type="button"
                onClick={() => togglePill('search')}
              >
                <span className="ai-icon-wrap">
                  <IcoGlobe />
                </span>
                <span className="ai-label">联网搜索</span>
              </button>
              <button
                className={`ai-pill v-kb${pillState === 'kb' ? ' on' : ''}`}
                title="知识库（即将支持）"
                type="button"
                onClick={() => togglePill('kb')}
              >
                <span className="ai-icon-wrap">
                  <IcoKb />
                </span>
                <span className="ai-label">知识库</span>
              </button>
            </div>
            <div className="ai-actions-right">
              <div
                data-ai-model-pop
                className="ai-model-pop"
                style={{ position: 'relative' }}
              >
                <button
                  type="button"
                  className="ai-model"
                  title="切换模型"
                  onClick={() => setModelMenuOpen((v) => !v)}
                  disabled={models.length === 0}
                  style={{
                    border: 0,
                    background: 'transparent',
                    cursor: models.length === 0 ? 'default' : 'pointer',
                    font: 'inherit',
                    color: 'inherit',
                  }}
                >
                  <b>{modelDisplay}</b>
                  <span className="ai-tag">Chat</span>
                  <IcoCaretDown />
                </button>
                {modelMenuOpen && models.length > 0 && (
                  <div
                    role="listbox"
                    className="ai-model-menu"
                    style={{
                      position: 'absolute',
                      bottom: 'calc(100% + 8px)',
                      right: 0,
                      minWidth: 260,
                      maxHeight: 320,
                      overflowY: 'auto',
                      padding: 6,
                      background: 'var(--ai-surface, #fff)',
                      border: '1px solid var(--ai-border, #e5e5e5)',
                      borderRadius: 12,
                      boxShadow:
                        '0 12px 32px rgba(15, 15, 15, 0.12), 0 2px 6px rgba(15, 15, 15, 0.06)',
                      zIndex: 20,
                    }}
                  >
                    {models.map((m) => {
                      const isActive = m.model === selectedModel;
                      return (
                        <button
                          key={m.model}
                          type="button"
                          role="option"
                          aria-selected={isActive}
                          onClick={() => {
                            setSelectedModel(m.model);
                            setModelMenuOpen(false);
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 10,
                            width: '100%',
                            padding: '9px 10px',
                            border: 0,
                            borderRadius: 8,
                            background: isActive
                              ? 'var(--ai-accent-soft, rgba(92, 141, 93, 0.12))'
                              : 'transparent',
                            color: 'inherit',
                            cursor: 'pointer',
                            textAlign: 'left',
                            font: 'inherit',
                          }}
                        >
                          <span
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              minWidth: 0,
                            }}
                          >
                            <span
                              style={{
                                fontWeight: 600,
                                fontSize: 13,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {m.display_name || m.model}
                            </span>
                            <span
                              style={{
                                fontSize: 11.5,
                                color: 'var(--ai-muted, #8a847b)',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {m.model}
                            </span>
                          </span>
                          {isActive && (
                            <span
                              aria-hidden
                              style={{
                                width: 6,
                                height: 6,
                                borderRadius: '50%',
                                background: 'var(--ai-accent, #5c8d5d)',
                                flexShrink: 0,
                              }}
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              {showStop ? (
                <button
                  className="ai-send stop"
                  title="停止生成"
                  type="button"
                  onClick={stopStreaming}
                >
                  <IcoStop />
                </button>
              ) : (
                <button
                  className="ai-send"
                  title="发送"
                  type="button"
                  disabled={!canSend}
                  onClick={sendFn}
                >
                  <IcoArrowUp />
                </button>
              )}
            </div>
          </div>
        </div>
        {isEmpty && (
          <div className="ai-chips" style={{ marginTop: 18 }}>
            {PRESET_CHIPS.map((c) => (
              <button
                key={c.label}
                className="ai-chip"
                type="button"
                onClick={() => {
                  setDraftEmpty(c.prompt);
                  setTimeout(() => taEmptyRef.current?.focus(), 0);
                }}
              >
                {c.icon}
                {c.label}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  /* =======================================================================
   * JSX
   * ===================================================================== */

  return (
    <div className="ai-app">
      {/* ============ SIDEBAR ============ */}
      <aside className={`ai-side${sideCollapsed ? ' collapsed' : ''}`}>
        <div className="ai-side-top">
          <div className="ai-brand">
            <img
              src="/favicon.svg"
              alt="SmartMedCare"
              style={{ width: 22, height: 22 }}
            />
            <span>智慧医养</span>
          </div>
          <button
            className="ai-side-toggle"
            title={sideCollapsed ? '展开侧栏' : '折叠侧栏'}
            type="button"
            onClick={() => setSideCollapsed((v) => !v)}
          >
            <IcoSidebar />
          </button>
        </div>

        <nav className="ai-side-nav">
          <button
            className="ai-nav-item new-chat"
            data-tip="新对话"
            type="button"
            onClick={startNewChat}
          >
            <span className="ai-nav-icon">
              <IcoPlus />
            </span>
            <span className="ai-nav-label">新对话</span>
          </button>
        </nav>

        <div className="ai-side-scroll">
          <div className="ai-recents-label">最近</div>
          <div>
            {conversations.length === 0 && (
              <div
                style={{
                  padding: '6px 10px',
                  fontSize: 12.5,
                  color: 'var(--ai-muted)',
                }}
              >
                还没有历史对话
              </div>
            )}
            {conversations.map((r) => (
              <div
                key={r.id}
                className={`ai-recent-item${r.id === activeId ? ' active' : ''}`}
                title={r.title}
                onClick={() => openConv(r.id)}
              >
                <span className="ai-recent-label">{r.title}</span>
                <span
                  className="ai-recent-del"
                  title="删除"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteConv(r.id);
                  }}
                >
                  <IcoTrash />
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="ai-side-bottom">
          <div
            className="ai-user-row"
            title={displayName}
            onClick={backHome}
          >
            <div className="ai-avatar">
              {(displayName || 'U').slice(0, 1).toUpperCase()}
            </div>
            <div className="ai-user-meta">
              <span className="ai-user-name">{displayName}</span>
              <span className="ai-user-plan">返回平台</span>
            </div>
            <div className="ai-user-caret">
              <IcoCaretDown />
            </div>
          </div>
        </div>
      </aside>

      {/* ============ MAIN ============ */}
      <main className="ai-main">
        <div className="ai-stage">
          <button className="ai-back" type="button" onClick={backHome}>
            <IcoBack />
            返回平台
          </button>

          {/* Empty */}
          <div className={`ai-empty${inConv ? ' hidden' : ' active'}`}>
            <div className="ai-greet">
              <img src="/favicon.svg" alt="logo" />
              <span>{greetingText(displayName)}</span>
            </div>
            {!configured && (
              <div
                style={{
                  fontSize: 13,
                  color: 'var(--ai-muted)',
                  marginTop: -12,
                }}
              >
                模型尚未配置，请联系管理员前往「AI 模型配置」填写 Base URL 与 API
                Key。
              </div>
            )}
            {renderComposer('empty')}
          </div>

          {/* Conversation */}
          <div className={`ai-conv${inConv ? ' active' : ''}`}>
            <div className="ai-conv-header">
              <div
                className={`ai-conv-title${editingTitle ? ' editing' : ''}`}
                title="点击重命名"
                onClick={() => !editingTitle && beginTitleEdit()}
              >
                {editingTitle ? (
                  <input
                    className="ai-conv-title-input"
                    value={titleDraft}
                    maxLength={80}
                    autoFocus
                    onChange={(e) => setTitleDraft(e.target.value)}
                    onBlur={commitTitleEdit}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        commitTitleEdit();
                      } else if (e.key === 'Escape') {
                        setEditingTitle(false);
                      }
                    }}
                  />
                ) : (
                  <span>{activeConv?.title || '新对话'}</span>
                )}
              </div>
            </div>

            <div
              className="ai-messages"
              ref={msgsRef}
              onScroll={handleScroll}
            >
              <div className="ai-thread">
                {activeConv?.messages.map(renderMessage)}
              </div>
            </div>

            <div className="ai-conv-composer">
              {renderComposer('conv')}
              <div className="ai-footer-note">
                AI 生成内容可能存在错误，请核对关键信息。
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AIChatPage;
