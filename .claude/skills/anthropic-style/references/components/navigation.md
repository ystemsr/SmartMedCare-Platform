## 11. Sidebar {#sidebar}

```html
<div class="app-layout">
  <aside class="sidebar" id="sidebar" aria-label="Primary navigation">
    <div class="sidebar__brand">
      <span class="sidebar__logo">⬡</span>
      <span class="sidebar__brand-name">Anthropic</span>
    </div>

    <nav class="sidebar__nav">
      <div class="sidebar__section-label">Main Menu</div>
      <ul class="sidebar__list">
        <li>
          <a
            href="#"
            class="sidebar__item sidebar__item--active"
            aria-current="page"
            >Overview</a
          >
        </li>
        <li><a href="#" class="sidebar__item">Users</a></li>
        <li>
          <a href="#" class="sidebar__item"
            >Models <span class="sidebar__badge">3</span></a
          >
        </li>
        <li><a href="#" class="sidebar__item">Logs</a></li>
      </ul>
      <div class="sidebar__section-label">Settings</div>
      <ul class="sidebar__list">
        <li><a href="#" class="sidebar__item">Preferences</a></li>
      </ul>
    </nav>
  </aside>
</div>
```

## 12. Tabs {#tabs}

```html
<div class="tabs" role="tablist" aria-label="Content sections">
  <button class="tabs__tab" role="tab" aria-selected="true">Overview</button>
  <button class="tabs__tab" role="tab" aria-selected="false">Models</button>
  <button class="tabs__tab" role="tab" aria-selected="false">Logs</button>
  <button class="tabs__tab" role="tab" aria-selected="false">Settings</button>
</div>
```

## 13. Breadcrumb {#breadcrumb}

```html
<nav aria-label="Breadcrumb">
  <ol class="breadcrumb">
    <li><a href="/" class="breadcrumb__link">Home</a></li>
    <li><a href="/models" class="breadcrumb__link">Model Management</a></li>
    <li aria-current="page">Claude Sonnet</li>
  </ol>
</nav>
```

## 14. Pagination {#pagination}

```html
<nav class="pagination" aria-label="Pagination">
  <button class="pagination__btn" aria-label="Previous page" disabled>
    ← Previous
  </button>
  <button class="pagination__btn" aria-label="Next page">Next →</button>
</nav>
```

## 15. Dropdown {#dropdown}

```html
<div class="dropdown">
  <button class="btn btn-secondary">Actions</button>
  <div class="dropdown__menu" role="menu">
    <button class="dropdown__item">Create model</button>
    <button class="dropdown__item">View logs</button>
    <button class="dropdown__item">Delete</button>
  </div>
</div>
```

## Forms And Interaction

Use this file for navigation primitives, orientation patterns, and compact control surfaces.
