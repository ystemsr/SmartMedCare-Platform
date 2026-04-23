import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { renderMarkdownPlain } from './markdown';

const BLOCK_MATH_PLACEHOLDER_CLASS = 'block-math-placeholder';
const INLINE_MATH_PLACEHOLDER_CLASS = 'inline-math-placeholder';

const BLOCK_SENTINEL_PREFIX = 'XxMATHBLOCKXx';
const BLOCK_SENTINEL_SUFFIX = 'XxENDBLOCKXx';
const INLINE_SENTINEL_PREFIX = 'XxMATHINLINEXx';
const INLINE_SENTINEL_SUFFIX = 'XxENDINLINEXx';

const blockSentinel = (k: string) =>
  `${BLOCK_SENTINEL_PREFIX}${k}${BLOCK_SENTINEL_SUFFIX}`;
const inlineSentinel = (k: string) =>
  `${INLINE_SENTINEL_PREFIX}${k}${INLINE_SENTINEL_SUFFIX}`;

const BLOCK_SENTINEL_RE = new RegExp(
  `${BLOCK_SENTINEL_PREFIX}([A-Za-z0-9]+)${BLOCK_SENTINEL_SUFFIX}`,
  'g',
);
const INLINE_SENTINEL_RE = new RegExp(
  `${INLINE_SENTINEL_PREFIX}([A-Za-z0-9]+)${INLINE_SENTINEL_SUFFIX}`,
  'g',
);
const PARA_BLOCK_SENTINEL_RE = new RegExp(
  `<p>\\s*${BLOCK_SENTINEL_PREFIX}([A-Za-z0-9]+)${BLOCK_SENTINEL_SUFFIX}\\s*</p>`,
  'g',
);

interface MathSegment {
  key: string;
  latex: string;
  display: boolean;
}

interface MathCacheEntry {
  latex: string;
  html: string;
}

/**
 * Walk the markdown source char-by-char, pulling out `$$...$$` block
 * math and `$...$` inline math into `segments` and replacing each with
 * an ASCII sentinel that markdown-it will pass through verbatim.
 */
function extractMathFromSource(src: string): {
  stripped: string;
  segments: MathSegment[];
} {
  const segments: MathSegment[] = [];
  if (!src) return { stripped: '', segments };

  let out = '';
  let i = 0;
  const n = src.length;
  const isAlnum = (ch: string) => /[A-Za-z0-9]/.test(ch);

  while (i < n) {
    const ch = src[i];

    if (ch === '\\' && i + 1 < n) {
      out += ch + src[i + 1];
      i += 2;
      continue;
    }

    if (ch === '$' && src[i + 1] === '$') {
      let j = i + 2;
      let closed = -1;
      while (j < n - 1) {
        if (src[j] === '\\' && j + 1 < n) {
          j += 2;
          continue;
        }
        if (src[j] === '$' && src[j + 1] === '$') {
          closed = j;
          break;
        }
        j++;
      }
      if (closed !== -1) {
        const latex = src
          .slice(i + 2, closed)
          .replace(/^\n+|\n+$/g, '')
          .trim();
        const key = `b${segments.length}`;
        segments.push({ key, latex, display: true });
        out += blockSentinel(key);
        i = closed + 2;
        continue;
      }
      out += ch;
      i++;
      continue;
    }

    if (ch === '$') {
      const prev = i > 0 ? src[i - 1] : '';
      const next = src[i + 1] || '';
      if (isAlnum(prev) && isAlnum(next)) {
        out += ch;
        i++;
        continue;
      }
      let j = i + 1;
      let closed = -1;
      while (j < n) {
        if (src[j] === '\\' && j + 1 < n) {
          j += 2;
          continue;
        }
        if (src[j] === '\n') break;
        if (src[j] === '$') {
          if (src[j + 1] === '$') break;
          closed = j;
          break;
        }
        j++;
      }
      if (closed !== -1) {
        const latex = src.slice(i + 1, closed).trim();
        if (latex) {
          const key = `i${segments.length}`;
          segments.push({ key, latex, display: false });
          out += inlineSentinel(key);
          i = closed + 1;
          continue;
        }
      }
      out += ch;
      i++;
      continue;
    }

    out += ch;
    i++;
  }

  return { stripped: out, segments };
}

