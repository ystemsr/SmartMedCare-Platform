## 16. Form {#form}

```html
<form class="form" novalidate>
  <div class="form__header">
    <h2 class="form__title">Create API Key</h2>
    <p class="form__subtitle">
      Fill in the fields below to generate a new access key
    </p>
  </div>

  <div class="form__body">
    <div class="form__field">
      <label class="form__label" for="key-name">
        Key Name
        <span class="form__required" aria-hidden="true">*</span>
      </label>
      <input
        class="input"
        type="text"
        id="key-name"
        name="keyName"
        placeholder="Example: Production Primary Key"
        required
        autocomplete="off"
      />
      <p class="form__hint">
        Used for identification only and does not affect permissions
      </p>
    </div>

    <div class="form__field">
      <label class="form__label" for="permission">Permission Level</label>
      <select class="input form__select" id="permission" name="permission">
        <option value="">Select a permission</option>
        <option value="read">Read Only</option>
        <option value="write">Read / Write</option>
        <option value="admin">Administrator</option>
      </select>
    </div>

    <div class="form__field">
      <label class="form__label" for="description">Notes</label>
      <textarea
        class="input form__textarea"
        id="description"
        name="description"
        rows="3"
        placeholder="Optional. Record intended use or operational notes"
      ></textarea>
    </div>

    <div class="form__field">
      <label class="form__checkbox-label">
        <input type="checkbox" class="form__checkbox" name="agree" required />
        <span class="form__checkbox-custom" aria-hidden="true"></span>
        I have read and agree to the
        <a href="#" class="form__link">API Terms of Use</a>
      </label>
    </div>

    <div class="form__error-banner" role="alert" hidden>
      Please review and correct the highlighted fields above
    </div>
  </div>

  <div class="form__footer">
    <button type="button" class="btn btn-secondary">Cancel</button>
    <button type="submit" class="btn btn-primary">Generate Key</button>
  </div>
</form>
```

## 17. Toggle / Switch {#toggle}

```html
<label class="toggle" aria-label="Enable dark mode">
  <input
    type="checkbox"
    class="toggle__input"
    role="switch"
    aria-checked="false"
  />
  <span class="toggle__track" aria-hidden="true"
    ><span class="toggle__thumb"></span
  ></span>
  <span class="toggle__label">Dark Mode</span>
</label>
```

## 18. Tooltip {#tooltip}

```html
<div class="tooltip tooltip--top">
  <button class="btn btn-secondary">Advanced Options</button>
  <div class="tooltip__content" role="tooltip">
    Includes experimental parameters. Read the documentation before changing
    them.
  </div>
</div>
```

## 19. Modal {#modal}

```html
<button class="btn btn-primary" onclick="openModal('confirm-modal')">
  Delete Model
</button>

<div class="modal-overlay" id="confirm-modal" hidden>
  <div
    class="modal"
    role="dialog"
    aria-modal="true"
    aria-labelledby="modal-title"
  >
    <div class="modal__header">
      <h3 class="modal__title" id="modal-title">Confirm Deletion</h3>
      <button
        class="modal__close"
        aria-label="Close"
        onclick="closeModal('confirm-modal')"
      >
        ×
      </button>
    </div>
    <div class="modal__body">
      <p>
        You are about to delete <strong>Claude 3.7 Sonnet</strong>. This action
        cannot be undone.
      </p>
    </div>
    <div class="modal__footer">
      <button class="btn btn-secondary" onclick="closeModal('confirm-modal')">
        Cancel
      </button>
      <button
        class="btn"
        style="background:var(--color-error);color:white;border-color:var(--color-error)"
      >
        Confirm Delete
      </button>
    </div>
  </div>
</div>
```

## 20. Accordion {#accordion}

```html
<div class="accordion">
  <details class="accordion__item" open>
    <summary class="accordion__summary">
      How does Claude protect user privacy?
    </summary>
    <div class="accordion__content">
      We do not use user conversations for model training. Data transmission is
      encrypted, and history can be reviewed or deleted in privacy settings.
    </div>
  </details>
</div>
```

## Content Display

Use this file for forms, toggles, tooltips, modals, and disclosure patterns.
