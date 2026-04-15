# Logo Drawing Guide

This file guides the agent in designing, drawing, and adapting SVG logos
within the Anthropic-style visual system.
Do not invent paths arbitrarily.
Derive every path from the principles below.

---

## Contents

1. [Logo Construction Principles](#principles)
2. [SVG Drawing Approach](#svg-drawing)
3. [Brand Color Usage In Logos](#brand-color)
4. [Monochrome / Inverted / Light-Background Variants](#variants)
5. [Minimum Size And Safe Area Rules](#sizing)
6. [Favicon And App Icon Adaptation](#favicon)

---

## 1. Logo Construction Principles {#principles}

### Design Philosophy

Anthropic-style logo design follows the same core brand logic:
**geometric restraint + organic warmth**.
The goal is not visual complexity.
The goal is credibility conveyed through proportion, rhythm, and precision.

### Six Construction Principles

**Principle 1: Start from a grid and simple geometry**

All logo elements should be derived from circles, squares, triangles,
or similarly basic forms, then softened with rounding or subtraction.
Do not begin with freehand curves.
Build the grid first, place the shapes second, refine the nodes last.

```
Recommended composition grid:
┌─────────────────────┐
│  8x8 or 12x12 cells │
│  Main elements >= 2 │
│  Empty space >= 1   │
└─────────────────────┘
```

**Principle 2: Prefer golden-ratio or root-based proportions**

Preferred proportions:

- `1 : 1.618`
- `1 : 1.414`
- `1 : 2` or `1 : 3`

```
Bad proportion: width 47px, height 63px
Good proportion: width 40px, height 64.7px
Or: width 40px, height 40px
```

**Principle 3: Symmetry with a slight intentional offset**

- Perfect symmetry often feels static
- A controlled 2-4px offset can add life
- The offset must have a reason, such as optical balance

**Principle 4: Consistent stroke width**

All strokes inside a mark should use one weight family:

- `16x16` canvas -> `stroke-width: 1.5`
- `24x24` canvas -> `1.5-2`
- `32x32` canvas -> `2`
- `48x48` canvas -> `2.5`

**Principle 5: Organic corner radius**

```
Hard geometric feeling: border-radius = 0
Organic warmth: border-radius = 15%-25% of element width
```

Anthropic style chooses the organic direction.

- Rounded square icon: `rx/ry = width * 0.2`
- Rounded triangle: replace corner points with arcs

**Principle 6: Negative space must be meaningful**

A strong logo has recognizable shape even in its empty areas.
Always ask:
if you invert the colors, does the silhouette still hold up?

---

## 2. SVG Drawing Approach {#svg-drawing}

### Standard SVG Canvas

```svg
<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 40 40"
  width="40"
  height="40"
  role="img"
  aria-labelledby="logo-title"
>
  <title id="logo-title">Company Name</title>
</svg>
```

### Common Geometric Primitives

```svg
<!-- Circle -->
<circle cx="20" cy="20" r="16" fill="currentColor"/>

<!-- Rounded rectangle -->
<rect x="4" y="4" width="32" height="32" rx="8" ry="8" fill="currentColor"/>

<!-- Equilateral triangle -->
<polygon points="20,5 33.86,27.5 6.14,27.5" fill="currentColor"/>

<!-- Hexagon -->
<polygon points="20,4 34,12 34,28 20,36 6,28 6,12" fill="currentColor"/>

<!-- Custom rounded path -->
<path
  d="M 8 20
     C 8 13.37 13.37 8 20 8
     C 26.63 8 32 13.37 32 20"
  stroke="currentColor"
  stroke-width="2"
  fill="none"
  stroke-linecap="round"
/>
```

### Path Command Quick Reference

```
M x,y       move to (x,y)
L x,y       line to (x,y)
H x         horizontal line to x
V y         vertical line to y
C ...       cubic Bezier
Q ...       quadratic Bezier
A ...       arc, often used for rounding
Z           close path

lowercase = relative coordinates
uppercase = absolute coordinates
```

### Rounded Triangle Example

```svg
<path
  d="M 20 8
     L 31 26
     Q 33.86 28 31.5 29.5
     L 8.5 29.5
     Q 6.14 28 9 26
     Z"
  fill="#D97757"
/>
```

Adjust each control point until the corner rounding feels natural.

### Layering Logic For Combined Shapes

```svg
<svg viewBox="0 0 40 40">
  <rect x="2" y="2" width="36" height="36" rx="10" fill="#D97757"/>
  <path d="M 12 20 L 20 12 L 28 20 L 20 28 Z"
        fill="none" stroke="white" stroke-width="2"/>
  <circle cx="20" cy="20" r="2" fill="white"/>
</svg>
```

### Ways To Add Warmth To A Shape

```svg
<line x1="10" y1="20" x2="30" y2="20"
      stroke="currentColor" stroke-width="2" stroke-linecap="round"/>

<polyline points="10,28 20,12 30,28"
          fill="none" stroke="currentColor" stroke-width="2"
          stroke-linecap="round" stroke-linejoin="round"/>
```

Additional rules:

- Slight node offsets can add life
- Avoid sterile geometric perfection
- Subtle variation in stroke rhythm is acceptable

---

## 3. Brand Color Usage In Logos {#brand-color}

### Standard Values

```
Primary brand orange: #D97757
Dark orange hover:    #C96442
Near-black:           #141413
Warm white:           #FAF9F5
Beige light ground:   #ECE9E0
Sand brown support:   #C4B99A
```

### Recommended Color Schemes

**Scheme A: Orange icon + dark wordmark**

```
Icon:      #D97757
Wordmark:  #141413
Background: transparent / #ECE9E0
```

**Scheme B: Dark background + orange icon + warm white wordmark**

```
Background: #141413
Icon:       #D97757
Wordmark:   #FAF9F5
```

**Scheme C: Full near-black**

```
Icon + wordmark: #141413
```

**Scheme D: Full orange marketing treatment**

```
Icon background: #D97757
Icon content:    #FAF9F5
Wordmark:        #D97757
```

### Hard Color Rules

1. The icon body should not exceed 2 colors
2. Orange should remain the visual focal point
3. Gradients, if used, should stay within orange -> dark orange
4. Do not use pure black `#000000`; use `#141413` instead

---

## 4. Monochrome / Inverted / Light-Background Variants {#variants}

Every logo should have at least these four variants:

### Variant 1: Full-color default

```svg
<svg>
  <g fill="#D97757"><!-- icon paths --></g>
  <g fill="#141413"><!-- wordmark paths --></g>
</svg>
```

### Variant 2: Dark-background inverted version

```svg
<svg>
  <g fill="#FAF9F5"><!-- icon paths --></g>
  <g fill="#FAF9F5"><!-- wordmark paths --></g>
</svg>
```

### Variant 3: Monochrome print version

```svg
<svg>
  <g fill="currentColor"><!-- all paths --></g>
</svg>
```

```css
.logo--mono {
  color: #141413;
}
```

### Variant 4: Icon-only version

```svg
<svg viewBox="0 0 40 40">
  <g fill="#D97757"><!-- icon path only --></g>
</svg>
```

### CSS-Based Variant Switching

```css
:root {
  --logo-icon: #d97757;
  --logo-wordmark: #141413;
}
[data-theme="dark"] {
  --logo-icon: #faf9f5;
  --logo-wordmark: #faf9f5;
}
```

---

## 5. Minimum Size And Safe Area Rules {#sizing}

### Minimum Size

| Use case               | Minimum width                 | Requirement              |
| ---------------------- | ----------------------------- | ------------------------ |
| Web / app screen       | `80px` wordmark / `24px` icon | Text must remain legible |
| Mobile navbar          | `60px` wide / `32px` high     |                          |
| Print                  | `15mm`                        | Use `300dpi+`            |
| Embroidery / engraving | `25mm`                        | Simplify detail          |

If the size drops below the minimum, switch to the **icon-only** version.
Do not force a full wordmark logo to scale below readability.

### Safe Area

**Rule**:
reserve space equal to `50%` of the icon height around the logo.
No other element may intrude into that zone.

```css
.logo-wrap {
  padding: 0.5em;
}
```

### Horizontal vs Vertical Layout

```svg
<!-- Horizontal -->
<svg viewBox="0 0 180 40">
  <g transform="translate(0, 0)"><!-- 40x40 icon --></g>
  <g transform="translate(56, 0)"><!-- wordmark --></g>
</svg>

<!-- Vertical -->
<svg viewBox="0 0 120 120">
  <g transform="translate(40, 4)"><!-- icon --></g>
  <g transform="translate(20, 64)"><!-- wordmark --></g>
</svg>
```

---

## 6. Favicon And App Icon Adaptation {#favicon}

### Favicon Set

```html
<link rel="icon" href="/favicon.ico" sizes="any" />
<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
<link rel="manifest" href="/site.webmanifest" />
```

### SVG Favicon Recommendation

Use SVG favicon where possible, because it can adapt to dark mode automatically:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <style>
    :root { --icon-fill: #D97757; }
    @media (prefers-color-scheme: dark) {
      :root { --icon-fill: #FAF9F5; }
    }
  </style>
  <rect x="6" y="6" width="52" height="52" rx="14" fill="#141413"/>
  <path d="M32 14 L48 46 L16 46 Z" fill="var(--icon-fill)"/>
</svg>
```

### Maskable App Icon Safe Area

Adaptive Android icons may be cropped into circles, squircles, or teardrops.
Keep key content within the center safe region.

```
Canvas: 512x512
Outer area: may be cropped
Safe region: central 308x308
All important icon content must remain inside the safe zone
```

```svg
<svg viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#141413"/>
  <g transform="translate(102 102) scale(7.7)">
    <!-- main icon content here -->
  </g>
</svg>
```

### Recommended Export Sizes

| File                    | Size              | Use                    |
| ----------------------- | ----------------- | ---------------------- |
| `favicon.ico`           | `16x16` + `32x32` | Browser tabs           |
| `favicon.svg`           | Vector            | Modern browsers        |
| `apple-touch-icon.png`  | `180x180`         | iOS home screen        |
| `icon-512.png`          | `512x512`         | Android PWA / splash   |
| `icon-maskable-512.png` | `512x512`         | Android adaptive icon  |
| `og-image.jpg`          | `1200x630`        | Social sharing preview |

### OG Image Rules

```
Canvas: 1200x630
Background: #141413
Central content zone: 800x400
Outer safe margin: 100px
Text size: at least 32px
Do not place important information near edges
```
