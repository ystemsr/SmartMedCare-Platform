import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuthStore, getHomeRoute } from '../../store/auth';
import {
  createConversation,
  deleteConversation,
  getConversation,
  getPublicConfig,
  importConversations,
  listConversations,
  streamChat,
  updateConversation,
  type AIChatMessage,
  type AIModelEntry,
  type ConversationMessagePayload,
} from '../../api/ai';
import ThinkingBubble from './ThinkingBubble';
import MarkdownStream from './MarkdownStream';
import SearchBubble, { type SearchCall } from './SearchBubble';
import KnowledgeBubble, { type KnowledgeBaseCall } from './KnowledgeBubble';
import './AIChatPage.css';

/* =========================================================================
 * Types
 * ======================================================================= */

interface UIMsg {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  /** Image attachments shown above a user bubble — each entry is a data URL. */
  images?: string[];
  reasoning?: string;
  /** Assistant message streaming-in-progress flag. */
  pending?: boolean;
  /** Reasoning/thinking state. */
  thinkingComplete?: boolean;
  thinkingStopped?: boolean;
  thinkingDuration?: number | null;
  errored?: boolean;
  /** Web-search tool invocations produced while generating this reply. */
  searches?: SearchCall[];
  /** Knowledge-base lookup performed for this reply (at most one). */
  knowledgeBase?: KnowledgeBaseCall;
}

interface PendingImage {
  id: string;
  dataUrl: string;
}

const MAX_IMAGES = 3;
const IMAGE_MAX_DIMENSION = 1280;
const IMAGE_JPEG_QUALITY = 0.85;

interface Conversation {
  /** Backend-assigned id. Shared browser localStorage used string UUIDs
   * here; those are migrated once on first mount and then the assistant
   * runs entirely against the server, where ids are numeric primary
   * keys. */
  id: number;
  title: string;
  messages: UIMsg[];
  updatedAt: number;
  /** False until messages have been fetched from the backend. The list
   * endpoint only returns summaries, so we hydrate on demand. */
  loaded: boolean;
}

/** Pre-rework key — the chat UI used to store every user's conversations
 * in this shared browser bucket. We import it once into the logged-in
 * user's server-side history and then clear it. */
const LEGACY_STORAGE_KEY = 'smc.ai.conversations.v1';
/** Sentinel so the legacy import runs at most once per browser. */
const MIGRATED_KEY = 'smc.ai.migrated.v1';
const COLLAPSE_KEY = 'smc.ai.side.collapsed';
const MODEL_KEY = 'smc.ai.model.selected';

/* =========================================================================
 * Utilities
 * ======================================================================= */

/** Legacy localStorage shape from before the per-user migration. */
interface LegacyConversation {
  id?: string;
  title?: string;
  messages?: UIMsg[];
  updatedAt?: number;
}

function readLegacyConversations(): LegacyConversation[] {
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as LegacyConversation[]) : [];
  } catch {
    return [];
  }
}

/** Strip UI-only fields that shouldn't round-trip through the backend.
 * `pending` and `errored` are streaming/in-flight flags; persisting them
 * would leave bubbles stuck on the dot-loader after reload. */
function messagesForPersist(list: UIMsg[]): ConversationMessagePayload[] {
  return list.map((m) => {
    const { pending, errored, ...rest } = m;
    void pending;
    void errored;
    return rest as ConversationMessagePayload;
  });
}

/** Adopt a backend payload back into the UI shape. Messages lose their
 * client-side ids on the round-trip, so we re-mint them here. */
function hydrateMessages(raw: ConversationMessagePayload[] | undefined): UIMsg[] {
  if (!raw || !Array.isArray(raw)) return [];
  return raw.map((m) => {
    const role = (m.role === 'assistant' ? 'assistant' : 'user') as UIMsg['role'];
    return {
      id: makeId('m'),
      role,
      content: typeof m.content === 'string' ? m.content : '',
      images: Array.isArray(m.images) ? m.images.slice() : undefined,
      reasoning: typeof m.reasoning === 'string' ? m.reasoning : undefined,
      thinkingComplete: !!m.thinkingComplete,
      thinkingStopped: !!m.thinkingStopped,
      thinkingDuration:
        typeof m.thinkingDuration === 'number' ? m.thinkingDuration : null,
      errored: false,
      searches: Array.isArray(m.searches) ? (m.searches as UIMsg['searches']) : undefined,
      knowledgeBase: (m.knowledgeBase as UIMsg['knowledgeBase']) || undefined,
    };
  });
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

/** Read an image file, downscale so the longest side is ≤ IMAGE_MAX_DIMENSION,
 * and return a JPEG data URL. Keeps payload small enough to embed in chat
 * messages and persist to localStorage without blowing the quota. */
async function fileToDownscaledDataUrl(file: File): Promise<string> {
  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error('读取文件失败'));
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('图像解码失败'));
    el.src = rawDataUrl;
  });
  const longest = Math.max(img.naturalWidth, img.naturalHeight);
  const scale = longest > IMAGE_MAX_DIMENSION ? IMAGE_MAX_DIMENSION / longest : 1;
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  if (scale === 1 && file.type === 'image/jpeg') {
    // No resize needed and already JPEG — return the raw data URL untouched.
    return rawDataUrl;
  }
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return rawDataUrl;
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', IMAGE_JPEG_QUALITY);
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
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <rect x="5" y="5" width="14" height="14" rx="2.5" />
  </svg>
);
const IcoTrash = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18" />
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
  </svg>
);
const IcoX = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);
const IcoBack = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="m15 18-6-6 6-6" />
  </svg>
);

