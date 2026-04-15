---
name: anthropic-style
description: |
  Create high-quality Anthropic-style frontend interfaces:
  warm, distinctive, and never "generic AI".
  Includes the official brand font pairing (Poppins + Lora),
  43 complete components, and 4 scenario modes.

  Whenever the user wants to build any frontend UI, whether it is a landing page,
  SaaS product, AI tool, Chat UI, Dashboard, or admin panel, this skill should be used.
  Especially trigger it when the user says things like
  "build an interface", "design a page", "write some UI",
  "Anthropic style", "Claude style", "make it look better",
  "avoid generic AI aesthetics", or "make it feel warm".
  Do not improvise outside the skill.

  This skill requires the following:
  choose a bold aesthetic direction before implementation;
  ensure every output is visibly differentiated;
  never collapse into the same template;
  and make implementation complexity match aesthetic intensity.
---

# Anthropic-Style Frontend Design Guidelines

_Based on the official brand guidelines + the `frontend-design` skill_

---

## File Index

| File                             | Content                                                                               | When to read it                                           |
| -------------------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `assets/base.css`                | Full CSS tokens (colors / fonts / spacing / motion / z-index)                         | Include every time                                        |
| `assets/fonts/fonts.css`         | Local font declarations (Poppins + Lora + DM family)                                  | Include every time                                        |
| `references/components/index.md` | Index of 43 components with quick lookup                                              | When you need a specific component                        |
| `references/systems.md`          | 11 system-level rules (responsive, dark mode, focus trap, etc.)                       | When building a full project                              |
| `references/dashboard.md`        | Dashboard-specific rules (KPI / charts / live data)                                   | For data-dense scenarios                                  |
| `references/logo.md`             | Logo drawing + favicon rules                                                          | When icons or logos are needed                            |
| `references/typography-cn.md`    | Chinese typography (LXGW WenKai / mixed-script handling / subsetting)                 | For Chinese interfaces                                    |
| `references/design-rules.md`     | Detailed operating rules (self-checks / mode isolation / fix rules)                   | When full rule detail is needed                           |
| `references/design-patterns.md`  | Background texture CSS, motion rules, microinteractions, accessibility, anti-patterns | When you need concrete visual implementation references   |
| `SKILL-lite.md`                  | Condensed version (~700 tokens)                                                       | For simple components / single screens / rapid prototypes |

---

## Before You Start: Choose A Mode

After receiving a task, determine the mode by matching these keywords first.
This decision affects every later choice.

| If the task includes these words                                            | Mode               | Core adjustment                                                   |
| --------------------------------------------------------------------------- | ------------------ | ----------------------------------------------------------------- |
| dashboard / monitoring / data board / metrics / charts / ops / reports      | **Data-Dense**     | Reduce whitespace, increase contrast, refer to `dashboard.md`     |
| admin / backend / management system / config / permissions / CRM / ERP / OA | **Tool-First**     | Density first, full functionality, can break the whitespace floor |
| landing page / campaign page / marketing / brand / homepage / game          | **Brand-Enhanced** | Controlled gradients allowed, stronger visual tension             |
| anything else                                                               | **Default**        | Apply this skill in full, keep whitespace restrained              |

Mode selection takes priority over intuition.
Keyword matching is mechanical, not semantic guesswork.
Non-default modes still use the same token system, but allow limited changes in density,
contrast, and restraint.
For mode-isolation details, see `design-rules.md`.

---

## Design Philosophy

Anthropic's visual language is built on a central tension:
**technical rigor + human warmth**.
It intentionally separates itself from the cold blue palette of generic "AI tech" design:

- warm beige earth tones (`#ECE9E0`) instead of sterile white backgrounds
- serif + sans-serif pairing (Lora + Poppins) instead of all-sans typography
- restrained orange (`#D97757`) as the single accent color
- editorial, narrative typography rather than purely functional listing
- either generous whitespace or extreme density, never an indistinct middle state

> After finishing a design, ask yourself:
> **"If the logo were hidden, would this still feel like an AI company centered on human values?"**

### Four Questions To Ask Before Starting

From the official `frontend-design` skill:

1. **Purpose**: What problem does this interface solve, and who is it for?
2. **Tone**: Pick one clear direction and commit to it. Anthropic style sits at the intersection of organic, refined, restrained, and editorial. Possible directions: minimal restraint / organic naturalism / refined luxury / editorial narrative / geometric sharpness / warm softness / industrial utility.
3. **Constraints**: What framework, localization, or accessibility constraints exist?
4. **Differentiation**: What makes this design memorable at first glance?

### Implementation Complexity Must Match Aesthetic Intensity

Also from the official `frontend-design` skill, and easy to neglect:

- **Minimal design** requires precision in spacing, typography, and every small detail. "Fewer lines of code" is not an excuse for careless design.
- **Maximal design** requires substantial motion, layered backgrounds, and carefully orchestrated visual hierarchy. The amount of implementation should match the amount of visual richness.
- **Unacceptable**: bland in-between output that is neither restrained nor bold.

### Forced Differentiation

From the official `frontend-design` skill:
**outputs for different tasks must look different, and must never collapse into the same template.**

