# System-Level Guidelines

These are the 10 system-layer issues most likely to accumulate technical debt
in frontend projects.
**Every time the agent builds a new project, it must check this file from start to finish.**

---

## Contents

1. [Z-Index Layering System](#z-index)
2. [Responsive Breakpoints And Mobile Rules](#breakpoints)
3. [Complete Dark-Mode Strategy](#dark-mode)
4. [CSS Animation Performance Rules](#animation-perf)
5. [Focus Trap](#focus-trap)
6. [SVG Icon System](#svg-icons)
7. [Font Loading Strategy](#font-loading)
8. [Scroll Behavior Rules](#scroll)
9. [Complete Form Validation Pattern](#form-validation)
10. [Image Optimization Rules](#image-optimize)
11. [Context-Aware Token Usage](#contextual-tokens)

---

## 1. Z-Index Layering System {#z-index}

**Root problem**:
in multi-author projects or repeated AI generation, people casually write
`z-index: 999`, `9999`, or `99999`.
The final layering becomes chaotic, with modals hidden behind navbars
or tooltips trapped under overlays.

### Standard Layer Table

```css
:root {
  /* In-page layers (< 100) */
  --z-below: -1; /* Background decoration */
  --z-base: 0; /* Normal page flow */
  --z-raised: 10; /* Hovered or raised cards */
  --z-sticky: 20; /* Sticky table headers */
  --z-dropdown: 50; /* Dropdown / Popover anchored to an element */

  /* Page-level overlays (100-500) */
  --z-navbar: 100; /* Navbar / Sidebar */
  --z-fab: 200; /* Floating Action Button */
  --z-tooltip: 250; /* Tooltip without background mask */
  --z-drawer: 300; /* Drawer */
  --z-modal: 400; /* Modal */
  --z-toast: 450; /* Toast above modal */

  /* Global top layers (500+) */
  --z-command: 500; /* Command Palette */
  --z-context: 600; /* Context Menu */
  --z-progress: 999; /* Top progress bar, always highest */
}
```

### Usage Rules

```css
/* ✅ Correct: use tokens */
.navbar {
  z-index: var(--z-navbar);
}
.modal-overlay {
  z-index: var(--z-modal);
}
.toast {
  z-index: var(--z-toast);
}

/* ❌ Forbidden: hardcoded arbitrary numbers */
.my-thing {
  z-index: 9999;
}
```

### Stacking-Context Traps

Some CSS properties create a new stacking context, which prevents child `z-index`
values from escaping the parent.
The most common triggers are:

- `transform: translate*()`
- `opacity < 1`
- `filter`
- `will-change: transform`
- `isolation: isolate`

```css
/* Solution: mount Modal-like layers with a portal directly under <body> */
/* Or explicitly isolate the parent */
.card {
  isolation: isolate;
}
```

---

## 2. Responsive Breakpoints And Mobile Rules {#breakpoints}

### Breakpoint System

```css
:root {
  /* Based on content width, not device marketing names */
  --bp-xs: 480px; /* Small phones */
  --bp-sm: 640px; /* Large phones / small tablets portrait */
  --bp-md: 768px; /* Tablets / small laptops */
  --bp-lg: 1024px; /* Standard laptop */
  --bp-xl: 1280px; /* Wide laptop */
  --bp-2xl: 1440px; /* Desktop displays */
}
```

```css
/* Mobile-first usage */
.section-title {
  font-size: var(--text-xl);
}
@media (min-width: 768px) {
  .section-title {
    font-size: var(--text-2xl);
  }
}
@media (min-width: 1024px) {
  .section-title {
    font-size: var(--text-3xl);
  }
}
```

### Mobile Checklist

```css
/* 1. No horizontal overflow */
html,
body {
  overflow-x: hidden;
}

/* 2. Minimum touch target 44x44px */
.btn,
.nav-link,
.chip__remove,
.toggle {
  min-height: 44px;
  min-width: 44px;
}
.icon-btn {
  padding: var(--space-3);
}

/* 3. Reduce double-tap zoom issues */
html {
  touch-action: manipulation;
}

/* 4. Remove default iOS input appearance */
input,
textarea,
select {
  -webkit-appearance: none;
  border-radius: var(--radius-md);
}

/* 5. Prevent long-press text selection on UI-only elements */
.btn,
.chip,
.badge,
.nav-link {
  -webkit-user-select: none;
  user-select: none;
}

/* 6. Smooth inertial scrolling */
.sidebar__main,
.drawer__body,
.cmd-palette__list {
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
}
```

### Mobile Behavior By Component

| Component | Desktop                  | Mobile adaptation                              |
| --------- | ------------------------ | ---------------------------------------------- |
| Navbar    | Horizontal links         | Collapse into Hamburger -> Drawer              |
| Sidebar   | Persistently open        | Hidden by default, opened by gesture or button |
| Modal     | Centered dialog          | `100vw`, slides up from bottom as a sheet      |
| Dropdown  | Absolute-positioned menu | Minimum width 200px, prevent viewport overflow |
| Table     | Full columns visible     | Horizontal scroll or sticky key columns        |

```css
@media (max-width: 640px) {
  .modal-overlay {
    align-items: flex-end;
    padding: 0;
  }
  .modal {
    max-width: 100%;
    border-radius: var(--radius-xl) var(--radius-xl) 0 0;
    animation: sheetUp 0.3s var(--ease-default);
  }
  @keyframes sheetUp {
    from {
      transform: translateY(100%);
    }
    to {
      transform: translateY(0);
    }
  }
}
```

---

## 3. Complete Dark-Mode Strategy {#dark-mode}

### Three-Layer Strategy

**Layer 1: CSS variable overrides**

```css
@media (prefers-color-scheme: dark) {
  :root {
    /* ...override color tokens... */
  }
}
```

**Layer 2: Manual theme override with `data-theme`**

```css
[data-theme="dark"] {
  --color-bg-base: #1a1916;
  --color-bg-raised: #222119;
  --color-bg-overlay: #2c2b26;
  --color-bg-inverted: #f5f3ec;
  --color-text-primary: #eae7dc;
  --color-text-secondary: #9d9a91;
  --color-text-muted: #5c5a54;
  --color-text-inverted: #141413;
  --color-border-default: #3a3830;
  --color-border-subtle: #2e2d27;
}
[data-theme="light"] {
  --color-bg-base: #ece9e0;
  --color-text-primary: #141413;
}
```

**Layer 3: JavaScript toggle logic**

```js
const THEME_KEY = "anthropic-theme";

function getTheme() {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored) return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem(THEME_KEY, theme);
  document.querySelectorAll("[data-theme-toggle]").forEach((btn) => {
    btn.setAttribute("aria-pressed", theme === "dark");
    btn.setAttribute(
      "aria-label",
      theme === "dark" ? "Switch to light mode" : "Switch to dark mode",
    );
  });
}

function toggleTheme() {
  applyTheme(getTheme() === "dark" ? "light" : "dark");
}

applyTheme(getTheme());

window
  .matchMedia("(prefers-color-scheme: dark)")
  .addEventListener("change", (e) => {
    if (!localStorage.getItem(THEME_KEY))
      applyTheme(e.matches ? "dark" : "light");
  });
```

### Prevent FOUC

```html
<script>
  (function () {
    const t =
      localStorage.getItem("anthropic-theme") ||
      (window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light");
    document.documentElement.setAttribute("data-theme", t);
  })();
</script>
```

### Dark-Mode Special Handling

```css
[data-theme="dark"] img:not([data-no-dim]) {
  filter: brightness(0.9) saturate(0.95);
}

[data-theme="dark"] .card:hover {
  box-shadow:
    0 0 0 1px rgba(250, 249, 245, 0.08),
    0 8px 32px rgba(0, 0, 0, 0.4);
}

*,
*::before,
*::after {
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease,
    color 0.15s ease;
}

.carousel__track,
.progress__fill,
.toggle__thumb {
  transition: none;
}
```

---

## 4. CSS Animation Performance Rules {#animation-perf}

### Only Animate These Properties

```css
/* ✅ High-performance */
transform: translate(), rotate(), scale()
opacity: 0 -> 1
filter: blur()
clip-path

/* ❌ Low-performance */
width, height, top, left, right, bottom
margin, padding
font-size
```

### `will-change` Usage

```css
/* ✅ Good: add only near animation time */
.card {
  transition: transform 0.25s ease;
}
.card:hover {
  will-change: transform;
}

/* ✅ Good: declare for guaranteed animation targets */
.progress__fill {
  will-change: transform;
}
.modal {
  will-change: transform, opacity;
}
.sidebar {
  will-change: transform;
}

/* ❌ Bad */
* {
  will-change: transform;
}
.static-card {
  will-change: transform;
}
```

### Force GPU Compositing

```css
.animated-element {
  transform: translateZ(0);
  backface-visibility: hidden;
  perspective: 1000px;
}
```

### Frame-Rate Control

```js
function animate(timestamp) {
  element.style.transform = `translateX(${x}px)`;
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);

let lastTime = 0;
function throttledAnimate(timestamp) {
  if (timestamp - lastTime < 16.67) {
    requestAnimationFrame(throttledAnimate);
    return;
  }
  lastTime = timestamp;
  requestAnimationFrame(throttledAnimate);
}
```

---

## 5. Focus Trap {#focus-trap}

**Problem**:
when a Modal, Drawer, or Command Palette is open, the Tab key can escape into background content.
That violates accessibility requirements.

### Native Focus Trap Implementation

```js
function createFocusTrap(container) {
  const FOCUSABLE = [
    "a[href]",
    "button:not(:disabled)",
    "input:not(:disabled)",
    "select:not(:disabled)",
    "textarea:not(:disabled)",
    '[tabindex]:not([tabindex="-1"])',
  ].join(", ");

  function getFocusable() {
    return [...container.querySelectorAll(FOCUSABLE)].filter(
      (el) =>
        !el.closest("[hidden]") && getComputedStyle(el).display !== "none",
    );
  }

  function handleKeydown(e) {
    if (e.key !== "Tab") return;
    const focusable = getFocusable();
    if (!focusable.length) {
      e.preventDefault();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  return {
    activate() {
      this._previousFocus = document.activeElement;
      container.addEventListener("keydown", handleKeydown);
      getFocusable()[0]?.focus();
    },
    deactivate() {
      container.removeEventListener("keydown", handleKeydown);
      this._previousFocus?.focus();
    },
  };
}

const modalTrap = createFocusTrap(document.querySelector(".modal"));

function openModal(id) {
  const overlay = document.getElementById(id);
  overlay.removeAttribute("hidden");
  document.body.style.overflow = "hidden";
  modalTrap.activate();
}

function closeModal(id) {
  document.getElementById(id).setAttribute("hidden", "");
  document.body.style.overflow = "";
  modalTrap.deactivate();
}
```

### Components That Need Focus Trap

| Component       | Required       | Reason                       |
| --------------- | -------------- | ---------------------------- |
| Modal           | ✅ Yes         | Accessibility baseline       |
| Drawer          | ✅ Yes         | Accessibility baseline       |
| Command Palette | ✅ Yes         | Full-screen takeover         |
| Dropdown        | ⚠️ Recommended | Prevent tab escape from menu |
| Tooltip         | ❌ No          | No focusable content         |

---

## 6. SVG Icon System {#svg-icons}

### Approach Selection

| Approach           | Best for                             | Pros                       | Cons                         |
| ------------------ | ------------------------------------ | -------------------------- | ---------------------------- |
| Inline SVG         | Needs CSS-controlled color or motion | `currentColor` support     | Larger HTML                  |
| SVG Sprite         | Many reused icons                    | Cache-friendly, clean HTML | Needs build tooling          |
| `<img src=".svg">` | Large decorative graphics            | Simple                     | CSS color control is limited |
| CSS Mask           | Monochrome icons                     | Easy recoloring            | Slightly more complex        |

### Inline SVG Rules

```html
<svg
  class="icon"
  width="16"
  height="16"
  viewBox="0 0 16 16"
  fill="none"
  aria-hidden="true"
  focusable="false"
>
  <path
    d="..."
    stroke="currentColor"
    stroke-width="1.5"
    stroke-linecap="round"
  />
</svg>

<svg role="img" aria-labelledby="icon-title-1">
  <title id="icon-title-1">Delete</title>
  <path d="..." />
</svg>
```

```css
.icon {
  display: inline-block;
  vertical-align: middle;
  flex-shrink: 0;
  color: inherit;
}
.icon--xs {
  width: 12px;
  height: 12px;
}
.icon--sm {
  width: 14px;
  height: 14px;
}
.icon--md {
  width: 16px;
  height: 16px;
}
.icon--lg {
  width: 20px;
  height: 20px;
}
.icon--xl {
  width: 24px;
  height: 24px;
}
.icon--2xl {
  width: 32px;
  height: 32px;
}
```

### SVG Sprite Rules

```html
<svg xmlns="http://www.w3.org/2000/svg" style="display:none">
  <symbol id="icon-search" viewBox="0 0 16 16">
    <circle cx="7" cy="7" r="5" stroke="currentColor" stroke-width="1.5" />
    <path
      d="M11 11l3 3"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
    />
  </symbol>
  <symbol id="icon-close" viewBox="0 0 16 16">
    <path
      d="M3 3l10 10M13 3L3 13"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
    />
  </symbol>
</svg>

<svg class="icon icon--md" aria-hidden="true" focusable="false">
  <use href="#icon-search" />
</svg>
```

### SVG Drawing Rules

```
- Canvas: always 16x16 or 24x24
- Stroke width: 1.5 for 16px, 1.5-2 for 24px
- Stroke ends: round
- Stroke joins: round
- Color: stroke="currentColor" or fill="currentColor", never hardcoded
- Fill: use fill="none" for line icons
- Padding: keep 1-2px internal margin so paths do not clip
```

---

## 7. Font Loading Strategy {#font-loading}

### Two Common Flash Problems

- **FOUT**: fallback font appears first, then swaps to the final font
- **FOIT**: text stays invisible until the font loads

### This Skill's Strategy

```html
<head>
  <link
    rel="preload"
    href="assets/fonts/dm-serif-display-latin-400-normal.woff2"
    as="font"
    type="font/woff2"
    crossorigin
  />
  <link
    rel="preload"
    href="assets/fonts/dm-sans-latin-400-normal.woff2"
    as="font"
    type="font/woff2"
    crossorigin
  />

  <link rel="stylesheet" href="assets/fonts/fonts.css" />
  <link rel="stylesheet" href="assets/base.css" />
</head>
```

### `font-display` Strategy

```css
@font-face {
  font-display: swap;
}

@font-face {
  font-family: "DM Serif Display Fallback";
  src: local("Georgia");
  size-adjust: 105%;
  ascent-override: 90%;
  descent-override: 10%;
}
```

### Font Subsetting

```
The bundled woff2 files are already optimized for Latin subsets.
If you need Chinese text, load a Chinese font or rely on system fallback.
```

```css
:root {
  --font-heading-cn:
    "DM Sans", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
  --font-body-cn: "DM Serif Text", "Songti SC", "SimSun", serif;
}
```

---

## 8. Scroll Behavior Rules {#scroll}

### Four Scroll Scenarios

**A. Page-level smooth scrolling**

```css
html {
  scroll-behavior: smooth;
}

:root {
  --navbar-height: 64px;
}
[id] {
  scroll-margin-top: calc(var(--navbar-height) + var(--space-4));
}
```

**B. Lock background scroll when modal or drawer opens**

```js
document.body.style.overflow = "hidden";

function lockScroll() {
  const scrollbarW = window.innerWidth - document.documentElement.clientWidth;
  document.body.style.paddingRight = scrollbarW + "px";
  document.body.style.overflow = "hidden";
}
function unlockScroll() {
  document.body.style.paddingRight = "";
  document.body.style.overflow = "";
}
```

**C. Independent scroll inside containers**

```css
.drawer__body,
.modal__body,
.cmd-palette__list {
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: thin;
  scrollbar-color: var(--color-border-default) transparent;
}
.drawer__body::-webkit-scrollbar {
  width: 6px;
}
.drawer__body::-webkit-scrollbar-track {
  background: transparent;
}
.drawer__body::-webkit-scrollbar-thumb {
  background: var(--color-border-default);
  border-radius: var(--radius-full);
}
.drawer__body::-webkit-scrollbar-thumb:hover {
  background: var(--color-border-strong);
}
```

**D. Virtual scrolling for long lists**

```js
class VirtualList {
  constructor(container, items, itemHeight, renderItem) {
    this.container = container;
    this.items = items;
    this.itemHeight = itemHeight;
    this.renderItem = renderItem;
    this.container.style.position = "relative";
    this.container.style.overflow = "auto";
    this.render();
    this.container.addEventListener("scroll", () => this.render());
  }

  render() {
    const { scrollTop, clientHeight } = this.container;
    const totalHeight = this.items.length * this.itemHeight;
    const startIdx = Math.floor(scrollTop / this.itemHeight);
    const endIdx = Math.min(
      this.items.length,
      Math.ceil((scrollTop + clientHeight) / this.itemHeight) + 3,
    );

    this.container.innerHTML = `
      <div style="height:${totalHeight}px;position:relative">
        <div style="position:absolute;top:${startIdx * this.itemHeight}px;width:100%">
          ${this.items.slice(startIdx, endIdx).map(this.renderItem).join("")}
        </div>
      </div>`;
  }
}
```

---

## 9. Complete Form Validation Pattern {#form-validation}

### Two-Phase Validation

- **Live validation**: validate on `blur`, clear errors on `input`
- **Submit validation**: validate every field on submit, then focus the first invalid field

```js
const VALIDATORS = {
  required: (v) => (v.trim() ? null : "This field is required"),
  email: (v) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : "Enter a valid email address",
  minLen: (n) => (v) =>
    v.length >= n ? null : `At least ${n} characters required`,
  maxLen: (n) => (v) =>
    v.length <= n ? null : `No more than ${n} characters allowed`,
  pattern: (re, msg) => (v) => (re.test(v) ? null : msg),
};

function validateField(input, rules) {
  const value = input.value;
  for (const rule of rules) {
    const error = rule(value);
    if (error) return error;
  }
  return null;
}

function showError(input, message) {
  const field = input.closest(".form__field");
  input.classList.add("input--error");
  let errorEl = field.querySelector(".form__field-error");
  if (!errorEl) {
    errorEl = document.createElement("p");
    errorEl.className = "form__field-error";
    errorEl.setAttribute("role", "alert");
    field.appendChild(errorEl);
  }
  errorEl.textContent = message;
  input.setAttribute("aria-invalid", "true");
  input.setAttribute(
    "aria-describedby",
    errorEl.id || (errorEl.id = "err-" + input.id),
  );
}

function clearError(input) {
  const field = input.closest(".form__field");
  input.classList.remove("input--error");
  field.querySelector(".form__field-error")?.remove();
  input.removeAttribute("aria-invalid");
  input.removeAttribute("aria-describedby");
}

function initForm(form, fieldRules) {
  Object.entries(fieldRules).forEach(([name, rules]) => {
    const input = form.elements[name];
    if (!input) return;
    input.addEventListener("blur", () => {
      const err = validateField(input, rules);
      err ? showError(input, err) : clearError(input);
    });
    input.addEventListener("input", () => clearError(input));
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    let firstError = null;
    let valid = true;

    Object.entries(fieldRules).forEach(([name, rules]) => {
      const input = form.elements[name];
      if (!input) return;
      const err = validateField(input, rules);
      if (err) {
        showError(input, err);
        if (!firstError) firstError = input;
        valid = false;
      }
    });

    if (!valid) {
      firstError.focus();
      form.querySelector(".form__error-banner")?.removeAttribute("hidden");
      return;
    }

    submitForm(new FormData(form));
  });
}
```

---

## 10. Image Optimization Rules {#image-optimize}

### Format Selection

| Scenario                        | Recommended format        | Notes                             |
| ------------------------------- | ------------------------- | --------------------------------- |
| Photos / complex gradients      | WebP first, JPEG fallback | AVIF is better but less universal |
| Icons / logos / UI              | SVG                       | Vector, fully scalable            |
| Screenshots / text-heavy images | PNG / WebP                | Preserve crisp edges              |
| Animation                       | Animated WebP / `<video>` | Avoid GIF                         |

### Responsive Images

```html
<img
  src="hero-800.jpg"
  srcset="
    hero-480.jpg   480w,
    hero-800.jpg   800w,
    hero-1200.jpg 1200w,
    hero-1600.jpg 1600w
  "
  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 80vw, 1200px"
  alt="Group photo of the Anthropic research team"
  width="1200"
  height="675"
  loading="lazy"
  decoding="async"
/>

<picture>
  <source srcset="hero.webp 1x, hero@2x.webp 2x" type="image/webp" />
  <source srcset="hero.jpg 1x, hero@2x.jpg 2x" type="image/jpeg" />
  <img src="hero.jpg" alt="..." width="1200" height="675" loading="lazy" />
</picture>
```

### Lazy Loading

```html
<img loading="lazy" decoding="async" src="..." alt="..." />

<img loading="eager" fetchpriority="high" src="hero.jpg" alt="..." />
```

```js
const lazyImages = document.querySelectorAll("img[data-src]");
const imageObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const img = entry.target;
        img.src = img.dataset.src;
        if (img.dataset.srcset) img.srcset = img.dataset.srcset;
        img.removeAttribute("data-src");
        imageObserver.unobserve(img);
      }
    });
  },
  { rootMargin: "200px" },
);
lazyImages.forEach((img) => imageObserver.observe(img));
```

### Image CSS Rules

```css
img {
  max-width: 100%;
  height: auto;
  display: block;
}

.img-wrap {
  aspect-ratio: 16 / 9;
  overflow: hidden;
  border-radius: var(--radius-lg);
}
.img-wrap img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  transition: transform 0.4s var(--ease-default);
}
.img-wrap:hover img {
  transform: scale(1.04);
}

.img-placeholder {
  background: var(--color-border-subtle);
  animation: shimmer 1.5s infinite linear;
  background-image: linear-gradient(
    90deg,
    var(--color-border-subtle) 25%,
    var(--color-bg-raised) 50%,
    var(--color-border-subtle) 75%
  );
  background-size: 600px 100%;
}
```

### Alt Text Rules

```html
<img
  src="claude-interface.jpg"
  alt="Screenshot of the Claude conversation interface showing multi-turn dialogue"
/>

<img src="background-texture.png" alt="" />

<img src="photo.jpg" alt="Image" />
<img src="photo.jpg" alt="photo.jpg" />
```

---

## 11. Context-Aware Token Usage {#contextual-tokens}

**Core issue**:
the same token can feel appropriate in one context and invisible in another.
Tokens are static values; visual weight is contextual.

### 11.1 Token Density Adjustment Table

| Token category      | Default                 | Data-Dense               | Tool-First               |
| ------------------- | ----------------------- | ------------------------ | ------------------------ |
| Border              | `--color-border-subtle` | `--color-border-default` | `--color-border-default` |
| Content spacing     | `--space-8` (32px)      | `--space-5` (20px)       | `--space-4` (16px)       |
| Section spacing     | `--space-16` (64px)     | `--space-10` (40px)      | `--space-8` (32px)       |
| Secondary text size | `--text-sm` (14px)      | `--text-xs` (12px)       | `--text-xs` (12px)       |
| Card shadow         | hover only              | visible by default       | none, use border instead |
| Background depth    | 2 layers                | 3 layers                 | 2 layers                 |

### 11.2 Contrast Adjustments By Scenario

```css
.content-default {
  color: var(--color-text-secondary);
  border-color: var(--color-border-subtle);
}

.content-data-dense {
  color: var(--color-text-primary);
  border-color: var(--color-border-default);
}

.content-utility {
  color: var(--color-text-primary);
  border-color: var(--color-border-strong);
  transition: none;
}
```

### 11.3 Layout Continuity In Multi-Step Flows

```
Keep every step visually consistent:
  The main content area position, width, and type size must remain unchanged
  Only the content should change, not the container

Keep the step indicator visible:
  Pin it to the top or side
  Highlight the current step
  Allow returning to completed steps

Mark irreversible steps:
  Before submit / deploy / publish, show a warning banner
  Add a special marker to the step bar

Use directional transition:
  Forward -> fade in from the right
  Backward -> fade in from the left
```

```css
.wizard-step {
  animation: stepEnter var(--duration-normal) var(--ease-default);
}
.wizard-step--back {
  animation: stepEnterBack var(--duration-normal) var(--ease-default);
}
@keyframes stepEnter {
  from {
    opacity: 0;
    transform: translateX(20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
@keyframes stepEnterBack {
  from {
    opacity: 0;
    transform: translateX(-20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.steps__step--irreversible .steps__node {
  border-color: var(--color-warning);
}
.steps__step--irreversible .steps__label::after {
  content: " ⚠";
  color: var(--color-warning);
  font-size: 0.8em;
}
```

### 11.4 Emergency And Alert Scenarios

Three user modes require different information priorities:

```
Browsing mode:
  The user is exploring content
  -> fully apply this skill: whitespace, restraint, narrative feel

Task mode:
  The user is completing a specific action
  -> emphasize the path forward, remove distractions, make the CTA obvious

Emergency mode:
  The user is handling a fault or incident
  -> the key information must be readable within 0.5 seconds
  -> drop aesthetic ambition and keep only:
     1. what the problem is
     2. how severe it is
     3. what the next action is
```

```css
.alert-critical {
  position: fixed;
  inset: 0;
  z-index: var(--z-modal);
  background: rgba(20, 20, 19, 0.92);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-8);
}
.alert-critical__panel {
  background: var(--color-bg-overlay);
  border: 2px solid var(--color-error);
  border-radius: var(--radius-xl);
  padding: var(--space-10);
  max-width: 480px;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}
.alert-critical__severity {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  font-family: var(--font-heading);
  font-size: var(--text-xs);
  font-weight: var(--weight-bold);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--color-error);
}
.alert-critical__title {
  font-family: var(--font-display);
  font-size: var(--text-2xl);
  font-weight: 400;
  color: var(--color-text-primary);
  line-height: var(--leading-tight);
}
.alert-critical__body {
  font-family: var(--font-heading);
  font-size: var(--text-base);
  color: var(--color-text-secondary);
  line-height: var(--leading-normal);
}
.alert-critical__actions {
  display: flex;
  gap: var(--space-3);
  padding-top: var(--space-3);
  border-top: 1px solid var(--color-border-subtle);
}
```
