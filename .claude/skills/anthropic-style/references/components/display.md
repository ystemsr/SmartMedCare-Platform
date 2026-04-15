## 21. Table {#table}

```html
<div class="table-wrap">
  <table class="table" aria-label="Model list">
    <thead class="table__head">
      <tr>
        <th class="table__th" scope="col">Model Name</th>
        <th class="table__th" scope="col">Context Length</th>
        <th class="table__th" scope="col">Status</th>
        <th class="table__th" scope="col">Last Updated</th>
        <th class="table__th table__th--action" scope="col">
          <span class="sr-only">Actions</span>
        </th>
      </tr>
    </thead>
    <tbody class="table__body">
      <tr class="table__row">
        <td class="table__td">Claude 3.7 Sonnet</td>
        <td class="table__td table__td--mono">200K</td>
        <td class="table__td">
          <span class="badge badge-green">Running</span>
        </td>
        <td class="table__td table__td--muted">March 2025</td>
        <td class="table__td table__td--action">
          <button class="btn btn-ghost">Manage</button>
        </td>
      </tr>
    </tbody>
  </table>
</div>
```

## 22. Timeline {#timeline}

```html
<ol class="timeline" aria-label="Version history">
  <li class="timeline__item timeline__item--active">
    <div class="timeline__marker" aria-hidden="true"></div>
    <div class="timeline__content">
      <time class="timeline__time" datetime="2025-03">March 2025</time>
      <h4 class="timeline__title">Claude 3.7 Sonnet Released</h4>
      <p class="timeline__body">
        Introduced extended thinking mode and stronger reasoning with 200K
        context.
      </p>
      <span class="badge badge-orange">Latest</span>
    </div>
  </li>
</ol>
```

## 23. Empty State {#empty-state}

```html
<div class="empty-state">
  <h3 class="empty-state__title">No models yet</h3>
  <p class="empty-state__body">
    Create your first model configuration to start using the Claude API.
  </p>
  <button class="btn btn-primary empty-state__action">Create model</button>
</div>
```

## 24. Banner / Alert {#banner}

```html
<div class="banner banner--info" role="status">
  <div class="banner__content">
    <strong class="banner__title">Scheduled maintenance notice</strong>
    <span class="banner__body"
      >Routine maintenance is planned for March 20, 02:00–04:00. The API may be
      briefly unavailable.</span
    >
  </div>
  <button class="banner__close" aria-label="Close notification">×</button>
</div>
```

## 25. Step Indicator {#step-indicator}

```html
<nav class="steps" aria-label="Creation flow">
  <ol class="steps__list">
    <li
      class="steps__step steps__step--done"
      aria-label="Step 1: Basic info completed"
    >
      <span class="steps__label">Basic Info</span>
    </li>
    <li
      class="steps__step steps__step--active"
      aria-label="Step 2: Permissions in progress"
      aria-current="step"
    >
      <span class="steps__label">Permissions</span>
    </li>
    <li
      class="steps__step"
      aria-label="Step 3: Environment variables not started"
    >
      <span class="steps__label">Environment Variables</span>
    </li>
    <li class="steps__step" aria-label="Step 4: Confirm deploy not started">
      <span class="steps__label">Confirm Deploy</span>
    </li>
  </ol>
</nav>
```

## Supplemental Components

Use this file for data presentation, process indicators, status messaging, and empty/loading states.