Actively vary at least one of these on every generation:
font pairing, color emphasis, layout structure, background treatment, or motion style.

In default mode, you must also include one non-standard element every time:

- an asymmetrical split layout instead of universal center alignment
- a decorative shape that breaks outside the container boundary
- an extreme size contrast between headline and supporting copy
- an unusual use of negative space

### Information Density Rules

```
Visual hierarchy per screen: at most 3 layers (headline / content / supporting info)
Information blocks per section: at most 2; split further content into new sections
Line width: body text max 65ch, headings max 28ch
Whitespace floor (default mode): section gap min 64px, card padding min 24px
Navigation item count: top navigation max 6 items
```

### Decision Priority

Information clarity > interaction usability > visual consistency > minimalist aesthetics.

Beauty is the lowest priority.
If readability or usability is sacrificed just to make something "look better",
the design has failed.

### Cases Where You Must Abandon Minimalism

Destructive actions (delete / irreversible operations), urgent alerts, system failures,
and no-return states must use strong visual emphasis.
Restraint is not allowed there.
See section 11.4 of `systems.md` and `design-rules.md` for implementation details.

---

## Token System

All implementation details live in `assets/base.css`.
The values below are the key quick reference:

**Colors**

```css
--color-bg-base: #ece9e0 /* Page background, not pure white */
  --color-bg-raised: #f5f3ec /* Cards / panels */ --color-bg-inverted: #141413
  /* Dark sections */ --color-accent-orange: #d97757
  /* The only accent color, used for primary CTA */
  --color-text-primary: #141413 /* Primary text */
  --color-text-secondary: #6b6860 --color-error: #c0453a
  /* Use for destructive actions, not restrained gray */;
```

**Fonts** (official brand fonts, bundled locally)

```css
--font-display:
  "Lora", "DM Serif Display",
  serif /* Large headings */ --font-heading: "Poppins", "DM Sans",
  sans-serif /* UI / buttons / navigation */ --font-body: "Lora",
  "DM Serif Text", serif /* Body copy */ --font-mono: "JetBrains Mono",
  monospace;
```

**Spacing** (4px grid, common values)

```css
--space-4: 16px --space-6: 24px --space-8: 32px --space-10: 40px
  --space-16: 64px --space-32: 128px;
```

Import order:
inside the HTML `<head>`, include `fonts.css` first and then `assets/base.css`.
Do not reverse the order.
Chinese projects must include the Chinese font CDN before both of them;
see `typography-cn.md`.

---

## Component System

**All 43 complete components are already provided. Use the existing ones instead of rebuilding them.**

Lookup flow:
`components/index.md` -> find the relevant category file -> copy the code and modify as needed.

Quick lookup:

| Need                                                | Go here                    |
| --------------------------------------------------- | -------------------------- |
| Buttons / cards / code blocks / skeleton screens    | `components/basics.md`     |
| Sidebar / tabs / dropdown menus                     | `components/navigation.md` |
| Forms / switches / modals / drawers                 | `components/forms.md`      |
| Tables / timelines / empty states / step indicators | `components/display.md`    |
| Search / ⌘K / progress / carousel / FAB             | `components/overlay.md`    |
| Stepper / radio / upload / rating / notifications   | `components/feedback.md`   |
| Conversation UI / message stream / input field      | `components/chat.md`       |
| KPI cards / charts / real-time data                 | `dashboard.md`             |

---

## Core Design Rules

### Color Usage

- Use `--color-bg-base` for the page background, never `#FFFFFF`
- Use orange for the primary CTA, never blue or purple
- A single page may use at most 5 colors total, including black and white
- Forbidden: blue-purple gradients (`#6366F1 -> #8B5CF6`), neon colors, highly saturated decorative colors

### Typography Usage

- Headings: Lora (`var(--font-display)`)
- UI / buttons: Poppins (`var(--font-heading)`)
- Body copy: Lora (`var(--font-body)`)
- Forbidden: Inter, Roboto, Open Sans, Space Grotesk

### Motion Constraints

- Animate only `transform` and `opacity`, never `width` / `height` / `top` / `left`
- Durations: `--duration-fast` (150ms) / `--duration-normal` (250ms) / `--duration-slow` (400ms)
- Easing: `--ease-default: cubic-bezier(0.16, 1, 0.3, 1)`
- **HTML/CSS projects**: prefer CSS animation and implement stagger with `animation-delay` (80ms intervals)
- **React projects**: use Motion (`import { motion } from 'motion/react'`) for finer control, including `useInView` and `whileHover`
- Signature effect: content fades upward from `translateY(24px)` to `0`, staggered by 80ms per element

### Backgrounds And Visual Depth

Flat backgrounds feel cheap.
Backgrounds should **create atmosphere and depth**.

**Technique menu** (choose 1-2 per project as needed):