function insertMathPlaceholders(html: string): string {
  let out = html.replace(
    PARA_BLOCK_SENTINEL_RE,
    (_m, key) =>
      `<div class="${BLOCK_MATH_PLACEHOLDER_CLASS}" data-math-key="${key}"></div>`,
  );
  out = out.replace(
    BLOCK_SENTINEL_RE,
    (_m, key) =>
      `<div class="${BLOCK_MATH_PLACEHOLDER_CLASS}" data-math-key="${key}"></div>`,
  );
  out = out.replace(
    INLINE_SENTINEL_RE,
    (_m, key) =>
      `<span class="${INLINE_MATH_PLACEHOLDER_CLASS}" data-math-key="${key}"></span>`,
  );
  return out;
}

interface MarkdownStreamProps {
  content: string;
  isStreaming: boolean;
  showCursor?: boolean;
}

const MarkdownStream: React.FC<MarkdownStreamProps> = ({
  content,
  isStreaming,
  showCursor = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const blockMathCacheRef = useRef<Map<string, MathCacheEntry>>(new Map());
  const inlineMathCacheRef = useRef<Map<string, MathCacheEntry>>(new Map());

  const { html: readyHtml, segments } = useMemo(() => {
    const { stripped, segments: segs } = extractMathFromSource(content || '');
    const rendered = renderMarkdownPlain(stripped);
    return { html: insertMathPlaceholders(rendered), segments: segs };
  }, [content]);

  const hydrateMath = useCallback((segs: MathSegment[]) => {
    const container = containerRef.current;
    if (!container) return;
    const segmentMap = new Map<string, MathSegment>();
    segs.forEach((s) => segmentMap.set(s.key, s));

    const fill = (
      el: Element,
      seg: MathSegment,
      cache: Map<string, MathCacheEntry>,
    ) => {
      const latex = seg.latex.replace(/\r/g, '');
      const cached = cache.get(seg.key);
      if (cached && cached.latex === latex && cached.html) {
        if (el.innerHTML !== cached.html) el.innerHTML = cached.html;
        return;
      }
      if (!latex.trim()) {
        el.textContent = seg.latex;
        return;
      }
      try {
        const rendered = katex.renderToString(latex, {
          displayMode: seg.display,
          throwOnError: false,
          strict: 'warn',
        });
        cache.set(seg.key, { latex, html: rendered });
        el.innerHTML = rendered;
      } catch {
        if (cached?.html) el.innerHTML = cached.html;
        else el.textContent = seg.latex;
      }
    };

    container
      .querySelectorAll<HTMLElement>(`.${BLOCK_MATH_PLACEHOLDER_CLASS}`)
      .forEach((el) => {
        const key = el.getAttribute('data-math-key');
        const seg = key ? segmentMap.get(key) : null;
        if (seg) fill(el, seg, blockMathCacheRef.current);
      });
    container
      .querySelectorAll<HTMLElement>(`.${INLINE_MATH_PLACEHOLDER_CLASS}`)
      .forEach((el) => {
        const key = el.getAttribute('data-math-key');
        const seg = key ? segmentMap.get(key) : null;
        if (seg) fill(el, seg, inlineMathCacheRef.current);
      });
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.innerHTML = readyHtml;
    hydrateMath(segments);

    if (showCursor && isStreaming) {
      const cursor = document.createElement('span');
      cursor.className = 'ai-cursor';
      container.appendChild(cursor);
    }
  }, [readyHtml, segments, isStreaming, showCursor, hydrateMath]);

  return <div ref={containerRef} className="ai-body" />;
};

export default MarkdownStream;