/* chip icons — domain-aligned for the smart medical-elderly care platform */
const IcoHeart = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
);
const IcoAlert = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <path d="M12 9v4" />
    <path d="M12 17h.01" />
  </svg>
);
const IcoCalendar = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M16 2v4M8 2v4M3 10h18" />
  </svg>
);
const IcoPill = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.5 20.5a4.95 4.95 0 1 1-7-7l9-9a4.95 4.95 0 1 1 7 7z" />
    <path d="m8.5 8.5 7 7" />
  </svg>
);
const IcoBook = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
  </svg>
);

/* =========================================================================
 * Component
 * ======================================================================= */

type RoleCode = 'admin' | 'doctor' | 'elder' | 'family';

interface ChipDef {
  label: string;
  prompt: string;
  icon: React.ReactNode;
}

/** Per-role inspiration chips. Each role sees prompts tuned for the
 * tasks they typically open the assistant for. The fallback list is
 * used when the user has no recognised role (e.g. a future viewer
 * role that hasn't been wired in yet). */
const PRESET_CHIPS_BY_ROLE: Record<RoleCode | 'default', ChipDef[]> = {
  doctor: [
    {
      label: '健康评估',
      prompt:
        '请协助我为一位老人完成综合健康评估，需要采集哪些关键指标，并给出风险研判建议。',
      icon: <IcoHeart />,
    },
    {
      label: '风险研判',
      prompt:
        '近期需要重点关注哪些高风险老人信号？请给出排查清单与处置建议。',
      icon: <IcoAlert />,
    },
    {
      label: '随访计划',
      prompt:
        '请为一位高血压、糖尿病的老人制定一份月度随访计划，包含频次、检查项与沟通要点。',
      icon: <IcoCalendar />,
    },
    {
      label: '用药指导',
      prompt: '老年人多重用药需要注意哪些常见相互作用与禁忌？请举例说明。',
      icon: <IcoPill />,
    },
    {
      label: '干预建议',
      prompt: '请给出针对一位轻度认知障碍老人的非药物干预建议清单。',
      icon: <IcoBook />,
    },
  ],
  admin: [
    {
      label: '数据看板',
      prompt: '本月平台的关键运营指标有哪些值得关注的变化？请帮我梳理重点。',
      icon: <IcoHeart />,
    },
    {
      label: '权限梳理',
      prompt: '请帮我梳理当前各角色的权限边界，是否有需要收紧或放开的地方？',
      icon: <IcoAlert />,
    },
    {
      label: '运维巡检',
      prompt: '日常运维巡检应覆盖哪些关键项？请按服务模块给出清单。',
      icon: <IcoCalendar />,
    },
    {
      label: '配置建议',
      prompt: '数据采集频率与告警阈值如何设置才更合理？请给出参考范围。',
      icon: <IcoPill />,
    },
    {
      label: '使用引导',
      prompt: '请帮我准备一份面向新机构的快速上手指南要点。',
      icon: <IcoBook />,
    },
  ],
  elder: [
    {
      label: '用药提醒',
      prompt: '怎么帮我记住每天按时吃药？有哪些简单的方法？',
      icon: <IcoPill />,
    },
    {
      label: '居家锻炼',
      prompt: '请给我推荐几个适合老年人在家做的轻度锻炼。',
      icon: <IcoHeart />,
    },
    {
      label: '饮食建议',
      prompt: '我有高血压，平时饮食上需要注意什么？哪些食物要少吃？',
      icon: <IcoBook />,
    },
    {
      label: '就医准备',
      prompt: '下次去医院复诊之前，我需要提前准备好哪些东西？',
      icon: <IcoCalendar />,
    },
    {
      label: '身体不适',
      prompt: '最近早上起床偶尔头晕，可能是什么原因？需要看医生吗？',
      icon: <IcoAlert />,
    },
  ],
  family: [
    {
      label: '老人状况',
      prompt: '怎样能更快地了解父母最近的健康变化？我应该重点关注哪些指标？',
      icon: <IcoHeart />,
    },
    {
      label: '照护建议',
      prompt: '糖尿病老人日常照护需要注意哪些细节？请给出清单。',
      icon: <IcoBook />,
    },
    {
      label: '沟通技巧',
      prompt: '老人对按时吃药比较抵触，怎么沟通才能让他配合？',
      icon: <IcoPill />,
    },
    {
      label: '紧急应对',
      prompt: '老人突发胸痛或晕倒时，家属应该如何第一时间应对？',
      icon: <IcoAlert />,
    },
    {
      label: '远程关怀',
      prompt: '每周和远在老家的父母通电话，可以聊些什么内容更有帮助？',
      icon: <IcoCalendar />,
    },
  ],
  default: [
    {
      label: '健康评估',
      prompt: '请介绍老年人综合健康评估通常包含哪些维度。',
      icon: <IcoHeart />,
    },
    {
      label: '风险预警',
      prompt: '老年人常见的健康风险信号有哪些？',
      icon: <IcoAlert />,
    },
    {
      label: '随访计划',
      prompt: '一份典型的老年慢病随访计划应该如何安排？',
      icon: <IcoCalendar />,
    },
    {
      label: '用药咨询',
      prompt: '老年人多重用药需要注意哪些常见相互作用与禁忌？',
      icon: <IcoPill />,
    },
    {
      label: '健康科普',
      prompt: '用通俗的语言介绍一种适合老人的居家健康管理方式。',
      icon: <IcoBook />,
    },
  ],
};

