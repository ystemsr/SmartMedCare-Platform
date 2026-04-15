# Overlay And Utility Components

## Contents

1. [Avatar](#avatar)
2. [Progress Bar / Ring](#progress)
3. [Search Bar With Suggestions](#search)
4. [Command Palette](#command-palette)
5. [Drawer](#drawer)
6. [Chip / Tag](#chip)
7. [Popover](#popover)
8. [Carousel](#carousel)
9. [Context Menu](#context-menu)
10. [Floating Action Button](#fab)

---

## 26. Avatar {#avatar}

```html
<div class="avatar avatar--md avatar--orange">
  <span class="avatar__initials">DA</span>
</div>
```

## 27. Progress Bar / Ring {#progress}

```html
<div class="progress">
  <div class="progress__fill" style="width:72%"></div>
</div>
```

## 28. Search Bar With Suggestions {#search}

```html
<div class="search">
  <div class="search__input-wrap">
    <input
      class="search__input"
      type="search"
      placeholder="Search models, keys, or logs…"
    />
  </div>
</div>
```

## 29. Command Palette {#command-palette}

```html
<div
  class="cmd-palette"
  role="dialog"
  aria-modal="true"
  aria-label="Command Palette"
>
  <input class="cmd-palette__input" placeholder="Type a command or search…" />
</div>
```

## 30. Drawer {#drawer}

```html
<aside class="drawer" aria-label="Side drawer">
  <div class="drawer__body">Drawer content</div>
</aside>
```

## 31. Chip / Tag {#chip}

```html
<span class="chip"
  >Production<button class="chip__remove" aria-label="Remove tag">
    ×
  </button></span
>
```

## 32. Popover {#popover}

```html
<div class="popover" role="dialog" aria-label="Popover card">
  <p>Quick contextual details live here.</p>
</div>
```

## 33. Carousel {#carousel}

```html
<div class="carousel">
  <div class="carousel__track">
    <article class="carousel__slide">Slide 1</article>
    <article class="carousel__slide">Slide 2</article>
  </div>
</div>
```

## 34. Context Menu {#context-menu}

```html
<div class="context-menu" role="menu">
  <button class="context-menu__item">Rename</button>
  <button class="context-menu__item">Duplicate</button>
  <button class="context-menu__item">Delete</button>
</div>
```

## 35. Floating Action Button {#fab}

```html
<button class="fab" aria-label="Create new item">+</button>
```

## Supplemental Components

Use this file for overlays, transient surfaces, quick actions, and search-oriented utility UI.
