---
name: anthropic-style-lite
description: |
  Anthropic-style frontend design guidelines [Lite].
  Suitable for: simple components, single-page screens, rapid prototypes,
  and tasks that do not require full system-level constraints.
  For the complete version, see SKILL.md
  (includes multiple modes, self-checklists, and system guidelines).
---

# Anthropic Style · Lite Rules

## 1. Choose A Mode First

| If the task includes these words             | Use this mode                                                  |
| -------------------------------------------- | -------------------------------------------------------------- |
| dashboard / monitoring / charts / data board | **Data-Dense**: reduce whitespace, increase contrast           |
| admin / backend / management system / config | **Tool-First**: density first, full functionality              |
| landing / homepage / brand / marketing       | **Brand-Enhanced**: gradients allowed, stronger visual tension |
| anything else                                | **Default**: restrained whitespace, serif/sans pairing         |

## 2. Use Tokens, Do Not Hardcode

```css
/* Colors */
--color-bg-base:
  #ece9e0 /* Page background, not pure white */ --color-accent-orange: #d97757
    /* Primary CTA, the only accent color */ --color-text-primary: #141413
    /* Primary text */ --color-text-secondary: #6b6860 /* Secondary text */
    --color-error: #c0453a /* Danger / error */ /* Fonts */
    --font-display: "Lora",
  serif /* Large headings */ --font-heading: "Poppins",
  sans-serif /* UI / buttons / labels */ --font-body: "Lora",
  serif /* Body copy */ /* Spacing (4px grid) */ --space-4: 16px --space-6: 24px
    --space-8: 32px --space-10: 40px --space-16: 64px;
```

## 3. Use Existing Components, Do Not Reinvent Them

Check `references/components/index.md` and load the relevant category file as needed.

Already included: Button, Card, Form, Modal, Table, Sidebar, Toast, Empty State,
Chat UI, and more, for a total of 43 components.

## 4. Three Hard Rules

```
1. Use var(--color-bg-base) for page backgrounds, never #FFFFFF
2. Use orange for the primary CTA, never blue or purple
3. Use var(--color-error) to emphasize destructive actions (delete/overwrite), never restrained gray
```

## 5. Final 30-Second Check

- [ ] Did you hardcode any colors (`#xxxxxx`)?
- [ ] Did you hand-build a component that already exists in the library?
- [ ] Do destructive buttons use red?

---

**When you need the full guideline set
(mode isolation, self-checklists, system rules, Dashboard specifics) -> read `SKILL.md`**
