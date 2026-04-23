import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

interface ThinkingBubbleProps {
  content: string;
  isComplete?: boolean;
  isStopped?: boolean;
  thinkingDuration?: number | null;
}

/**
 * Independent "thinking" bubble shown above the assistant's final reply.
 * Pattern adapted from the reference implementation:
 *  - Spinning indicator while in progress
 *  - Live elapsed-seconds counter that freezes on completion/stop
 *  - Whole area clickable to expand when collapsed; header-only to collapse
 *  - AnimatePresence height/opacity transition for details
 */
const ThinkingBubble: React.FC<ThinkingBubbleProps> = ({
  content,
  isComplete = false,
  isStopped = false,
  thinkingDuration = null,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const detailsRef = React.useRef<HTMLDivElement>(null);

  // Auto-scroll the reasoning details to its own bottom as new tokens
  // arrive, so the latest reasoning stays visible while thinking.
  useEffect(() => {
    if (!isExpanded) return;
    const el = detailsRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [content, isExpanded]);
  const [startTime] = useState(() => Date.now());
  const [elapsedTime, setElapsedTime] = useState<number>(
    thinkingDuration ?? 0,
  );

  useEffect(() => {
    if (thinkingDuration !== null && thinkingDuration !== undefined) {
      setElapsedTime(thinkingDuration);
      return;
    }
    if (isComplete || isStopped) {
      setElapsedTime((Date.now() - startTime) / 1000);
      return;
    }
    const timer = window.setInterval(() => {
      setElapsedTime((Date.now() - startTime) / 1000);
    }, 100);
    return () => window.clearInterval(timer);
  }, [isComplete, isStopped, startTime, thinkingDuration]);

  const statusLabel = isStopped
    ? '已停止思考'
    : isComplete
      ? elapsedTime > 0
        ? `已思考 ${elapsedTime.toFixed(1)}s`
        : '已思考'
      : '思考中';

  const handleContainerClick = (e: React.MouseEvent) => {
    if (!isExpanded) {
      e.stopPropagation();
      setIsExpanded(true);
    }
  };
  const handleHeaderClick = (e: React.MouseEvent) => {
    if (isExpanded) {
      e.stopPropagation();
      setIsExpanded(false);
    }
  };

  return (
    <div className="ai-think-wrap">
      <div
        className={`ai-think${isExpanded ? ' expanded' : ''}`}
        onClick={handleContainerClick}
        style={{ cursor: isExpanded ? 'default' : 'pointer' }}
      >
        <div
          onClick={handleHeaderClick}
          className={`ai-think-head${isExpanded ? ' clickable' : ''}`}
        >
          {!isComplete && !isStopped && (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              className="ai-think-spinner"
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
          )}
          <span className="ai-think-label">{statusLabel}</span>
          <motion.span
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="ai-think-caret"
          >
            <ChevronDown size={14} strokeWidth={2.5} />
          </motion.span>
        </div>
        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.div
              key="think-details"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="ai-think-details-wrap"
            >
              <div className="ai-think-details" ref={detailsRef}>
                {(content || '').replace(/^\n+/, '') || '…'}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default ThinkingBubble;