```css
/* A. Radial vignette gradient (most common) */
background:
  radial-gradient(
    ellipse 80% 60% at 20% 10%,
    rgba(217, 119, 87, 0.06) 0%,
    transparent 60%
  ),
  var(--color-bg-base);

/* B. Gradient mesh */
background-image:
  radial-gradient(at 20% 20%, rgba(217, 119, 87, 0.08) 0px, transparent 50%),
  radial-gradient(at 80% 10%, rgba(106, 155, 204, 0.06) 0px, transparent 45%),
  radial-gradient(at 50% 80%, rgba(120, 140, 93, 0.05) 0px, transparent 50%);

/* C. Noise texture / grain overlay */
background-image: url("data:image/svg+xml,...feTurbulence...");

/* D. Geometric pattern */
background-image: url("data:image/svg+xml,...stroke='%23D8D5CC'...");

/* E. Decorative border */
.section {
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-xl);
}

/* F. Custom cursor (Brand-Enhanced mode) */
body {
  cursor: url("cursor.svg"), auto;
}
```

**Depth layering**:
use layered transparency to create a Z-axis feeling.
Background layer opacity 0.06, mid layer 0.4, foreground 1.0.

**Section rhythm**:
`[Beige Hero] -> [Light Content] -> [Dark Section] -> [Beige Content] -> [Dark Footer]`

### Spatial Composition

Anthropic style rejects bland center alignment.
Use the following to create tension:

- **Asymmetry**: use a golden-ratio split (1:1.618) between primary and secondary content instead of 50/50
- **Overlap**: allow slight overflow beyond container edges via `margin-inline: calc(var(--space-16) * -1)`
- **Diagonal flow**: use an angled divider with `clip-path: polygon(0 0, 100% 5%, 100% 100%, 0 95%)`
- **Grid breaking**: let decorative graphics deliberately break the content boundary
- **Large whitespace OR high density**: choose one; reject the middle state

### Accessibility

- Body text contrast >= 4.5:1 (WCAG AA)
- Focus ring: orange `box-shadow: 0 0 0 3px rgba(217,119,87,0.35)`, not the browser's default blue
- Touch targets: minimum 44x44px on mobile
- Semantic HTML: use `<button>` for buttons, `<nav>` for navigation, `<main>` for primary content
- Reduced motion: override all motion with `@media (prefers-reduced-motion: reduce)`

---

## Anti-Patterns

| Forbidden                                            | Reason                                                   |
| ---------------------------------------------------- | -------------------------------------------------------- |
| Pure white `#FFFFFF` background                      | Lacks warmth                                             |
| Blue-purple gradient hero                            | Tired AI SaaS cliché                                     |
| Inter / Roboto / Space Grotesk                       | Explicitly disallowed; overused font families            |
| Any primary CTA color other than orange              | Breaks brand consistency                                 |
| Sans-serif for every heading                         | Removes narrative warmth                                 |
| Restrained gray for destructive actions              | Misleads the user's sense of risk                        |
| **Using the same layout structure every time**       | Explicitly forbidden: "No design should be the same"     |
| **Collapsing into Space Grotesk + purple gradients** | Explicitly called out as generic AI aesthetics           |
| Sacrificing information density for prettiness       | Beauty has the lowest priority                           |
| Justifying minimalism with "less code"               | Implementation complexity must match aesthetic intensity |

---

## System Rules Index

See `references/systems.md` for the full 11 sections:

| Section | Content                                                                        |
| ------- | ------------------------------------------------------------------------------ |
| 1       | Z-index layering (`--z-*` tokens; hardcoding forbidden)                        |
| 2       | Responsive breakpoints + mobile rules (mobile-first, 44px touch targets)       |
| 3       | Dark mode (`[data-theme]` + localStorage + FOUC prevention)                    |
| 4       | Animation performance (transform/opacity only, controlled `will-change`)       |
| 5       | Focus trap (required for Modal / Drawer / ⌘K)                                  |
| 6       | SVG icon system (`currentColor` + `unicode-range`)                             |
| 7       | Font loading strategy (preload + `font-display: swap` + flash prevention)      |
| 8       | Scroll behavior (background lock without layout jump + `overscroll-behavior`)  |
| 9       | Form validation (trigger on blur + full submit validation + focus first error) |
| 10      | Image optimization (WebP + `srcset` + no lazy-loading for LCP images)          |
| 11      | Context-aware tokens + flow continuity + alert scenarios                       |

---

## Chinese Interfaces

Chinese projects require additional Chinese fonts.
In the font stack, English fonts must be listed before Chinese fonts so that
`unicode-range` can route them automatically.
See `typography-cn.md` for the full approach, including CDN, local subsetting,
and system-font fallback.

Key Chinese typography differences:
use `--leading-cn-normal: 1.75` instead of the English 1.55;
use heading weight 400 instead of 700;
use `text-spacing-trim` to compress punctuation spacing.

---

## Output Quality Check

**Simple-task rule**:
for standalone components, copy-only edits, or color-only changes,
reading `SKILL-lite.md` is enough. The full document is not required.

Before outputting a full task, quickly verify:

- Colors, fonts, spacing, and z-index all use tokens; nothing is hardcoded
- All recognizable components come from `components/`; no duplicate hand-built implementations
- The mode has been determined, and non-default adjustments have been applied
- Destructive actions use `--color-error`
- Visual hierarchy per screen <= 3 levels

See `design-rules.md` for the complete self-checklist.
