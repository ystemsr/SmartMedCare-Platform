# Design Operating Rules

The detailed version of the decision system in `SKILL.md`.
Read this file when you need the full rule reference.

---

## Contents

1. [Mandatory Component Usage List](#components)
2. [Mode Isolation Rules](#mode-isolation)
3. [Post-Generation Self-Check](#self-check)
4. [Local Fix Rules](#local-fix)
5. [Resolving Style Conflicts](#conflict)
6. [Controlled Randomness](#randomness)
7. [Context-Aware Token Adjustments](#contextual-tokens)

---

## 1. Mandatory Component Usage List {#components}

The following components already have full implementations.
Copy them directly from the corresponding category file instead of rebuilding them:

| Category file              | Components                                                                                                 |
| -------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `components/basics.md`     | Hero, Feature Grid, Stats, Blockquote, Pricing, CTA Dark, Code Block, Toast, Skeleton                      |
| `components/navigation.md` | Sidebar, Tabs, Breadcrumb, Pagination, Dropdown                                                            |
| `components/forms.md`      | Form, Toggle/Switch, Tooltip, Modal, Accordion                                                             |
| `components/display.md`    | Table, Timeline, Empty State, Banner/Alert, Step Indicator                                                 |
| `components/overlay.md`    | Avatar, Progress Bar/Ring, Search, Command Palette, Drawer, Chip/Tag, Popover, Carousel, Context Menu, FAB |
| `components/feedback.md`   | Number Stepper, Radio Group, File Dropzone, Segmented Control, Status Indicator, Rating, Notification      |
| `components/chat.md`       | Chat UI (complete conversation interface)                                                                  |

**The only exception**: the user explicitly asks for a brand-new design for a component
and explains why the existing version does not fit.

---

## 2. Mode Isolation Rules {#mode-isolation}

Once you enter a non-default mode, adjust the default rules as follows.
This prevents the aesthetic inertia of the default mode from contaminating the output of other modes.

### Adjustments For Data-Dense Mode

| Rule                           | Default           | Data-Dense                | Reason                          |
| ------------------------------ | ----------------- | ------------------------- | ------------------------------- |
| Section spacing                | min 64px          | min 40px                  | Information density comes first |
| Card padding                   | min 24px          | min 16px                  | Save space                      |
| Information blocks per section | max 2             | unlimited                 | Needed for data presentation    |
| Background treatment           | gradients + noise | solid layered backgrounds | Reduce visual distraction       |

### Adjustments For Tool-First Mode

- Whitespace floor: not applicable; density comes first
- Controlled randomness: suspended; consistency matters more
- Transitions: off by default unless the user explicitly requests them
- Heading font: use sans-serif throughout for faster scanning

### Additional Permissions In Brand-Enhanced Mode

- Controlled gradients: allowed, limited to 2 colors and no more than 3 gradient regions
- Accent saturation: may increase, as long as it stays within the brand palette
- Motion: can be richer, but must still follow GPU-safe animation rules
- Still forbidden: neon colors, blue-purple gradients on white backgrounds, Inter/Roboto/Space Grotesk

---

## 3. Post-Generation Self-Check {#self-check}

Before outputting a full task, confirm each item below.
You may skip this for simple tasks.

**Token compliance**

- [ ] All colors use `var(--color-*)`; no hardcoded hex values
- [ ] All fonts use `var(--font-*)`; no fixed font family names
- [ ] All spacing uses `var(--space-*)`; no hardcoded `px`
- [ ] All z-index values use `var(--z-*)`; no hardcoded numbers

**Component compliance**

- [ ] All recognizable UI elements use the approved component versions above
- [ ] No hand-built custom card like `<div class="card">`
- [ ] No unstyled raw `<button>` used as a final UI button

**Mode compliance**

- [ ] The mode was chosen based on keywords
- [ ] The proper adjustments were applied for non-default modes
- [ ] Destructive actions (delete/overwrite) use `.btn-danger`, not restrained gray

**Information hierarchy**

- [ ] Visual hierarchy per screen <= 3 levels
- [ ] Spacing between adjacent sections matches the current mode's whitespace rules

If any item fails, fix it before outputting.

---

## 4. Local Fix Rules {#local-fix}

When the user asks for changes, identify the scope first, then make the smallest valid edit.
That avoids the pattern of fixing one area while breaking the whole system.

**How to identify the scope**

- Text-only change -> replace text only; do not change structure or styling
- One component change -> replace only that component; keep everything else intact
- Layout-wide issue -> re-evaluate the mode and adjust only the layout layer; preserve component code

**Failure localization rule**

State which rule was violated, for example:
"spacing uses hardcoded `px`", "a hand-built modal was used instead of the Modal component",
or "the mode was chosen incorrectly."

**Only change the non-compliant part**

```
User says "the button color is wrong" -> change only the button color token
User says "there is too much whitespace" -> change only that spacing variable, not the whole layout
User says "the style feels off" -> re-run mode selection and adjust density + color tone
```

---

## 5. Resolving Style Conflicts {#conflict}

If the user's request conflicts with the Anthropic style
(for example: "futuristic tech look" or "high-contrast neon"):

The brand color system and font system are hard constraints.
Do not compromise on them.
But the requested visual tension can still be expressed through other means:
background texture, geometric motifs, motion, large-vs-small type contrast, and asymmetrical layouts.

When standard tokens truly cannot be used
(for example, embedding into a third-party dark interface),
preserve the **design intent** instead of clinging to exact values:

- Can't use `#ECE9E0` -> choose the closest warm beige and preserve the warm, organic feel
- Can't use Poppins -> choose a comparable sans-serif and preserve the restrained modern feel
- Can't use the orange CTA -> use a warm hue in the same family and preserve the non-cold, non-flashy feel

**The form may vary, but the spirit should hold.**

---

## 6. Controlled Randomness {#randomness}

Every generated interface should include one non-standard element so that all outputs do not collapse into the same layout.
This principle comes from the official `frontend-design` skill:
repeated layout patterns make AI output lose recognizability.

Possible options:

- An asymmetrical layout instead of full center alignment
- Decorative shapes that break outside the container boundary
- Unexpected type contrast, such as a massive heading with tiny supporting copy
- Unusual distribution of negative space

Suspend this requirement in Tool-First mode, where functional consistency matters more.

---

## 7. Context-Aware Token Adjustments {#contextual-tokens}

The same token carries different visual weight in different contexts.
Adjust accordingly by mode:

| Token          | Default                 | Data-Dense               | Tool-First                     |
| -------------- | ----------------------- | ------------------------ | ------------------------------ |
| Border         | `--color-border-subtle` | `--color-border-default` | `--color-border-default`       |
| Card gap       | `--space-8` (32px)      | `--space-5` (20px)       | `--space-4` (16px)             |
| Section gap    | `--space-16` (64px)     | `--space-10` (40px)      | `--space-8` (32px)             |
| Secondary text | `--text-sm` (14px)      | `--text-xs` (12px)       | `--text-xs` (12px)             |
| Card shadow    | visible on hover        | visible by default       | no shadow, use borders instead |
