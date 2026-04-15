# Complete Component Examples

## Contents

1. [Hero Section](#hero)
2. [Feature Card Grid](#feature-grid)
3. [Stats Display](#stats)
4. [Blockquote](#blockquote)
5. [Pricing Card](#pricing)
6. [Dark CTA Section](#cta-dark)
7. [Code Block](#code-block)
8. [Toast](#toast)
9. [Skeleton Loader](#skeleton)

---

## 1. Hero Section {#hero}

```html
<section class="hero">
  <div class="page-container">
    <div class="hero__inner">
      <div class="badge badge-orange reveal">
        <span>New Feature</span>
        <span>Claude 3.7 is now available</span>
      </div>
      <h1 class="hero__title reveal">
        AI built for<br />
        <em>human values</em>
      </h1>
      <p class="hero__body reveal">
        We believe the future of AI should be safe, interpretable, and genuinely
        beneficial to everyone.
      </p>
      <div class="hero__actions reveal">
        <a href="#" class="btn btn-primary">Get started</a>
        <a href="#" class="btn btn-secondary">Learn more</a>
      </div>
    </div>
  </div>
</section>
```

## 2. Feature Card Grid {#feature-grid}

```html
<section class="features">
  <div class="page-container">
    <div class="section-label">Core Capabilities</div>
    <h2 class="section-title">Designed for reliability</h2>
    <div class="features__grid">
      <article class="feature-card scroll-reveal">
        <div class="feature-card__icon">
          <svg><!-- icon --></svg>
        </div>
        <h3 class="feature-card__title">Constitutional AI Training</h3>
        <p class="feature-card__body">
          Principle-driven training helps the model favor safe and honest
          answers.
        </p>
        <a class="feature-card__link" href="#">Learn more →</a>
      </article>
    </div>
  </div>
</section>
```

## 3. Stats Display {#stats}

```html
<section class="stats-bar">
  <div class="page-container">
    <dl class="stats-bar__grid">
      <div class="stat-item">
        <dt class="stat-item__label">Funding</dt>
        <dd class="stat-item__value">$7.3B+</dd>
      </div>
      <div class="stat-item">
        <dt class="stat-item__label">Research Team</dt>
        <dd class="stat-item__value">800+</dd>
      </div>
      <div class="stat-item">
        <dt class="stat-item__label">Monthly Active Users</dt>
        <dd class="stat-item__value">Tens of millions</dd>
      </div>
    </dl>
  </div>
</section>
```

## 4. Blockquote {#blockquote}

```html
<blockquote class="blockquote-card">
  <p>
    We believe the people most likely to build safe AI systems are the ones who
    understand the risks and actively work to solve them.
  </p>
  <footer class="blockquote-card__footer">
    <div class="blockquote-card__role">CEO & Co-founder</div>
  </footer>
</blockquote>
```

## 5. Pricing Card {#pricing}

```html
<article class="pricing-card pricing-card--featured">
  <span class="badge badge-orange">Most Popular</span>
  <h3 class="pricing-card__title">Pro</h3>
  <div class="pricing-card__price">
    $20 <span class="pricing-card__period">/ month</span>
  </div>
  <p class="pricing-card__desc">For professional users and creators.</p>
  <ul class="pricing-card__list">
    <li><span class="check-icon">✓</span> Unlimited Claude Sonnet usage</li>
    <li><span class="check-icon">✓</span> Priority access to new features</li>
    <li><span class="check-icon">✓</span> 100K token context window</li>
  </ul>
  <a href="#" class="btn btn-primary" style="width:100%;justify-content:center"
    >Start a 14-day free trial</a
  >
</article>
```

## 6. Dark CTA Section {#cta-dark}

```html
<section class="cta-dark">
  <div class="page-container">
    <h2 class="cta-dark__title">Ready to begin?</h2>
    <p class="cta-dark__body">
      Join millions of users and experience a different kind of AI conversation.
    </p>
    <div class="cta-dark__actions">
      <a href="#" class="btn btn-primary">Start free</a>
      <a
        href="#"
        class="btn"
        style="color:var(--color-text-inverted);border-color:rgba(250,249,245,0.3)"
        >Contact sales</a
      >
    </div>
  </div>
</section>
```

## 7. Code Block {#code-block}

```html
<div class="code-block">
  <div class="code-block__header">
    <button class="code-block__copy" onclick="copyCode(this)">Copy</button>
  </div>
  <pre><code>curl https://api.example.com/v1/messages</code></pre>
</div>
```

## 8. Toast {#toast}

```html
<div class="toast" role="status">
  <svg class="toast__icon"><!-- icon --></svg>
  <p class="toast__message">Action completed successfully</p>
  <button class="toast__close" aria-label="Close">×</button>
</div>
```

## 9. Skeleton Loader {#skeleton}

```html
<div class="skeleton-card" aria-busy="true" aria-label="Loading">
  <div class="skeleton skeleton--title"></div>
  <div class="skeleton skeleton--line"></div>
  <div class="skeleton skeleton--line"></div>
</div>
```

## Navigation And Structure

Use this file for hero, marketing, stats, pricing, and other foundational display blocks.
