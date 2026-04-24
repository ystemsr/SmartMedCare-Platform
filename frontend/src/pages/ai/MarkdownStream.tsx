import React, { useMemo } from 'react';
import { cjk } from '@streamdown/cjk';
import { code } from '@streamdown/code';
import { createMathPlugin } from '@streamdown/math';
import { mermaid } from '@streamdown/mermaid';
import 'katex/dist/katex.min.css';
import {
  Streamdown,
  type ControlsConfig,
  type StreamdownProps,
  type StreamdownTranslations,
} from 'streamdown';
import CitationPill from './CitationPill';

interface MarkdownStreamProps {
  content: string;
  isStreaming: boolean;
}

/* The model emits citations exactly as:
 *   [source: "Title", url: "https://..."]
 * We rewrite each match into a regular markdown link whose URL carries
 * a sentinel query param; the `a` component override then detects the
 * sentinel and hands rendering off to <CitationPill>. Keeping this as
 * a pre-pass (rather than a post-render DOM walk) preserves live
 * streaming — partially-arrived citations stay as plain text until the
 * closing `]` lands, then swap to the pill atomically. */
const CITATION_RE =
  /\[source:\s*"([^"\n]+?)",\s*url:\s*"([^"\s)]+?)"\]/g;
const CITE_SENTINEL = '__smc_cite__';

function escapeLinkText(text: string): string {
  // Markdown chars that would otherwise break the link syntax. Whitespace
  // collapsing is intentional — citation titles shouldn't contain newlines.
  return text
    .replace(/\\/g, '\\\\')
    .replace(/([[\]()])/g, '\\$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function addSentinel(url: string): string {
  // Append the sentinel as a query flag; preserve any existing hash.
  const hashIdx = url.indexOf('#');
  const hash = hashIdx === -1 ? '' : url.slice(hashIdx);
  const base = hashIdx === -1 ? url : url.slice(0, hashIdx);
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}${CITE_SENTINEL}=1${hash}`;
}

function stripSentinel(url: string): string {
  // Remove our sentinel and tidy up leftover separator punctuation.
  let out = url.replace(
    new RegExp(`([?&])${CITE_SENTINEL}=1(?=&|#|$)`),
    (_m, sep: string) => (sep === '?' ? '?' : ''),
  );
  out = out.replace(/\?(?=#|$)/, '');
  return out;
}

function processCitations(raw: string): string {
  if (!raw || raw.indexOf('[source:') === -1) return raw;
  return raw.replace(CITATION_RE, (_m, title: string, url: string) => {
    return `[${escapeLinkText(title)}](${addSentinel(url.trim())})`;
  });
}

function extractText(node: React.ReactNode): string {
  if (node === null || node === undefined || node === false) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractText).join('');
  if (React.isValidElement(node)) {
    const childProps = (node as React.ReactElement<{ children?: React.ReactNode }>).props;
    return extractText(childProps?.children);
  }
  return '';
}

function isCitationHref(href: string | undefined): boolean {
  if (!href) return false;
  return new RegExp(`[?&]${CITE_SENTINEL}=1(?:&|#|$)`).test(href);
}

const STREAMDOWN_PLUGINS = {
  cjk,
  code,
  math: createMathPlugin({ singleDollarTextMath: true }),
  mermaid,
};

const STREAMDOWN_CONTROLS: ControlsConfig = {
  code: {
    copy: true,
    download: true,
  },
  table: {
    copy: true,
    download: true,
    fullscreen: true,
  },
  mermaid: {
    copy: true,
    download: true,
    fullscreen: true,
    panZoom: true,
  },
};

const STREAMDOWN_TRANSLATIONS: Partial<StreamdownTranslations> = {
  close: '关闭',
  copied: '已复制',
  copyCode: '复制代码',
  copyLink: '复制链接',
  copyTable: '复制表格',
  copyTableAsCsv: '复制为 CSV',
  copyTableAsMarkdown: '复制为 Markdown',
  copyTableAsTsv: '复制为 TSV',
  downloadDiagram: '下载图表',
  downloadDiagramAsMmd: '下载 Mermaid 源码',
  downloadDiagramAsPng: '下载为 PNG',
  downloadDiagramAsSvg: '下载为 SVG',
  downloadFile: '下载文件',
  downloadImage: '下载图片',
  downloadTable: '下载表格',
  downloadTableAsCsv: '下载为 CSV',
  downloadTableAsMarkdown: '下载为 Markdown',
  externalLinkWarning: '即将打开外部链接，请确认来源可信。',
  imageNotAvailable: '图片暂不可用',
  mermaidFormatMmd: 'Mermaid 源码',
  mermaidFormatPng: 'PNG',
  mermaidFormatSvg: 'SVG',
  openExternalLink: '打开外部链接',
  openLink: '打开链接',
  tableFormatCsv: 'CSV',
  tableFormatMarkdown: 'Markdown',
  tableFormatTsv: 'TSV',
  viewFullscreen: '全屏查看',
  exitFullscreen: '退出全屏',
};

const STREAMDOWN_LINK_COMPONENT = {
  a: ({
    href,
    rel,
    target,
    children,
    ...props
  }: React.ComponentProps<'a'>) => {
    if (isCitationHref(href)) {
      const cleanHref = stripSentinel(href as string);
      const label = extractText(children);
      return <CitationPill href={cleanHref} label={label} />;
    }
    return (
      <a
        {...props}
        href={href}
        rel={rel ?? 'noopener noreferrer'}
        target={target ?? '_blank'}
      >
        {children}
      </a>
    );
  },
};

const STREAMING_ANIMATION: NonNullable<StreamdownProps['animated']> = {
  animation: 'fadeIn',
  duration: 180,
  easing: 'ease-out',
  sep: 'char',
  stagger: 12,
};

const STREAMDOWN_MERMAID: StreamdownProps['mermaid'] = {
  config: {
    theme: 'neutral',
    securityLevel: 'strict',
    fontFamily:
      'JetBrains Mono, SFMono-Regular, SF Mono, ui-monospace, monospace',
  },
};

const MarkdownStream: React.FC<MarkdownStreamProps> = ({ content, isStreaming }) => {
  const processed = useMemo(() => processCitations(content), [content]);
  return (
    <div className="ai-body">
      <Streamdown
        animated={STREAMING_ANIMATION}
        caret={isStreaming ? 'block' : undefined}
        className="ai-streamdown"
        components={STREAMDOWN_LINK_COMPONENT}
        controls={STREAMDOWN_CONTROLS}
        dir="auto"
        isAnimating={isStreaming}
        lineNumbers
        mermaid={STREAMDOWN_MERMAID}
        plugins={STREAMDOWN_PLUGINS}
        shikiTheme={['github-light', 'github-dark']}
        translations={STREAMDOWN_TRANSLATIONS}
      >
        {processed}
      </Streamdown>
    </div>
  );
};

export default MarkdownStream;
