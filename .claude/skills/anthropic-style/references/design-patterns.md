# Design Patterns And Visual Depth

## Backgrounds And Visual Depth

### Beige Textured Background

```css
/* Method A: CSS noise texture */
.bg-texture {
  background-color: var(--color-bg-base);
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E");
}

/* Method B: radial vignette gradients */
.bg-vignette {
  background:
    radial-gradient(
      ellipse 80% 60% at 20% 10%,
      rgba(217, 119, 87, 0.06) 0%,
      transparent 60%
    ),
    radial-gradient(
      ellipse 60% 40% at 80% 90%,
      rgba(106, 155, 204, 0.05) 0%,
      transparent 60%
    ),
    var(--color-bg-base);
}

/* Method C: dark hero section */
.bg-dark-hero {
  background:
    radial-gradient(
      ellipse 100% 80% at 50% 0%,
      rgba(217, 119, 87, 0.12) 0%,
      transparent 55%
    ),
    var(--color-bg-inverted);
}
```

### Visual Rhythm Between Sections

Alternate light and dark sections to create rhythm:

```
[Beige Hero] -> [Light Content] -> [Dark Feature] -> [Beige Content] -> [Dark Footer]
```

### Spatial Composition Principles

From the official `frontend-design` skill:

**Whitespace is the strongest design tool.**
It can communicate quality even without decorative elements.

```
Core techniques:
  1. Asymmetrical whitespace -> leave large empty areas on the right or bottom for breathing room
  2. Unexpected negative space -> let text occupy only 40% of the container
  3. Break the grid -> allow one element to push beyond alignment boundaries to create tension
  4. Extreme contrast -> oversized headline + tiny body copy, or the reverse
```

**Quantified information-density rule:**

| Density level          | Elements / screen | Suitable scenarios                                         |
| ---------------------- | ----------------- | ---------------------------------------------------------- |
| Low density (default)  | <= 5              | Landing pages, brand showcases                             |
| Medium density         | 6-10              | Product pages, form flows                                  |
| High density           | 11-15             | Dashboards, data tables                                    |
| Extremely high density | 16+               | Professional tools (requires extra visual noise reduction) |

## Motion And Interaction

### Transition Rules

```css
:root {
  --ease-default: cubic-bezier(0.16, 1, 0.3, 1); /* Fast in, slow out */
  --ease-bounce: cubic-bezier(0.34, 1.56, 0.64, 1); /* Slight elasticity */
  --ease-gentle: cubic-bezier(0.4, 0, 0.2, 1); /* Gentle */
}
```

### Page-Entry Animation (Stagger Reveal)

```css
@keyframes fadeUp {
  from {
    opacity: 0;
    transform: translateY(24px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.reveal {
  opacity: 0;
  animation: fadeUp var(--duration-slow) var(--ease-default) forwards;
}
.reveal:nth-child(1) {
  animation-delay: 0ms;
}
.reveal:nth-child(2) {
  animation-delay: 80ms;
}
.reveal:nth-child(3) {
  animation-delay: 160ms;
}
.reveal:nth-child(4) {
  animation-delay: 240ms;
}
```

### Microinteraction Rules

- **Hover lift**: move cards upward by 2px on hover with a soft shadow; never exceed 4px
- **Button press**: slight shrink via `scale(0.97)`
- **Focus ring**: orange `box-shadow: 0 0 0 3px rgba(217,119,87,0.35)`

## Accessibility Rules

- **Contrast**: body text >= 4.5:1 (WCAG AA), large headings >= 3:1
- **Focus style**: every interactive element must have a visible orange focus ring
- **Hit area**: minimum 44x44px on mobile, minimum 32x32px on desktop
- **Respect reduced motion**:
  ```css
  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      animation-duration: 0.01ms !important;
      transition-duration: 0.01ms !important;
    }
  }
  ```
- **Semantic HTML**: use `<button>` instead of `<div>` for buttons, and wrap navigation in `<nav>`

## Anti-Patterns ❌ (Strictly Forbidden)

| Forbidden practice                                    | Reason                             |
| ----------------------------------------------------- | ---------------------------------- |
| Pure white `#FFFFFF` page backgrounds                 | Lacks warmth                       |
| Blue-purple gradient hero backgrounds                 | Tired SaaS-tech cliché             |
| Using Inter/Roboto/Open Sans                          | The most overused AI-product fonts |
| Using any color other than orange for the primary CTA | Breaks brand consistency           |
| More than 5 primary colors                            | The palette loses control          |
| Square cards (`border-radius: 0`)                     | Lacks an organic feel              |
| Using sans-serif for every heading                    | Loses narrative warmth             |
| Highly saturated neon accents                         | Conflicts with the earthy palette  |
| Overusing shadows (multiple layers, heavy blur)       | Feels heavy and cheap              |
