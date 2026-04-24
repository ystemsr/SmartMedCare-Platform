import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import type { SearchGroup, SearchResult } from '../../api/ai';

export interface SearchCall {
  id: string;
  queries: string[];
  status: 'pending' | 'done' | 'error';
  groups?: SearchGroup[];
}

interface SearchBubbleProps {
  call: SearchCall;
}

const GlobeIcon: React.FC = () => (
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
    <circle cx="12" cy="12" r="10" />
    <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
    <path d="M2 12h20" />
  </svg>
);

function faviconFor(r: SearchResult): string | null {
  if (r.favicon) return r.favicon;
  try {
    const host = new URL(r.url).hostname;
    return `https://www.google.com/s2/favicons?sz=32&domain=${host}`;
  } catch {
    return null;
  }
}

function hostFrom(r: SearchResult): string {
  if (r.hostname) return r.hostname;
  try {
    return new URL(r.url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function summarizeQueries(queries: string[]): string {
  if (queries.length === 0) return '';
  if (queries.length === 1) return `「${queries[0]}」`;
  if (queries.length <= 3) {
    return queries.map((q) => `「${q}」`).join('、');
  }
  return `${queries.length} 个关键词`;
}

/**
 * Collapsible card shown above the assistant reply whenever the model
 * invoked `brave_search`. A single tool call can now fan out across
 * multiple queries, so the expanded state renders one section per query.
 */
const SearchBubble: React.FC<SearchBubbleProps> = ({ call }) => {
  const [expanded, setExpanded] = useState(false);
  const groups = call.groups || [];
  const totalResults = useMemo(
    () => groups.reduce((n, g) => n + (g.results?.length || 0), 0),
    [groups],
  );

  const statusLabel = useMemo(() => {
    const qs = summarizeQueries(call.queries);
    if (call.status === 'pending') {
      return qs ? `正在联网搜索 ${qs}` : '正在联网搜索';
    }
    if (call.status === 'error') {
      return qs ? `搜索 ${qs} 失败` : '搜索失败';
    }
    if (totalResults === 0) {
      return qs ? `已搜索 ${qs} · 无结果` : '已搜索 · 无结果';
    }
    return qs
      ? `已搜索 ${qs} · ${totalResults} 条结果`
      : `已搜索 · ${totalResults} 条结果`;
  }, [call.status, call.queries, totalResults]);

  const pending = call.status === 'pending';
  const disabled = pending || totalResults === 0;

  const onHeaderClick = (e: React.MouseEvent) => {
    if (disabled) return;
    e.stopPropagation();
    setExpanded((v) => !v);
  };

  return (
    <div className="ai-search-wrap">
      <div className={`ai-search${expanded ? ' expanded' : ''}`}>
        <div
          className={`ai-search-head${disabled ? '' : ' clickable'}`}
          onClick={onHeaderClick}
        >
          {pending ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              className="ai-search-spinner"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
              </svg>
            </motion.div>
          ) : (
            <span className="ai-search-globe">
              <GlobeIcon />
            </span>
          )}
          <span className="ai-search-label">{statusLabel}</span>
          {!disabled && (
            <motion.span
              animate={{ rotate: expanded ? 180 : 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="ai-search-caret"
            >
              <ChevronDown size={14} strokeWidth={2.5} />
            </motion.span>
          )}
        </div>

        <AnimatePresence initial={false}>
          {expanded && totalResults > 0 && (
            <motion.div
              key="search-details"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="ai-search-details-wrap"
            >
              <div className="ai-search-details">
                {groups.map((g, gi) => {
                  const results = g.results || [];
                  if (results.length === 0) return null;
                  return (
                    <div key={`${call.id}-g-${gi}`} className="ai-search-group">
                      {groups.length > 1 && (
                        <div className="ai-search-group-head">
                          <span className="ai-search-group-q">{g.query}</span>
                          <span className="ai-search-group-count">
                            {results.length} 条
                          </span>
                        </div>
                      )}
                      {results.map((r, i) => {
                        const host = hostFrom(r);
                        const fav = faviconFor(r);
                        return (
                          <a
                            key={`${call.id}-${gi}-${i}`}
                            href={r.url}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="ai-search-item"
                            title={r.url}
                          >
                            <span className="ai-search-item-idx">{i + 1}</span>
                            <span className="ai-search-item-body">
                              <span className="ai-search-item-title">
                                {r.title || host || r.url}
                              </span>
                              {r.description && (
                                <span className="ai-search-item-desc">
                                  {r.description}
                                </span>
                              )}
                              <span className="ai-search-item-meta">
                                {fav && (
                                  <img
                                    className="ai-search-item-fav"
                                    src={fav}
                                    alt=""
                                    loading="lazy"
                                    onError={(e) => {
                                      (e.currentTarget as HTMLImageElement).style.display =
                                        'none';
                                    }}
                                  />
                                )}
                                <span className="ai-search-item-host">
                                  {host}
                                </span>
                                {r.age && (
                                  <span className="ai-search-item-age">
                                    · {r.age}
                                  </span>
                                )}
                              </span>
                            </span>
                          </a>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default SearchBubble;