/** Mirror of backend's `_primary_role`: admin > doctor > elder > family.
 * Returns the most-privileged matching role code, or null if none of the
 * known role codes are present. */
function pickPrimaryRole(roles: string[] | undefined): RoleCode | null {
  if (!roles || roles.length === 0) return null;
  const ORDER: RoleCode[] = ['admin', 'doctor', 'elder', 'family'];
  for (const code of ORDER) {
    if (roles.includes(code)) return code;
  }
  return null;
}

const AIChatPage: React.FC = () => {
  const navigate = useNavigate();
  const { id: routeId } = useParams<{ id?: string }>();
  const user = useAuthStore((s) => s.user);
  const displayName =
    user?.real_name || user?.username || '朋友';
  const presetChips = useMemo(() => {
    const role = pickPrimaryRole(user?.roles);
    return PRESET_CHIPS_BY_ROLE[role ?? 'default'];
  }, [user?.roles]);

  const [sideCollapsed, setSideCollapsed] = useState<boolean>(
    () => localStorage.getItem(COLLAPSE_KEY) === '1',
  );
  useEffect(() => {
    localStorage.setItem(COLLAPSE_KEY, sideCollapsed ? '1' : '0');
  }, [sideCollapsed]);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  // Mirror of `conversations` so async callbacks (stream finish,
  // save-on-complete) can read the latest state without retriggering
  // renders via a `setConversations` closure.
  const conversationsRef = useRef<Conversation[]>([]);
  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  // activeId is derived from the URL — `/ai/<id>` selects the conv;
  // `/ai` bare means "empty / new chat" screen. Backend ids are numeric
  // primary keys; non-numeric route params (stale UUID bookmarks from
  // the localStorage era) are treated as "no active conversation" and
  // cleaned up by the redirect effect below.
  const activeId = useMemo(() => {
    if (!routeId) return null;
    const n = Number(routeId);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [routeId]);
  const activeConv = useMemo(
    () => conversations.find((c) => c.id === activeId) || null,
    [conversations, activeId],
  );
  const inConv = !!activeConv;

  // Ids we just minted in this tick — skip the "unknown id" redirect for
  // them so the brief window between `navigate(newId)` and the next
  // commit that carries the conversation into state doesn't bounce back
  // to `/ai`. Cleared once the conversation shows up in `conversations`.
  const freshIdsRef = useRef<Set<number>>(new Set());

  /* ---- initial load + one-shot legacy localStorage migration ----
   * On first mount we import any pre-rework localStorage data into the
   * logged-in user's server-side history (at most once per browser),
   * then list the user's conversations from the backend. Errors are
   * non-fatal — the UI still works, just without history. */
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState('');
  useEffect(() => {
    let cancelled = false;
    const bootstrap = async () => {
      if (localStorage.getItem(MIGRATED_KEY) !== '1') {
        const legacy = readLegacyConversations();
        if (legacy.length > 0) {
          try {
            await importConversations(
              legacy.map((c) => ({
                title: c.title,
                updated_at: c.updatedAt,
                messages: messagesForPersist(c.messages || []),
              })),
            );
          } catch {
            /* swallow — we'll try again next load if the flag stays unset */
            localStorage.setItem(MIGRATED_KEY, '1');
            localStorage.removeItem(LEGACY_STORAGE_KEY);
            if (!cancelled) setHistoryError('历史对话导入失败，部分记录可能已丢失');
          }
        }
        localStorage.setItem(MIGRATED_KEY, '1');
        localStorage.removeItem(LEGACY_STORAGE_KEY);
      }
      try {
        const res = await listConversations();
        if (cancelled) return;
        const summaries = res.data || [];
        setConversations(
          summaries.map((s) => ({
            id: s.id,
            title: s.title,
            updatedAt: s.updated_at,
            messages: [],
            loaded: false,
          })),
        );
      } catch {
        if (!cancelled) setHistoryError('无法加载历史对话');
      } finally {
        if (!cancelled) setHistoryLoading(false);
      }
    };
    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  /* ---- lazy-hydrate the active conversation's messages ---- */
  useEffect(() => {
    if (!activeId) return;
    const conv = conversations.find((c) => c.id === activeId);
    if (!conv || conv.loaded) return;
    let cancelled = false;
    getConversation(activeId)
      .then((res) => {
        if (cancelled) return;
        const detail = res.data;
        setConversations((list) =>
          list.map((c) =>
            c.id === activeId
              ? {
                  ...c,
                  title: detail.title,
                  updatedAt: detail.updated_at,
                  messages: hydrateMessages(detail.messages),
                  loaded: true,
                }
              : c,
          ),
        );
      })
      .catch(() => {
        if (cancelled) return;
        // Conversation was deleted (possibly on another device) — drop
        // it from the sidebar and bounce back to the empty screen.
        setConversations((list) => list.filter((c) => c.id !== activeId));
        navigate('/ai', { replace: true });
      });
    return () => {
      cancelled = true;
    };
  }, [activeId, conversations, navigate]);

  useEffect(() => {
    if (historyLoading) return;
    if (!routeId) return;
    if (activeId === null) {
      // Non-numeric / invalid id in the URL (stale bookmark from the
      // localStorage era). Send the user back to the empty screen.
      navigate('/ai', { replace: true });
      return;
    }
    if (conversations.some((c) => c.id === activeId)) {
      freshIdsRef.current.delete(activeId);
      return;
    }
    if (freshIdsRef.current.has(activeId)) return;
    navigate('/ai', { replace: true });
  }, [routeId, activeId, conversations, navigate, historyLoading]);

  /* ---- composer state ---- */
  const [draftEmpty, setDraftEmpty] = useState('');
  const [draftConv, setDraftConv] = useState('');
  const taEmptyRef = useRef<HTMLTextAreaElement>(null);
  const taConvRef = useRef<HTMLTextAreaElement>(null);
  useAutosize(taEmptyRef, draftEmpty);
  useAutosize(taConvRef, draftConv);

  /* ---- image attachments (per-composer) ---- */
  const [pendingImagesEmpty, setPendingImagesEmpty] = useState<PendingImage[]>([]);
  const [pendingImagesConv, setPendingImagesConv] = useState<PendingImage[]>([]);
  const fileInputEmptyRef = useRef<HTMLInputElement>(null);
  const fileInputConvRef = useRef<HTMLInputElement>(null);
  // Surfaced as a brief inline notice when an upload is rejected
  // (too many images, wrong type, decode failure, …).
  const [imageNoticeEmpty, setImageNoticeEmpty] = useState('');
  const [imageNoticeConv, setImageNoticeConv] = useState('');
  // Drag-hover feedback. We use a ref-counter to handle nested
  // dragenter/dragleave events fired by descendant elements — without
  // it, the overlay would flicker as the cursor moved across children.
  const [dragHoverEmpty, setDragHoverEmpty] = useState(false);
  const [dragHoverConv, setDragHoverConv] = useState(false);
  const dragCounterEmptyRef = useRef(0);
  const dragCounterConvRef = useRef(0);

  /* ---- pills ----
   * Both toggles are shared across the empty and conversation composers:
   * once the user turns a pill on for a new chat, it stays on as the
   * conversation continues. */
  const [forceWebSearch, setForceWebSearch] = useState(false);
  // Default to on — most users of this assistant benefit from the KB
  // context and we'd rather they opt out than forget to opt in. If the
  // server reports the KB as unavailable the pill is disabled and the
  // `&& knowledgeBaseAvailable` guard below stops the flag from being
  // sent, so this default is safe even when embeddings aren't wired up.
  const [useKnowledgeBase, setUseKnowledgeBase] = useState(true);
  const [webSearchAvailable, setWebSearchAvailable] = useState(false);
  const [knowledgeBaseAvailable, setKnowledgeBaseAvailable] = useState(false);

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
        setWebSearchAvailable(!!res.data.web_search_available);
        setKnowledgeBaseAvailable(!!res.data.knowledge_base_available);
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
  // Display order: the currently-selected model is pinned to the top
  // of the picker so the most-recently-used model is always immediate.
  const orderedModels = useMemo(() => {
    if (!selectedModel) return models;
    const idx = models.findIndex((m) => m.model === selectedModel);
    if (idx <= 0) return models;
    const next = models.slice();
    const [picked] = next.splice(idx, 1);
    next.unshift(picked);
    return next;
  }, [models, selectedModel]);
  const modelDisplay =
    selectedEntry?.display_name ||
    selectedEntry?.model ||
    selectedModel ||
    'AI 助手';
  const visionSupported = !!selectedEntry?.vision;

  // If the user switches to a model that doesn't support vision, drop any
  // staged images so they can't be sent silently.
  useEffect(() => {
    if (visionSupported) return;
    setPendingImagesEmpty((arr) => (arr.length === 0 ? arr : []));
    setPendingImagesConv((arr) => (arr.length === 0 ? arr : []));
  }, [visionSupported]);

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

  const openConv = (id: number) => {
    navigate(`/ai/${id}`);
    setTimeout(() => taConvRef.current?.focus(), 40);
  };

  const deleteConv = (id: number) => {
    // Optimistic removal — if the DELETE fails we roll back from the
    // snapshot so the sidebar doesn't silently lose an entry that's
    // still on the server.
    const snapshot = conversationsRef.current;
    setConversations((list) => list.filter((c) => c.id !== id));
    if (activeId === id) navigate('/ai', { replace: true });
    void deleteConversation(id).catch(() => {
      setConversations(snapshot);
    });
  };

  const beginTitleEdit = () => {
    if (!activeConv) return;
    setTitleDraft(activeConv.title);
    setEditingTitle(true);
  };
  const commitTitleEdit = () => {
    if (!activeConv) return;
    const prev = activeConv.title;
    const next = (titleDraft || '').trim() || prev || '新对话';
    setEditingTitle(false);
    if (next === prev) return;
    setConversations((list) =>
      list.map((c) => (c.id === activeConv.id ? { ...c, title: next } : c)),
    );
    void updateConversation(activeConv.id, { title: next }).catch(() => {
      // Roll back on failure so the sidebar doesn't diverge from the server.
      setConversations((list) =>
        list.map((c) => (c.id === activeConv.id ? { ...c, title: prev } : c)),
      );
    });
  };

  /** Persist the latest message list for `convId` to the backend.
   * Fire-and-forget; errors are swallowed so a transient failure
   * doesn't block the UI. */
  const persistMessages = useCallback((convId: number) => {
    const conv = conversationsRef.current.find((c) => c.id === convId);
    if (!conv) return;
    void updateConversation(convId, {
      messages: messagesForPersist(conv.messages),
    }).catch(() => {
      /* silent — the next successful save will reconcile */
    });
  }, []);

  /* ---- send / stream ---- */

  const runStream = useCallback(
    async (
      conv: Conversation,
      newMessages: UIMsg[],
      placeholderId: string,
      opts: { webSearch?: boolean; useKnowledgeBase?: boolean } = {},
    ) => {
      setStreaming(true);
      const controller = new AbortController();
      abortRef.current = controller;
      const payload: AIChatMessage[] = newMessages
        .filter((m) => !m.pending && !m.errored)
        .map((m) => {
          // User turns with attached images are sent as a multimodal
          // content array (`{type:text}` + one `{type:image_url}` per
          // image). All other turns stay as plain strings.
          if (m.role === 'user' && m.images && m.images.length > 0) {
            const parts: AIChatMessage['content'] = [
              { type: 'text', text: m.content || '' },
              ...m.images.map((url) => ({
                type: 'image_url' as const,
                image_url: { url },
              })),
            ];
            return { role: m.role, content: parts };
          }
          return { role: m.role, content: m.content };
        });

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

      // Tool-call bookkeeping — we mutate the bubble's `searches` array
      // directly so pending/done transitions stay ordered even when tokens
      // interleave.
      const upsertSearch = (patch: SearchCall) => {
        setConversations((list) =>
          list.map((c) =>
            c.id === conv.id
              ? {
                  ...c,
                  messages: c.messages.map((m) => {
                    if (m.id !== placeholderId) return m;
                    const prev = m.searches || [];
                    const idx = prev.findIndex((s) => s.id === patch.id);
                    const next =
                      idx === -1
                        ? [...prev, patch]
                        : prev.map((s, i) => (i === idx ? { ...s, ...patch } : s));
                    return { ...m, searches: next };
                  }),
                  updatedAt: Date.now(),
                }
              : c,
          ),
        );
      };

      try {
        await streamChat(payload, selectedModel || undefined, {
          signal: controller.signal,
          webSearch: opts.webSearch,
          useKnowledgeBase: opts.useKnowledgeBase,
          onDelta: (delta) => {
            if (delta.knowledge_base) {
              // One-shot event fired at the start of the stream. Attach
              // the retrieval result to the assistant bubble so the user
              // can inspect which chunks informed the reply.
              const kbCall: KnowledgeBaseCall = {
                id: `kb-${placeholderId}`,
                query: delta.knowledge_base.query,
                hits: delta.knowledge_base.hits,
              };
              patchBubbleNow({ knowledgeBase: kbCall });
              return;
            }
            if (delta.tool_call_start) {
              // Clear the "awaiting first token" placeholder so the
              // dot-loader doesn't sit underneath the search bubble.
              if (firstToken) {
                firstToken = false;
                patchBubbleNow({ pending: false });
              }
              upsertSearch({
                id: delta.tool_call_start.id,
                queries: delta.tool_call_start.queries,
                status: 'pending',
              });
              return;
            }
            if (delta.tool_call_result) {
              upsertSearch({
                id: delta.tool_call_result.id,
                queries: delta.tool_call_result.queries,
                status: 'done',
                groups: delta.tool_call_result.groups,
              });
              // After the tool round-trip the model will start streaming
              // the real reply — keep `pending` true so the dot-loader
              // shows while we wait for the first post-tool token.
              patchBubbleNow({ pending: true });
              firstToken = true;
              return;
            }
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
        // Snapshot the conversation to the backend now that the stream
        // has settled. Skipping per-token saves keeps the write volume
        // low; the cost is that a mid-stream browser refresh loses the
        // in-flight reply — an acceptable trade given how cheap it is
        // to regenerate.
        persistMessages(conv.id);
      }
    },
    [selectedModel, persistMessages],
  );

  const sendFromEmpty = async () => {
    const v = draftEmpty.trim();
    const imgs = pendingImagesEmpty;
    if ((!v && imgs.length === 0) || streaming) return;

    const userMsg: UIMsg = {
      id: makeId('m'),
      role: 'user',
      content: v,
      ...(imgs.length > 0 ? { images: imgs.map((i) => i.dataUrl) } : {}),
    };
    const placeholderId = makeId('m');
    const aiMsg: UIMsg = {
      id: placeholderId,
      role: 'assistant',
      content: '',
      pending: true,
    };

    // Eagerly clear the composer — if the POST fails we keep the error
    // local and the user can retype, but keeping the draft visible while
    // a pending create is in flight is worse UX than clearing now.
    setDraftEmpty('');
    setPendingImagesEmpty([]);
    setImageNoticeEmpty('');
    // Flip the "streaming" flag upfront so the send button disables
    // during the create round-trip. runStream's finally clause will
    // flip it back when the stream ends.
    setStreaming(true);
    let created: { id: number; title: string; updatedAt: number };
    try {
      const res = await createConversation({
        title: titleFrom(v),
        // Persist only the user's turn — the assistant placeholder is a
        // UI-only streaming artefact. If the user refreshes mid-stream
        // they'll see their question preserved without an empty AI bubble.
        messages: messagesForPersist([userMsg]),
      });
      created = {
        id: res.data.id,
        title: res.data.title,
        updatedAt: res.data.updated_at,
      };
    } catch {
      setStreaming(false);
      setImageNoticeEmpty('新建对话失败，请稍后重试');
      // Restore the user's draft so they don't have to retype.
      setDraftEmpty(v);
      setPendingImagesEmpty(imgs);
      return;
    }

    freshIdsRef.current.add(created.id);
    const newConv: Conversation = {
      id: created.id,
      title: created.title,
      messages: [userMsg, aiMsg],
      updatedAt: created.updatedAt,
      loaded: true,
    };
    setConversations((list) => [newConv, ...list]);
    navigate(`/ai/${created.id}`);
    void runStream(newConv, [userMsg, aiMsg], placeholderId, {
      webSearch: forceWebSearch && webSearchAvailable,
      useKnowledgeBase: useKnowledgeBase && knowledgeBaseAvailable,
    });
  };

  const sendFromConv = () => {
    if (!activeConv) return;
    const v = draftConv.trim();
    const imgs = pendingImagesConv;
    if ((!v && imgs.length === 0) || streaming) return;
    const userMsg: UIMsg = {
      id: makeId('m'),
      role: 'user',
      content: v,
      ...(imgs.length > 0 ? { images: imgs.map((i) => i.dataUrl) } : {}),
    };
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
    setPendingImagesConv([]);
    setImageNoticeConv('');
    // Save the user's turn immediately so a mid-stream refresh doesn't
    // drop the question. Fire-and-forget; the post-stream snapshot will
    // reconcile any transient failure.
    const msgsWithoutPlaceholder = [...activeConv.messages, userMsg];
    void updateConversation(activeConv.id, {
      messages: messagesForPersist(msgsWithoutPlaceholder),
    }).catch(() => {});
    void runStream(updated, nextMsgs, placeholderId, {
      webSearch: forceWebSearch && webSearchAvailable,
      useKnowledgeBase: useKnowledgeBase && knowledgeBaseAvailable,
    });
  };

  const stopStreaming = () => {
    abortRef.current?.abort();
  };

  /* =======================================================================
   * Render helpers
   * ===================================================================== */

  const renderMessage = (m: UIMsg) => {
    if (m.role === 'user') {
      const imgs = m.images || [];
      return (
        <div key={m.id} className="ai-msg-user">
          {imgs.length > 0 && (
            <div className="ai-msg-user-thumbs">
              {imgs.map((url, i) => (
                <div key={i} className="ai-msg-thumb">
                  <img src={url} alt={`image-${i + 1}`} />
                </div>
              ))}
            </div>
          )}
          {m.content && <div className="ai-bubble-user">{m.content}</div>}
        </div>
      );
    }

    // Streaming: reasoning is in-flight iff thinkingComplete is false AND
    // content hasn't started (contentStarted flips thinkingComplete → true).
    const hasReasoning = !!m.reasoning;
    const hasContent = !!m.content;
    const stillStreamingContent = !!m.pending && hasContent;

    const searches = m.searches || [];
    const kb = m.knowledgeBase;

    return (
      <div key={m.id} className="ai-msg-ai">
        {kb && <KnowledgeBubble call={kb} />}
        {searches.map((sc) => (
          <SearchBubble key={sc.id} call={sc} />
        ))}
        {hasReasoning && (
          <ThinkingBubble
            content={m.reasoning || ''}
            isComplete={!!m.thinkingComplete}
            isStopped={!!m.thinkingStopped}
            thinkingDuration={m.thinkingDuration ?? null}
          />
        )}
        {m.pending && !hasContent && !hasReasoning && searches.length === 0 && !kb && (
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
    const pendingImages = isEmpty ? pendingImagesEmpty : pendingImagesConv;
    const setPendingImages = isEmpty
      ? setPendingImagesEmpty
      : setPendingImagesConv;
    const fileInputRef = isEmpty ? fileInputEmptyRef : fileInputConvRef;
    const imageNotice = isEmpty ? imageNoticeEmpty : imageNoticeConv;
    const setImageNotice = isEmpty ? setImageNoticeEmpty : setImageNoticeConv;
    const dragHover = isEmpty ? dragHoverEmpty : dragHoverConv;
    const setDragHover = isEmpty ? setDragHoverEmpty : setDragHoverConv;
    const dragCounterRef = isEmpty ? dragCounterEmptyRef : dragCounterConvRef;
    const canSend =
      (value.trim().length > 0 || pendingImages.length > 0) && !streaming;
    const showStop = streaming && !isEmpty;
    const attachDisabled = !visionSupported;
    const attachTitle = !visionSupported
      ? '当前模型不支持图像输入，请先在「AI 模型配置」中开启或切换到支持视觉的模型'
      : pendingImages.length >= MAX_IMAGES
        ? `最多上传 ${MAX_IMAGES} 张图像`
        : '上传图像（最多 3 张）';

    const handleFiles = async (input: FileList | File[] | null) => {
      const all = input ? Array.from(input) : [];
      // Filter to images first so non-image drag/paste doesn't burn slots.
      const imageFiles = all.filter((f) => f.type.startsWith('image/'));
      if (imageFiles.length === 0) return;
      if (!visionSupported) {
        setImageNotice('当前模型不支持图像输入');
        return;
      }
      const remaining = MAX_IMAGES - pendingImages.length;
      if (remaining <= 0) {
        setImageNotice(`最多上传 ${MAX_IMAGES} 张图像`);
        return;
      }
      const picked = imageFiles.slice(0, remaining);
      const truncated = imageFiles.length > remaining;
      const accepted: PendingImage[] = [];
      for (const file of picked) {
        try {
          const dataUrl = await fileToDownscaledDataUrl(file);
          accepted.push({ id: makeId('img'), dataUrl });
        } catch {
          /* ignore single-file failures */
        }
      }
      if (accepted.length === 0) {
        setImageNotice('图像处理失败，请更换图片再试');
        return;
      }
      setPendingImages((arr) => [...arr, ...accepted].slice(0, MAX_IMAGES));
      setImageNotice(truncated ? `最多上传 ${MAX_IMAGES} 张图像` : '');
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      // Only intercept when the clipboard actually carries image files —
      // otherwise let the browser's default text paste through untouched.
      const items = e.clipboardData?.items;
      if (!items || items.length === 0) return;
      const files: File[] = [];
      for (const it of Array.from(items)) {
        if (it.kind !== 'file') continue;
        const f = it.getAsFile();
        if (f && f.type.startsWith('image/')) files.push(f);
      }
      if (files.length === 0) return;
      e.preventDefault();
      void handleFiles(files);
    };

    const dragHasFiles = (e: React.DragEvent<HTMLDivElement>) =>
      !!e.dataTransfer?.types?.includes('Files');

    const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
      if (!dragHasFiles(e)) return;
      e.preventDefault();
      dragCounterRef.current += 1;
      if (dragCounterRef.current === 1) setDragHover(true);
    };

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
      if (!dragHasFiles(e)) return;
      dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
      if (dragCounterRef.current === 0) setDragHover(false);
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
      const files = e.dataTransfer?.files;
      // Always reset drag state on drop, even when no files are present.
      dragCounterRef.current = 0;
      setDragHover(false);
      if (!files || files.length === 0) return;
      // Only intercept image drops — let the browser handle anything else
      // (text drags, etc.) so we don't break unrelated drop targets.
      const hasImage = Array.from(files).some((f) =>
        f.type.startsWith('image/'),
      );
      if (!hasImage) return;
      e.preventDefault();
      e.stopPropagation();
      void handleFiles(files);
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
      // Showing the copy cursor + suppressing the browser's default
      // "open this image in a new tab" behavior requires preventDefault
      // on every dragover, even before the drop fires.
      if (dragHasFiles(e)) {
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
      }
    };

    const removeImage = (id: string) => {
      setPendingImages((arr) => arr.filter((i) => i.id !== id));
      setImageNotice('');
    };
    const searchDisabled = !webSearchAvailable;
    const searchTitle = searchDisabled
      ? '联网搜索不可用（未配置 BRAVE_API_KEY）'
      : forceWebSearch
        ? '已开启联网搜索：回答时将强制调用搜索'
        : '开启联网搜索：让 AI 在回答时查询最新网络信息';
    const kbDisabled = !knowledgeBaseAvailable;
    const kbTitle = kbDisabled
      ? '知识库不可用（未配置 Embedding API Key）'
      : useKnowledgeBase
        ? '已开启知识库：回答时将引用所属角色的知识库内容'
        : '开启知识库：在作答前检索你所属角色的知识库内容';

    return (
      <div className="ai-composer-wrap">
        <div
          className={`ai-composer${dragHover ? ' dragging' : ''}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
        >
          {dragHover && (
            <div className="ai-composer-drop-hint" aria-hidden>
              <span className="ai-composer-drop-hint-inner">
                {visionSupported
                  ? '松开鼠标以上传图片'
                  : '当前模型不支持图像输入'}
              </span>
            </div>
          )}
          {pendingImages.length > 0 && (
            <div className="ai-thumb-strip">
              {pendingImages.map((img) => (
                <div key={img.id} className="ai-thumb">
                  <img src={img.dataUrl} alt="" />
                  <button
                    type="button"
                    className="ai-thumb-remove"
                    title="移除图像"
                    aria-label="移除图像"
                    onClick={() => removeImage(img.id)}
                  >
                    <IcoX />
                  </button>
                </div>
              ))}
            </div>
          )}
          {imageNotice && (
            <div className="ai-thumb-notice" role="status">
              {imageNotice}
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              void handleFiles(e.target.files);
              // Reset so picking the same file twice still triggers onChange.
              e.target.value = '';
            }}
          />
          <textarea
            ref={taRef}
            className="ai-ta"
            rows={1}
            placeholder={isEmpty ? '今天我能帮你做些什么？' : '回复…'}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onPaste={handlePaste}
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
                title={attachTitle}
                type="button"
                disabled={attachDisabled || pendingImages.length >= MAX_IMAGES}
                onClick={() => fileInputRef.current?.click()}
                style={
                  attachDisabled
                    ? { opacity: 0.45, cursor: 'not-allowed' }
                    : undefined
                }
              >
                <IcoPlusSm />
              </button>
              <button
                className={`ai-pill v-search${forceWebSearch && !searchDisabled ? ' on' : ''}`}
                title={searchTitle}
                type="button"
                disabled={searchDisabled}
                aria-pressed={forceWebSearch && !searchDisabled}
                onClick={() => {
                  if (searchDisabled) return;
                  setForceWebSearch((v) => !v);
                }}
                style={
                  searchDisabled
                    ? { opacity: 0.45, cursor: 'not-allowed' }
                    : undefined
                }
              >
                <span className="ai-icon-wrap">
                  <IcoGlobe />
                </span>
                <span className="ai-label">联网搜索</span>
              </button>
              <button
                className={`ai-pill v-kb${useKnowledgeBase && !kbDisabled ? ' on' : ''}`}
                title={kbTitle}
                type="button"
                disabled={kbDisabled}
                aria-pressed={useKnowledgeBase && !kbDisabled}
                onClick={() => {
                  if (kbDisabled) return;
                  setUseKnowledgeBase((v) => !v);
                }}
                style={
                  kbDisabled
                    ? { opacity: 0.45, cursor: 'not-allowed' }
                    : undefined
                }
              >
                <span className="ai-icon-wrap">
                  <IcoKb />
                </span>
                <span className="ai-label">知识库</span>
              </button>
            </div>
            <div className="ai-actions-right">
              <div data-ai-model-pop className="ai-model-pop">
                <button
                  type="button"
                  className={`ai-model${modelMenuOpen ? ' open' : ''}`}
                  title="切换模型"
                  onClick={() => setModelMenuOpen((v) => !v)}
                  disabled={models.length === 0}
                  aria-haspopup="listbox"
                  aria-expanded={modelMenuOpen}
                >
                  <b>{modelDisplay}</b>
                  <span className="ai-tag">Chat</span>
                  <span className="ai-model-caret">
                    <IcoCaretDown />
                  </span>
                </button>
                <AnimatePresence>
                  {modelMenuOpen && models.length > 0 && (
                    <motion.div
                      key="ai-model-menu"
                      role="listbox"
                      className={`ai-model-menu${!isEmpty ? ' drop-up' : ''}`}
                      // Empty (centered) composer: menu drops DOWN from the
                      // button. Conversation composer is at the bottom of
                      // the viewport, so drop UP instead and flip the
                      // intro/outro offset to match.
                      initial={{
                        opacity: 0,
                        y: isEmpty ? -6 : 6,
                        scale: 0.96,
                      }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{
                        opacity: 0,
                        y: isEmpty ? -4 : 4,
                        scale: 0.97,
                      }}
                      transition={{
                        duration: 0.18,
                        ease: [0.22, 0.61, 0.36, 1],
                      }}
                    >
                      <div className="ai-model-menu-inner">
                        {orderedModels.map((m) => {
                          const isActive = m.model === selectedModel;
                          return (
                            <button
                              key={m.model}
                              type="button"
                              role="option"
                              aria-selected={isActive}
                              className={`ai-model-option${isActive ? ' active' : ''}`}
                              onClick={() => {
                                setSelectedModel(m.model);
                                setModelMenuOpen(false);
                              }}
                            >
                              <span className="ai-model-option-name">
                                {m.display_name || m.model}
                              </span>
                              {isActive && (
                                <span
                                  aria-hidden
                                  className="ai-model-option-dot"
                                />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
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
            {presetChips.map((c) => (
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
                {historyLoading
                  ? '正在加载历史对话…'
                  : historyError || '还没有历史对话'}
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
