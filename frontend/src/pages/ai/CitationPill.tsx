import React, { useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

interface CitationPillProps {
  href: string;
  label: string;
}

const MAX_LABEL_CHARS = 18;

function hostFrom(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function faviconFor(url: string): string | null {
  try {
    const host = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?sz=32&domain=${host}`;
  } catch {
    return null;
  }
}

/**
 * Compact inline citation rendered in place of the model's
 * `[source: "...", url: "..."]` markers. Smaller than surrounding text
 * and styled as a subtle pill. Hovering reveals a floating card with
 * the full title and host so the user can verify the source without
 * leaving the reply.
 */
const CitationPill: React.FC<CitationPillProps> = ({ href, label }) => {
  const [hover, setHover] = useState(false);
  const hoverTimer = useRef<number | null>(null);
  const cleanLabel = (label || '').trim() || hostFrom(href) || 'source';
  const truncated = useMemo(() => {
    const chars = Array.from(cleanLabel);
    if (chars.length <= MAX_LABEL_CHARS) return cleanLabel;
    return chars.slice(0, MAX_LABEL_CHARS - 1).join('') + '…';
  }, [cleanLabel]);
  const host = useMemo(() => hostFrom(href), [href]);
  const favicon = useMemo(() => faviconFor(href), [href]);

  const openHover = () => {
    if (hoverTimer.current !== null) {
      window.clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
    setHover(true);
  };
  // A tiny trailing delay keeps the card visible while the cursor
  // traverses the ~6px gap between pill and card.
  const closeHover = () => {
    if (hoverTimer.current !== null) {
      window.clearTimeout(hoverTimer.current);
    }
    hoverTimer.current = window.setTimeout(() => {
      setHover(false);
      hoverTimer.current = null;
    }, 120);
  };

  return (
    <span
      className="ai-cite-wrap"
      onMouseEnter={openHover}
      onMouseLeave={closeHover}
      onFocus={openHover}
      onBlur={closeHover}
    >
      <a
        className="ai-cite"
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        title={cleanLabel}
      >
        <span className="ai-cite-icon" aria-hidden>
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
            <path d="M2 12h20" />
          </svg>
        </span>
        <span className="ai-cite-label">{truncated}</span>
      </a>
      <AnimatePresence>
        {hover && (
          <motion.span
            key="cite-card"
            className="ai-cite-card"
            /* `x: '-50%'` keeps the card horizontally centered over the
             * pill — framer-motion composes its own inline transform,
             * which would otherwise wipe out any translateX from CSS. */
            initial={{ opacity: 0, y: 4, scale: 0.97, x: '-50%' }}
            animate={{ opacity: 1, y: 0, scale: 1, x: '-50%' }}
            exit={{ opacity: 0, y: 2, scale: 0.98, x: '-50%' }}
            transition={{ duration: 0.16, ease: [0.22, 0.61, 0.36, 1] }}
            onMouseEnter={openHover}
            onMouseLeave={closeHover}
          >
            <span className="ai-cite-card-row">
              {favicon && (
                <img
                  className="ai-cite-card-fav"
                  src={favicon}
                  alt=""
                  loading="lazy"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                  }}
                />
              )}
              <span className="ai-cite-card-host">{host}</span>
            </span>
            <span className="ai-cite-card-title">{cleanLabel}</span>
            <span className="ai-cite-card-url">{href}</span>
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
};

export default CitationPill;
