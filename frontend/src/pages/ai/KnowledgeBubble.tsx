import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import type { KnowledgeBaseHit } from '../../api/ai';

export interface KnowledgeBaseCall {
  id: string;
  query: string;
  hits: KnowledgeBaseHit[];
}

interface KnowledgeBubbleProps {
  call: KnowledgeBaseCall;
}

const BookIcon: React.FC = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
  </svg>
);

function formatScore(score: number): string {
  if (!Number.isFinite(score)) return '';
  const pct = Math.round(score * 100);
  return `${pct}%`;
}

function truncate(text: string, max = 220): string {
  const clean = (text || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max)}…`;
}

/**
 * Collapsible card shown above the assistant reply whenever the model's
 * answer was informed by the RAG knowledge base. Mirrors SearchBubble's
 * visual language so both sources of "external context" feel unified.
 */
const KnowledgeBubble: React.FC<KnowledgeBubbleProps> = ({ call }) => {
  const [expanded, setExpanded] = useState(false);
  const hits = call.hits || [];

  const statusLabel = useMemo(() => {
    if (hits.length === 0) {
      return '已查询知识库 · 无相关内容';
    }
    return `已引用知识库 · ${hits.length} 段上下文`;
  }, [hits.length]);

  const disabled = hits.length === 0;

  const onHeaderClick = (e: React.MouseEvent) => {
    if (disabled) return;
    e.stopPropagation();
    setExpanded((v) => !v);
  };

  return (
    <div className="ai-kb-wrap">
      <div className={`ai-kb${expanded ? ' expanded' : ''}`}>
        <div
          className={`ai-kb-head${disabled ? '' : ' clickable'}`}
          onClick={onHeaderClick}
        >
          <span className="ai-kb-icon">
            <BookIcon />
          </span>
          <span className="ai-kb-label">{statusLabel}</span>
          {!disabled && (
            <motion.span
              animate={{ rotate: expanded ? 180 : 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="ai-kb-caret"
            >
              <ChevronDown size={14} strokeWidth={2.5} />
            </motion.span>
          )}
        </div>

        <AnimatePresence initial={false}>
          {expanded && hits.length > 0 && (
            <motion.div
              key="kb-details"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="ai-kb-details-wrap"
            >
              <div className="ai-kb-details">
                {hits.map((h, i) => (
                  <div key={`${call.id}-h-${i}`} className="ai-kb-item">
                    <span className="ai-kb-item-idx">{i + 1}</span>
                    <span className="ai-kb-item-body">
                      <span className="ai-kb-item-title">
                        {h.document_name || '（未命名文档）'}
                        {h.chunk_index != null && (
                          <span className="ai-kb-item-chunk">
                            · 片段 #{h.chunk_index}
                          </span>
                        )}
                      </span>
                      <span className="ai-kb-item-desc">
                        {truncate(h.content)}
                      </span>
                      <span className="ai-kb-item-meta">
                        <span className="ai-kb-item-score">
                          相关度 {formatScore(h.score)}
                        </span>
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default KnowledgeBubble;
