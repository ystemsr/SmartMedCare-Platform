## 43. Chat UI {#chat-ui}

This is the core Anthropic product pattern.
Differentiate user messages and AI messages through layout and background treatment,
not cartoon bubbles.
Use left-right alignment and preserve generous breathing room.

```html
<div class="chat-layout">
  <aside class="chat-sidebar">
    <div class="chat-sidebar__header">
      <button class="btn btn-primary" style="width:100%;justify-content:center">
        New Chat
      </button>
    </div>
    <nav class="chat-history" aria-label="Conversation history">
      <div class="chat-history__section-label">Today</div>
      <a
        href="#"
        class="chat-history__item chat-history__item--active"
        aria-current="page"
      >
        <span class="chat-history__title"
          >Design principles for Constitutional AI</span
        >
        <span class="chat-history__time">14:32</span>
      </a>
      <a href="#" class="chat-history__item">
        <span class="chat-history__title">Help me write API documentation</span>
        <span class="chat-history__time">10:15</span>
      </a>
      <div class="chat-history__section-label">Yesterday</div>
      <a href="#" class="chat-history__item">
        <span class="chat-history__title">Python code review</span>
        <span class="chat-history__time">Friday</span>
      </a>
    </nav>
  </aside>

  <main class="chat-main" aria-label="Conversation content">
    <div
      class="chat-messages"
      role="log"
      aria-live="polite"
      aria-label="Conversation messages"
    >
      <div class="chat-msg chat-msg--user">
        <div class="chat-msg__content">
          <p>
            How does Constitutional AI work, and how is it different from RLHF?
          </p>
        </div>
      </div>

      <div class="chat-msg chat-msg--ai">
        <div class="chat-msg__meta">
          <span class="chat-msg__sender">Claude</span>
          <time class="chat-msg__time" datetime="2025-03-17T14:32">14:32</time>
        </div>
        <div class="chat-msg__content">
          <p>
            Constitutional AI is a training approach proposed by Anthropic in
            which the model critiques and revises outputs against an explicit
            set of principles.
          </p>
          <ul>
            <li>
              <strong>Source of supervision</strong>: RLHF depends heavily on
              human labels, while Constitutional AI reduces that reliance
              through self-critique.
            </li>
            <li>
              <strong>Interpretability</strong>: the evaluation criteria are
              explicit and easier to inspect.
            </li>
            <li>
              <strong>Scalability</strong>: less dependence on manual labeling
              improves scalability.
            </li>
          </ul>
        </div>
        <div class="chat-tool-use" aria-label="Tool call">
          <div class="chat-tool-use__header">
            <span>Searched paper database</span>
          </div>
          <p class="chat-tool-use__result">
            Found 3 relevant papers, including Constitutional AI (Bai et al.,
            2022).
          </p>
        </div>
      </div>

      <div
        class="chat-msg chat-msg--ai chat-msg--streaming"
        aria-label="AI is responding"
        aria-busy="true"
      >
        <div class="chat-msg__meta">
          <span class="chat-msg__sender">Claude</span>
        </div>
        <div class="chat-msg__content">
          <span class="chat-typing-indicator" aria-hidden="true"
            ><span></span><span></span><span></span
          ></span>
        </div>
      </div>
    </div>

    <div class="chat-input-area">
      <div class="chat-input-wrap">
        <button class="chat-input-btn" aria-label="Upload attachment">+</button>
        <textarea
          class="chat-textarea"
          placeholder="Send a message to Claude…"
          rows="1"
          aria-label="Message input"
          aria-multiline="true"
        ></textarea>
        <button class="chat-send-btn" aria-label="Send message" disabled>
          →
        </button>
      </div>
      <p class="chat-input-hint">
        Claude may make mistakes. Verify important information.
      </p>
    </div>
  </main>
</div>
```
