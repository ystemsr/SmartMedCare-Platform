# Chinese Typography Guidelines

The visual quality of the English interface comes from the mixed strategy of
**serif headings + sans-serif UI**.
This file explains how to adapt the same strategy to Simplified Chinese interfaces
and avoid the visual discontinuity that often appears in mixed Chinese-English text.

---

## Contents

1. [Root Problem](#problem)
2. [Font Selection](#font-selection)
3. [Import Methods](#import)
4. [CSS Token Overrides](#tokens)
5. [Mixed-Script Font Stacks](#mixed-stack)
6. [Chinese Typography Details](#details)
7. [System Font Fallback By Platform](#fallback)

---

## 1. Root Problem {#problem}

In `base.css`, `DM Serif Display`, `DM Serif Text`, and `DM Sans`
are Latin-only fonts.
When the browser encounters Chinese characters, it falls back directly to
the operating system's default CJK font:

| Platform    | Default Chinese font        | Style                                 |
| ----------- | --------------------------- | ------------------------------------- |
| macOS / iOS | PingFang SC                 | Modern sans-serif, somewhat cold      |
| Windows     | Microsoft YaHei             | Modern sans-serif, more business-like |
| Android     | Source Han Sans / Noto Sans | Neutral                               |
| Linux       | WenQuanYi / Noto            | Inconsistent                          |

These fonts are not inherently bad, but they do not match Anthropic's warm,
restrained tone.
The result is obvious **glyph discontinuity** when Chinese and English are mixed.

Other side effects:

- Line-height `1.55` is too tight for Chinese; `1.7-1.8` is safer
- `14px` body copy is too small for Chinese; use at least `16px`
- Without punctuation trimming, full-width punctuation creates awkward blank space
- Mixed Chinese and Latin text needs automatic spacing of roughly `0.25em`

---

## 2. Font Selection {#font-selection}

### Preferred Pairing: LXGW WenKai + Source Han Sans

| Role                  | Font                   | Why                                                                                             |
| --------------------- | ---------------------- | ----------------------------------------------------------------------------------------------- |
| Display heading       | **LXGW WenKai**        | Calligraphic structure retains handwritten curvature, close to the warmth of serif display type |
| Body copy             | **LXGW WenKai**        | Comfortable for long-form reading, more narrative and human                                     |
| UI / buttons / labels | **Source Han Sans SC** | Restrained, modern, multiple weights, open-source                                               |
| Code                  | JetBrains Mono         | Keep unchanged                                                                                  |

Why LXGW WenKai wins:
among free Chinese fonts, Song/Ming styles are often too formal and sans styles too neutral.
Kai-style fonts retain organic handwritten curves, which best matches Anthropic's warm editorial tone.

### Alternate Pairing: Source Han Serif + Source Han Sans

```css
/* Better for product-heavy SaaS dashboards and documentation sites */
--font-display-cn: "Source Han Serif SC", "Noto Serif SC", serif;
--font-body-cn: "Source Han Serif SC", "Noto Serif SC", serif;
--font-heading-cn: "Source Han Sans SC", "Noto Sans SC", sans-serif;
```

---

## 3. Import Methods {#import}

### Method A: CDN Import

```html
<head>
  <link rel="preconnect" href="https://cdn.jsdelivr.net" />
  <link
    rel="stylesheet"
    href="https://cdn.jsdelivr.net/npm/lxgw-wenkai-webfont@1.7.0/style.css"
  />

  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link
    rel="stylesheet"
    href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;700&display=swap"
  />

  <link rel="stylesheet" href="assets/fonts/fonts.css" />
  <link rel="stylesheet" href="assets/base.css" />
</head>
```

### Method B: Local Subsetting

Best for fully offline or latency-sensitive projects.
Use `fonttools` to scan project source files, extract only the Chinese characters actually used,
and generate small `woff2` subsets.

```bash
pip install fonttools brotli

find src/ -name "*.vue" -o -name "*.js" -o -name "*.ts" -o -name "*.html" | xargs cat | \
  python3 -c "
import sys, re
text = sys.stdin.read()
chars = set(re.findall(r'[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef\u2018-\u201d]', text))
print(''.join(sorted(chars)))
" > used-chars.txt

python3 -m fontTools.subset LXGWWenKai-Regular.ttf \
  --text-file=used-chars.txt --flavor=woff2 \
  --output-file=assets/fonts/LXGWWenKai-subset.woff2

python3 -m fontTools.subset NotoSansSC-Regular.otf \
  --text-file=used-chars.txt --flavor=woff2 \
  --output-file=assets/fonts/NotoSansSC-subset.woff2
```

Typical result:
roughly 500 Chinese characters can shrink to about `100KB` for WenKai
and `80KB` for Noto Sans SC.

```css
@font-face {
  font-family: "LXGW WenKai";
  font-weight: 400;
  font-display: swap;
  src: url("./LXGWWenKai-subset.woff2") format("woff2");
}
@font-face {
  font-family: "Noto Sans SC";
  font-weight: 400;
  font-display: swap;
  src: url("./NotoSansSC-subset.woff2") format("woff2");
}
```

Limitation:
only characters present during scanning are included.
If new Chinese content is added later, regenerate the subset.
Dynamic content from APIs should still have a system-font fallback.

### Method C: System Fonts First

No network requests.
Use the best built-in Chinese fonts per platform:

```css
:root {
  --font-display-cn: "Songti SC", "STSong", "SimSun", serif;
  --font-heading-cn:
    "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei UI", "Microsoft YaHei",
    sans-serif;
  --font-body-cn: "Songti SC", "STSong", "SimSun", serif;
}
```

Downside:
macOS and iOS look decent, but Windows Songti-style fallback tends to feel old-fashioned,
and visual consistency drops across platforms.

### Runtime Fallback For CDN Failure

When CDN delivery fails, the browser falls back along the font stack automatically.
`base.css` already defines a complete fallback chain:

```css
--font-display-cn:
  "Lora", "LXGW WenKai", "Songti SC", "STSong", "SimSun", serif;
```

The important part is `font-display: swap`,
which allows the browser to move to the next available font immediately
instead of leaving blank text.

---

## 4. CSS Token Overrides {#tokens}

Append the following tokens to `:root` in `base.css`:

```css
:root {
  --font-display-cn:
    "LXGW WenKai", "DM Serif Display", "Songti SC", "STSong", serif;
  --font-body-cn: "LXGW WenKai", "DM Serif Text", "Songti SC", "STSong", serif;
  --font-heading-cn:
    "Noto Sans SC", "Source Han Sans SC", "DM Sans", "PingFang SC",
    "Microsoft YaHei", sans-serif;

  --leading-cn-tight: 1.4;
  --leading-cn-snug: 1.6;
  --leading-cn-normal: 1.75;
  --leading-cn-loose: 1.9;

  --text-cn-sm: 0.9375rem;
  --text-cn-base: 1rem;
  --text-cn-md: 1.125rem;
}
```

---

## 5. Mixed-Script Font Stacks {#mixed-stack}

### Core Principle

In `assets/fonts/fonts.css`, the DM fonts already declare
`unicode-range: U+0000-00FF`, so they only cover Latin characters.
When the browser encounters Chinese characters, it skips those fonts
and falls through to the Chinese font that appears later in the stack.

**The stack order must always be English fonts first, Chinese fonts after them.**

```css
.ui-element {
  font-family:
    "DM Sans", "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif;
}

.body-copy-cn {
  font-family: "DM Serif Text", "LXGW WenKai", "Songti SC", "SimSun", serif;
}

.hero-title-cn {
  font-family: "DM Serif Display", "LXGW WenKai", "Songti SC", serif;
}
```

### Verifying Mixed-Script Rendering

```html
<p style="font-family:'DM Sans','Noto Sans SC',sans-serif">
  Claude AI · Artificial Intelligence · Hello World
</p>
```

Expectation:

- `Claude AI` and `Hello World` should render in `DM Sans`
- the Chinese text should render in `Noto Sans SC`
- verify in developer tools by checking the computed font family

### Automatic Spacing Between Chinese And Latin Text

Modern browsers usually insert a subtle gap between CJK and Latin automatically.
If you ever need manual control:

```css
/* In practice, automatic spacing is usually enough */
.no-auto-spacing {
  font-variant-east-asian: normal;
  text-spacing: normal;
}
```

---

## 6. Chinese Typography Details {#details}

### Punctuation Trimming

Full-width punctuation consumes large horizontal space.
Use `text-spacing-trim` where supported:

```css
.body-copy-cn {
  text-spacing-trim: trim-start allow-end;
  text-spacing: ideograph-alpha ideograph-numeric;
  hanging-punctuation: allow-end;
}
```

### Line-Break Rules

```css
.body-copy-cn {
  word-break: normal;
  overflow-wrap: break-word;
  text-wrap: pretty;
  orphans: 2;
  widows: 2;
  line-break: strict;
}

.heading-cn {
  word-break: keep-all;
  overflow-wrap: break-word;
}
```

### Font Weight Selection

Chinese fonts visually appear heavier than Latin fonts at the same numeric weight.
As a rule:

```css
.hero-title-cn,
.section-title-cn {
  font-weight: 400;
}

.ui-label-cn {
  font-weight: 500;
}

.body-copy-cn {
  font-weight: 400;
}

.emphasis-cn {
  color: var(--color-accent-orange);
}
```

Use color or serif contrast for emphasis before reaching for heavy bold weight.

### Recommended Size And Leading Table

| Use case        | font-size                     | line-height | font-family  |
| --------------- | ----------------------------- | ----------- | ------------ |
| Hero headline   | `clamp(2rem, 5vw, 3.5rem)`    | `1.3`       | `display-cn` |
| Section heading | `clamp(1.5rem, 3vw, 2.25rem)` | `1.4`       | `display-cn` |
| Card title      | `1.25rem`                     | `1.5`       | `heading-cn` |
| Body text       | `1rem`                        | `1.75`      | `body-cn`    |
| Secondary copy  | `0.9375rem`                   | `1.7`       | `heading-cn` |
| UI label        | `0.875rem`                    | `1.4`       | `heading-cn` |
| Supporting note | `0.8125rem`                   | `1.6`       | `heading-cn` |

### Numbers And Units In Mixed Scripts

```css
.stats-value {
  font-family: "DM Serif Display", serif;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
}
```

Example:
in a phrase like `Processed 1,234,567 requests`,
the numerals should render with the Latin font while Chinese text uses the Chinese font stack.

---

## 7. System Font Fallback By Platform {#fallback}

When CDN loading fails or the network is slow,
fallback fonts determine the minimum acceptable quality:

```css
:root {
  --font-display-cn:
    "LXGW WenKai", "DM Serif Display", "Songti SC", "STSong", "AR PL UMing CN",
    "SimSun", serif;

  --font-heading-cn:
    "Noto Sans SC", "Source Han Sans SC", "DM Sans", "PingFang SC",
    "Hiragino Sans GB", "Microsoft YaHei UI", "Microsoft YaHei",
    "WenQuanYi Micro Hei", sans-serif;
}
```

### Loading Priority Recommendation

```html
<head>
  <link
    rel="preload"
    href="https://fonts.gstatic.com/s/notosanssc/v37/k3kXo84MPvpLmixcA63oeALhLOCT-xWNm8Hqd37g1OkDRZe7lR4sg1IzSy-MNbE9VH8V.0.woff2"
    as="font"
    type="font/woff2"
    crossorigin
  />

  <link
    rel="stylesheet"
    href="https://cdn.jsdelivr.net/npm/lxgw-wenkai-webfont@1.7.0/style.css"
    media="print"
    onload="this.media='all'"
  />
</head>
```
