# Dashboard Guidelines For Data-Dense Interfaces

Data-heavy scenarios are where Anthropic style is easiest to lose.
Because data naturally increases visual complexity,
the design can quickly drift toward generic Ant Design or Material patterns.
This file defines how to preserve the brand tone under high information density.

---

## Contents

1. [Core Principle: Data Should Still Feel Human](#principles)
2. [Layout Structure](#layout)
3. [Numbers And KPI Presentation](#metrics)
4. [Chart Color Constraints](#chart-colors)
5. [Advanced Table Rules](#table-advanced)
6. [Status And Real-Time Data](#realtime)
7. [Empty And Loading States](#empty-loading)
8. [Information Hierarchy Control](#hierarchy)
9. [Anti-Patterns](#anti-patterns)

---

## 1. Core Principle: Data Should Still Feel Human {#principles}

A dashboard does not mean filling the screen with raw metrics.
Anthropic-style dashboards follow these rules:

```
Restrained presentation is better than exhaustive presentation:
  No more than 3 key metrics should stand out on a single screen
  Everything else should be downgraded into supporting information

Color carries meaning, not decoration:
  Green = positive / growth
  Red = negative / warning
  Gray = neutral
  When color is insufficient, use shape, position, and hierarchy

Numbers should speak through typography:
  Use font-variant-numeric: tabular-nums for all numeric content
  Use var(--font-display) for primary KPIs
  Use var(--font-mono) for supporting metrics
```

---

## 2. Layout Structure {#layout}

### 2.1 Standard Dashboard Skeleton

```html
<div class="dashboard">
  <section class="dashboard-kpi-bar" aria-label="Core metrics">
    <div class="kpi-card">
      <span class="kpi-card__label">API Calls This Month</span>
      <span class="kpi-card__value">1,247,832</span>
      <span class="kpi-card__delta kpi-card__delta--up">+12.4%</span>
    </div>
    <div class="kpi-card">
      <span class="kpi-card__label">Average Response Time</span>
      <span class="kpi-card__value"
        >284<span class="kpi-card__unit">ms</span></span
      >
      <span class="kpi-card__delta kpi-card__delta--down">-8ms</span>
    </div>
    <div class="kpi-card">
      <span class="kpi-card__label">Error Rate</span>
      <span class="kpi-card__value"
        >0.12<span class="kpi-card__unit">%</span></span
      >
      <span class="kpi-card__delta kpi-card__delta--neutral">Flat</span>
    </div>
    <div class="kpi-card">
      <span class="kpi-card__label">Active API Keys</span>
      <span class="kpi-card__value">47</span>
      <span class="kpi-card__delta kpi-card__delta--up">+3 this week</span>
    </div>
  </section>

  <div class="dashboard-body">
    <section class="dashboard-main" aria-label="Usage trend">
      <div class="chart-card">
        <div class="chart-card__header">
          <div>
            <h2 class="chart-card__title">API Call Trend</h2>
            <p class="chart-card__subtitle">Past 30 days, grouped by model</p>
          </div>
          <div class="chart-card__controls">
            <div
              class="segmented segmented--sm"
              role="group"
              aria-label="Time range"
            >
              <button class="segmented__btn" aria-pressed="false">7d</button>
              <button
                class="segmented__btn segmented__btn--active"
                aria-pressed="true"
              >
                30d
              </button>
              <button class="segmented__btn" aria-pressed="false">90d</button>
            </div>
          </div>
        </div>
        <div class="chart-card__body">
          <canvas
            id="usage-chart"
            aria-label="API calls line chart"
            role="img"
          ></canvas>
        </div>
      </div>
    </section>

    <aside class="dashboard-aside">
      <div class="chart-card chart-card--sm">
        <div class="chart-card__header">
          <h3 class="chart-card__title">Model Usage Distribution</h3>
        </div>
        <div class="chart-card__body">
          <canvas id="model-pie" aria-label="Model share" role="img"></canvas>
          <ul class="chart-legend">
            <li class="chart-legend__item">
              <span
                class="chart-legend__dot"
                style="background: var(--chart-color-1)"
              ></span>
              <span class="chart-legend__label">Claude Sonnet</span>
              <span class="chart-legend__value">68%</span>
            </li>
            <li class="chart-legend__item">
              <span
                class="chart-legend__dot"
                style="background: var(--chart-color-2)"
              ></span>
              <span class="chart-legend__label">Claude Haiku</span>
              <span class="chart-legend__value">24%</span>
            </li>
            <li class="chart-legend__item">
              <span
                class="chart-legend__dot"
                style="background: var(--chart-color-3)"
              ></span>
              <span class="chart-legend__label">Claude Opus</span>
              <span class="chart-legend__value">8%</span>
            </li>
          </ul>
        </div>
      </div>

      <div class="chart-card chart-card--sm">
        <div class="chart-card__header">
          <h3 class="chart-card__title">Top 5 Keys By Usage</h3>
          <a href="#" class="btn btn-ghost" style="font-size:var(--text-xs)"
            >View all →</a
          >
        </div>
        <ul class="data-list">
          <li class="data-list__item">
            <span class="data-list__label">prod-key-01</span>
            <div class="data-list__bar-wrap">
              <div class="data-list__bar" style="width: 82%"></div>
            </div>
            <span class="data-list__value">82%</span>
          </li>
        </ul>
      </div>
    </aside>
  </div>

  <section class="dashboard-table-section" aria-label="Detailed call records">
    <div class="chart-card">
      <div class="chart-card__header">
        <h2 class="chart-card__title">Call Records</h2>
        <div class="chart-card__controls">
          <div class="search" style="max-width:240px">
            <div class="search__input-wrap">
              <svg
                class="search__icon"
                width="14"
                height="14"
                viewBox="0 0 16 16"
                fill="none"
              >
                <circle
                  cx="7"
                  cy="7"
                  r="5"
                  stroke="currentColor"
                  stroke-width="1.5"
                />
                <path
                  d="M11 11l3 3"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                />
              </svg>
              <input
                class="search__input"
                type="search"
                placeholder="Search keys or models…"
              />
            </div>
          </div>
          <button class="btn btn-secondary" style="font-size:var(--text-xs)">
            Export CSV
          </button>
        </div>
      </div>
    </div>
  </section>
</div>
```

### 2.2 Layout CSS

```css
.dashboard {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  padding: var(--space-8);
  background: var(--color-bg-base);
  min-height: 100vh;
}

.dashboard-kpi-bar {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-4);
}
@media (max-width: 1024px) {
  .dashboard-kpi-bar {
    grid-template-columns: repeat(2, 1fr);
  }
}
@media (max-width: 640px) {
  .dashboard-kpi-bar {
    grid-template-columns: 1fr;
  }
}

.dashboard-body {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: var(--space-6);
  align-items: start;
}
@media (max-width: 1200px) {
  .dashboard-body {
    grid-template-columns: 1fr;
  }
  .dashboard-aside {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-6);
  }
}
@media (max-width: 640px) {
  .dashboard-aside {
    grid-template-columns: 1fr;
  }
}

.chart-card {
  background: var(--color-bg-raised);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-xl);
  overflow: hidden;
}

.chart-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-5) var(--space-6);
  border-bottom: 1px solid var(--color-border-subtle);
  flex-wrap: wrap;
}
.chart-card__title {
  font-family: var(--font-heading);
  font-size: var(--text-base);
  font-weight: var(--weight-medium);
  color: var(--color-text-primary);
  margin: 0;
}
.chart-card__subtitle {
  font-family: var(--font-heading);
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  margin: var(--space-1) 0 0;
}
.chart-card__controls {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-shrink: 0;
}
.chart-card__body {
  padding: var(--space-5) var(--space-6);
}
```

---

## 3. Numbers And KPI Presentation {#metrics}

```css
.kpi-card {
  background: var(--color-bg-raised);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-lg);
  padding: var(--space-5) var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  transition: box-shadow 0.2s ease;
}
.kpi-card:hover {
  box-shadow: 0 4px 20px rgba(20, 20, 19, 0.06);
}

.kpi-card__label {
  font-family: var(--font-heading);
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--color-text-muted);
}

.kpi-card__value {
  font-family: var(--font-display);
  font-size: clamp(1.75rem, 2.5vw, 2.25rem);
  font-weight: 300;
  line-height: 1.1;
  letter-spacing: -0.02em;
  color: var(--color-text-primary);
  font-variant-numeric: tabular-nums;
}
.kpi-card__unit {
  font-size: 0.55em;
  font-weight: 400;
  color: var(--color-text-muted);
  margin-left: 2px;
}

.kpi-card__delta {
  font-family: var(--font-heading);
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
  font-variant-numeric: tabular-nums;
  display: inline-flex;
  align-items: center;
  gap: 3px;
}
.kpi-card__delta--up {
  color: var(--color-success);
}
.kpi-card__delta--down {
  color: var(--color-error);
}
.kpi-card__delta--neutral {
  color: var(--color-text-muted);
}

.kpi-card__delta--up::before {
  content: "↑";
}
.kpi-card__delta--down::before {
  content: "↓";
}
```

---

## 4. Chart Color Constraints {#chart-colors}

**Most important rule**:
chart colors must be derived from the brand palette.
Do not introduce arbitrary external colors.

```css
:root {
  --chart-color-1: #d97757;
  --chart-color-2: #6a9bcc;
  --chart-color-3: #788c5d;
  --chart-color-4: #c4b99a;
  --chart-color-5: #9b9890;

  --chart-bg: transparent;
  --chart-grid: var(--color-border-subtle);
  --chart-axis-label: var(--color-text-muted);
  --chart-tooltip-bg: var(--color-bg-inverted);
  --chart-tooltip-text: var(--color-text-inverted);
}
```

### Chart.js Template

```js
Chart.defaults.font.family = "'Poppins', 'DM Sans', sans-serif";
Chart.defaults.font.size = 11;
Chart.defaults.color = getComputedStyle(document.documentElement)
  .getPropertyValue('--color-text-muted').trim();

const lineChartConfig = {
  type: 'line',
  data: {
    labels: [...],
    datasets: [{
      label: 'Claude Sonnet',
      data: [...],
      borderColor: 'var(--chart-color-1)',
      backgroundColor: 'rgba(217, 119, 87, 0.08)',
      borderWidth: 2,
      pointRadius: 0,
      pointHoverRadius: 4,
      tension: 0.3,
      fill: true,
    }]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
  }
};
```

### Chart Usage Rules

```
Use color to distinguish:
  ✅ multi-line charts
  ✅ pie / donut charts
  ✅ semantic state charts

Do not use color to decorate:
  ❌ bars in the same series should not all be different colors
  ❌ heatmaps should use monochrome warm gradients, not rainbow palettes

Series limits:
  line chart -> max 4 lines
  pie chart -> max 5 slices
  grouped bar -> max 6 groups

Y-axis:
  bar charts must start from zero
  line charts may start above zero, but the starting range should be clearly indicated
```

---

## 5. Advanced Table Rules {#table-advanced}

Base table rules live in the display component file.
The following rules apply specifically to dense data scenarios:

```css
.table__td--numeric,
.table__th--numeric {
  text-align: right;
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.01em;
}

.table__td--status {
  white-space: nowrap;
}

.table-progress {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}
.table-progress__bar-wrap {
  flex: 1;
  height: 4px;
  background: var(--color-border-subtle);
  border-radius: var(--radius-full);
  overflow: hidden;
}
.table-progress__bar {
  height: 100%;
  background: var(--color-accent-orange);
  border-radius: var(--radius-full);
  transition: width 0.4s var(--ease-default);
}
.table-progress__value {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
  min-width: 36px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.table__td--sticky,
.table__th--sticky {
  position: sticky;
  left: 0;
  background: inherit;
  z-index: var(--z-raised);
  box-shadow: 2px 0 6px rgba(20, 20, 19, 0.06);
}
```

---

## 6. Status And Real-Time Data {#realtime}

Use status signals sparingly and semantically:

- `success` for healthy or completed
- `warning` for near-threshold or degraded
- `error` for broken, failed, or blocked
- muted gray for neutral or inactive

For real-time dashboards:

- only animate values that actually change
- keep animation subtle and numeric
- do not pulse every live element at once
- use timestamps like `Updated 14s ago` to reduce ambiguity

---

## 7. Empty And Loading States {#empty-loading}

Data-dense products still need calm empty states.

Rules:

- Empty states should name the missing object clearly
- Offer one obvious next action
- Loading placeholders should preserve final layout dimensions
- Skeletons are better than spinners for cards, tables, and charts

---

## 8. Information Hierarchy Control {#hierarchy}

On a dashboard screen:

- highlight no more than 3 primary metrics
- group related support metrics into cards or secondary tables
- use typography and spacing to create hierarchy before adding color
- reserve strong contrast for the most actionable information

Recommended hierarchy:

1. KPI strip
2. Main chart or main table
3. Secondary cards, lists, filters, and support details

---

## 9. Anti-Patterns {#anti-patterns}

Forbidden patterns:

- using bright rainbow chart palettes
- making every metric high contrast at once
- using oversized shadows on every card
- turning dashboards into dense spreadsheet walls with no hierarchy
- mixing too many chart types in one viewport
- decorating data with gradients unrelated to meaning
- using center-aligned tables or center-aligned long numbers
