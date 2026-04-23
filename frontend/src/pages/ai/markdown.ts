import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js';
import 'highlight.js/styles/atom-one-light.css';

/**
 * Markdown renderer WITHOUT math handling — math segments are extracted
 * up-front by `MarkdownStream.extractMathSegments` and hydrated with
 * cached `katex.renderToString` output after the markdown pass. This keeps
 * the per-token re-render cost flat even when the stream grows.
 */
const md: MarkdownIt = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
  typographer: false,
  highlight(str, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return (
          '<pre><code class="hljs language-' +
          lang +
          '">' +
          hljs.highlight(str, { language: lang, ignoreIllegals: true }).value +
          '</code></pre>'
        );
      } catch {
        /* fall through */
      }
    }
    return '<pre><code class="hljs">' + md.utils.escapeHtml(str) + '</code></pre>';
  },
});

const defaultLinkRender =
  md.renderer.rules.link_open ||
  function (tokens, idx, options, _env, self) {
    return self.renderToken(tokens, idx, options);
  };
md.renderer.rules.link_open = function (tokens, idx, options, env, self) {
  const token = tokens[idx];
  if (token.attrIndex('target') < 0) token.attrPush(['target', '_blank']);
  if (token.attrIndex('rel') < 0) token.attrPush(['rel', 'noopener noreferrer']);
  return defaultLinkRender(tokens, idx, options, env, self);
};

/** Plain markdown render — used by MarkdownStream after math extraction. */
export function renderMarkdownPlain(src: string): string {
  if (!src) return '';
  return md.render(src);
}
