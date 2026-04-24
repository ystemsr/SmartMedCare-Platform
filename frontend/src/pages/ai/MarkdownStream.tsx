import React from 'react';
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

interface MarkdownStreamProps {
  content: string;
  isStreaming: boolean;
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
    ...props
  }: React.ComponentProps<'a'>) => (
    <a
      {...props}
      href={href}
      rel={rel ?? 'noopener noreferrer'}
      target={target ?? '_blank'}
    />
  ),
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

const MarkdownStream: React.FC<MarkdownStreamProps> = ({ content, isStreaming }) => (
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
      {content}
    </Streamdown>
  </div>
);

export default MarkdownStream;
