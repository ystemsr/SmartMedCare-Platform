# Feedback And Input Components

## Contents

1. [Number Stepper](#number-stepper)
2. [Radio Group](#radio-group)
3. [File Upload / Dropzone](#dropzone)
4. [Segmented Control](#segmented-control)
5. [Status Indicator](#status-indicator)
6. [Rating](#rating)
7. [Notification Dropdown](#notification)

---

## 36. Number Stepper {#number-stepper}

```html
<div class="stepper" role="group" aria-labelledby="stepper-label-1">
  <label class="stepper__label" id="stepper-label-1">Request Concurrency</label>
  <div class="stepper__control">
    <button
      class="stepper__btn"
      aria-label="Decrease"
      data-stepper-action="dec"
    >
      −
    </button>
    <input
      class="stepper__input"
      type="number"
      value="4"
      min="1"
      max="100"
      step="1"
    />
    <button
      class="stepper__btn"
      aria-label="Increase"
      data-stepper-action="inc"
    >
      +
    </button>
  </div>
  <p class="stepper__hint">Range 1–100</p>
</div>
```

## 37. Radio Group {#radio-group}

```html
<fieldset class="radio-group">
  <legend class="radio-group__legend">Choose a Plan</legend>
  <div class="radio-group__list">
    <label class="radio-item"
      ><input type="radio" name="plan" value="free" /> Free</label
    >
    <label class="radio-item"
      ><input type="radio" name="plan" value="pro" checked /> Pro</label
    >
    <label class="radio-item"
      ><input type="radio" name="plan" value="enterprise" /> Enterprise</label
    >
  </div>
</fieldset>
```

## 38. File Upload / Dropzone {#dropzone}

```html
<label class="dropzone">
  <input type="file" class="dropzone__input" hidden />
  <span class="dropzone__title">Drop a file here or browse</span>
  <span class="dropzone__hint">PDF, TXT, or Markdown. Up to 10MB.</span>
</label>
```

## 39. Segmented Control {#segmented-control}

```html
<div class="segmented" role="group" aria-label="View mode">
  <button class="segmented__btn segmented__btn--active" aria-pressed="true">
    Daily
  </button>
  <button class="segmented__btn" aria-pressed="false">Weekly</button>
  <button class="segmented__btn" aria-pressed="false">Monthly</button>
</div>
```

## 40. Status Indicator {#status-indicator}

```html
<div class="status-indicator status-indicator--success">
  <span class="status-indicator__dot" aria-hidden="true"></span>
  <span class="status-indicator__label">Healthy</span>
</div>
```

## 41. Rating {#rating}

```html
<fieldset class="rating" aria-label="Rate this answer">
  <label><input type="radio" name="rating" value="5" />★</label>
  <label><input type="radio" name="rating" value="4" />★</label>
  <label><input type="radio" name="rating" value="3" />★</label>
  <label><input type="radio" name="rating" value="2" />★</label>
  <label><input type="radio" name="rating" value="1" />★</label>
</fieldset>
```

## 42. Notification Dropdown {#notification}

```html
<div class="notif">
  <button
    class="notif-trigger"
    aria-label="Notifications, 3 unread"
    aria-haspopup="true"
    aria-expanded="false"
  >
    🔔
  </button>
  <div
    class="notif-panel"
    role="dialog"
    aria-label="Notifications"
    aria-hidden="true"
  >
    <h4 class="notif-panel__title">Notifications</h4>
    <button class="btn btn-ghost" style="font-size:var(--text-xs)">
      Mark all as read
    </button>
    <div class="notif-item notif-item--unread">
      <p class="notif-item__title">API usage reached 90%</p>
      <p class="notif-item__body">
        Upgrade soon to avoid service interruption.
      </p>
      <time class="notif-item__time" datetime="2025-03-16T10:30"
        >10 minutes ago</time
      >
    </div>
  </div>
</div>
```

## Chat UI Supplement

This file complements the main chat component file with interactive feedback patterns used in AI interfaces.
