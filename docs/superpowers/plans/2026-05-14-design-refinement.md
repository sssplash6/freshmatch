# Design Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refine the school-fit calculator UI — remove the floating card, switch to a clean white canvas, load Libre Baskerville, update selection state to a tinted row, and add precise motion transitions throughout.

**Architecture:** Pure CSS changes across 6 style files. No JSX or logic changes. Each task touches one file, runs the test suite to catch regressions, and commits.

**Tech Stack:** React 19, Vite, plain CSS (no CSS-in-JS), Google Fonts (Libre Baskerville), Vitest + React Testing Library

---

## File Map

| File | What changes |
|---|---|
| `index.html` | Add Google Fonts preconnect + stylesheet link |
| `src/styles/global.css` | CSS variables, card removal, body bg, `prefers-reduced-motion` |
| `src/styles/QuestionSlide.css` | Slide animation, option selection/hover/transition, button states |
| `src/styles/ProgressBar.css` | Height 2px→3px, easing upgrade |
| `src/styles/Interstitial.css` | Phase transition (fade+lift), button border-radius/hover/active |
| `src/styles/Results.css` | Phase transition (fade+lift), title font-weight |

---

### Task 1: Load Libre Baskerville from Google Fonts

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Add font preconnect and stylesheet to `index.html`**

Replace the `<head>` block with:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>calc</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Libre+Baskerville:wght@400;700&display=swap" rel="stylesheet" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

- [ ] **Step 2: Run tests to verify no regressions**

```bash
npm test
```

Expected: all tests pass (font loading does not affect logic tests)

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: load Libre Baskerville from Google Fonts"
```

---

### Task 2: Update CSS variables, remove card shell, add `prefers-reduced-motion`

**Files:**
- Modify: `src/styles/global.css`

Current file content for reference:
```css
:root {
  --bg: #faf9f7;
  --bg-outer: #f0ece3;
  --ink: #1a1a1a;
  --muted: #6b6560;
  --faint: #b0a89e;
  --rule: #ede9e2;
  --font-serif: 'Georgia', 'Times New Roman', serif;
  --font-sans: system-ui, -apple-system, sans-serif;
}
```

- [ ] **Step 1: Rewrite `src/styles/global.css`**

```css
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

:root {
  --bg: #ffffff;
  --bg-outer: #ffffff;
  --ink: #111111;
  --muted: #666666;
  --faint: #aaaaaa;
  --rule: #e8e8e8;
  --selected-bg: oklch(96.5% 0 0);
  --font-serif: 'Libre Baskerville', Georgia, serif;
  --font-sans: system-ui, -apple-system, sans-serif;
}

html, body, #root {
  height: 100%;
}

body {
  background: var(--bg);
  color: var(--ink);
  font-family: var(--font-serif);
  -webkit-font-smoothing: antialiased;
}

.app {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.card {
  width: 100%;
  max-width: 480px;
  background: var(--bg);
  display: flex;
  flex-direction: column;
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

Note: `.card` keeps its width/max-width/flex — it just loses `border-radius`, `box-shadow`, and `overflow: hidden`.

- [ ] **Step 2: Run tests**

```bash
npm test
```

Expected: all tests pass

- [ ] **Step 3: Commit**

```bash
git add src/styles/global.css
git commit -m "feat: update color tokens, remove card shell, add prefers-reduced-motion"
```

---

### Task 3: Update question slide animations and option states

**Files:**
- Modify: `src/styles/QuestionSlide.css`

- [ ] **Step 1: Rewrite `src/styles/QuestionSlide.css`**

```css
@keyframes slideInFromRight {
  from { transform: translateX(32px); opacity: 0; }
  to   { transform: translateX(0);    opacity: 1; }
}

@keyframes slideInFromLeft {
  from { transform: translateX(-32px); opacity: 0; }
  to   { transform: translateX(0);     opacity: 1; }
}

.question-slide {
  display: flex;
  flex-direction: column;
}

.question-slide.slide-forward {
  animation: slideInFromRight 280ms cubic-bezier(0.16, 1, 0.3, 1) both;
}

.question-slide.slide-back {
  animation: slideInFromLeft 280ms cubic-bezier(0.16, 1, 0.3, 1) both;
}

/* Header */
.slide-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 22px 32px 0;
}

.section-label,
.q-counter {
  font-family: var(--font-sans);
  font-size: 10px;
  letter-spacing: 3px;
  text-transform: uppercase;
  color: var(--faint);
}

/* Question */
.question-text {
  padding: 28px 32px 0;
  font-family: var(--font-serif);
  font-size: 21px;
  font-weight: 400;
  line-height: 1.55;
  color: var(--ink);
}

/* Options */
.options {
  padding: 28px 32px 0;
  display: flex;
  flex-direction: column;
}

.option {
  display: flex;
  align-items: baseline;
  gap: 16px;
  padding: 11px 4px;
  margin: 0 -4px;
  cursor: pointer;
  border-top: 1px solid var(--rule);
  border-radius: 3px;
  transition: color 180ms cubic-bezier(0.22, 1, 0.36, 1),
              background-color 180ms cubic-bezier(0.22, 1, 0.36, 1);
}

.option:last-child {
  border-bottom: 1px solid var(--rule);
}

/* Hover before any selection */
.option:not(.selected):not(.dimmed):hover .option-letter,
.option:not(.selected):not(.dimmed):hover .option-text {
  color: #333333;
}

.option-letter {
  font-family: var(--font-sans);
  font-size: 10px;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: var(--faint);
  min-width: 12px;
  flex-shrink: 0;
  transition: color 180ms cubic-bezier(0.22, 1, 0.36, 1);
}

.option-text {
  font-family: var(--font-sans);
  font-size: 13px;
  line-height: 1.55;
  color: var(--muted);
  transition: color 180ms cubic-bezier(0.22, 1, 0.36, 1);
}

/* Selected state */
.option.selected {
  background-color: var(--selected-bg);
  border-top-color: transparent;
}

.option.selected + .option {
  border-top-color: transparent;
}

.option.selected .option-letter {
  color: var(--ink);
  font-weight: 600;
}

.option.selected .option-text {
  color: var(--ink);
  font-weight: 500;
}

/* Dimmed state */
.option.dimmed .option-letter,
.option.dimmed .option-text {
  color: #dddddd;
}

/* Footer */
.slide-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px 32px 36px;
}

.back-btn {
  font-family: var(--font-sans);
  font-size: 11px;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: var(--faint);
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  opacity: 0.5;
  transition: opacity 150ms cubic-bezier(0.22, 1, 0.36, 1);
}

.back-btn:hover {
  opacity: 1;
}

.next-btn {
  font-family: var(--font-sans);
  font-size: 11px;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: var(--bg);
  background: var(--ink);
  border: none;
  border-radius: 2px;
  padding: 12px 28px;
  cursor: pointer;
  opacity: 0.2;
  transition: opacity 200ms cubic-bezier(0.22, 1, 0.36, 1),
              background-color 150ms cubic-bezier(0.22, 1, 0.36, 1),
              transform 100ms cubic-bezier(0.22, 1, 0.36, 1);
}

.next-btn.active {
  opacity: 1;
}

.next-btn.active:hover {
  background-color: #333333;
}

.next-btn.active:active {
  transform: scale(0.98);
}
```

- [ ] **Step 2: Run tests**

```bash
npm test
```

Expected: all tests pass

- [ ] **Step 3: Commit**

```bash
git add src/styles/QuestionSlide.css
git commit -m "feat: update slide animation, option selection state, button interactions"
```

---

### Task 4: Update progress bar

**Files:**
- Modify: `src/styles/ProgressBar.css`

- [ ] **Step 1: Rewrite `src/styles/ProgressBar.css`**

```css
.progress-rail {
  width: 100%;
  height: 3px;
  background: var(--rule);
}

.progress-fill {
  height: 100%;
  background: var(--ink);
  transition: width 500ms cubic-bezier(0.16, 1, 0.3, 1);
}
```

- [ ] **Step 2: Run tests**

```bash
npm test
```

Expected: all tests pass

- [ ] **Step 3: Commit**

```bash
git add src/styles/ProgressBar.css
git commit -m "feat: progress bar 3px height, ease-out-expo easing"
```

---

### Task 5: Update Interstitial phase transition and button

**Files:**
- Modify: `src/styles/Interstitial.css`

- [ ] **Step 1: Rewrite `src/styles/Interstitial.css`**

```css
@keyframes fadeUp {
  from { transform: translateY(12px); opacity: 0; }
  to   { transform: translateY(0);    opacity: 1; }
}

.interstitial {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 64px 40px;
  gap: 20px;
  min-height: 380px;
  animation: fadeUp 320ms cubic-bezier(0.16, 1, 0.3, 1) both;
}

.interstitial-eyebrow {
  font-family: var(--font-sans);
  font-size: 10px;
  letter-spacing: 4px;
  text-transform: uppercase;
  color: var(--faint);
}

.interstitial-divider {
  width: 32px;
  height: 1px;
  background: var(--rule);
}

.interstitial-title {
  font-family: var(--font-serif);
  font-size: 24px;
  font-weight: 400;
  color: var(--ink);
  line-height: 1.45;
}

.interstitial-sub {
  font-family: var(--font-sans);
  font-size: 13px;
  color: var(--muted);
  max-width: 240px;
  line-height: 1.7;
}

.interstitial-begin {
  font-family: var(--font-sans);
  font-size: 11px;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: var(--bg);
  background: var(--ink);
  border: none;
  border-radius: 2px;
  padding: 13px 32px;
  cursor: pointer;
  margin-top: 8px;
  transition: background-color 150ms cubic-bezier(0.22, 1, 0.36, 1),
              transform 100ms cubic-bezier(0.22, 1, 0.36, 1);
}

.interstitial-begin:hover {
  background-color: #333333;
}

.interstitial-begin:active {
  transform: scale(0.98);
}
```

- [ ] **Step 2: Run tests**

```bash
npm test
```

Expected: all tests pass

- [ ] **Step 3: Commit**

```bash
git add src/styles/Interstitial.css
git commit -m "feat: interstitial fade+lift entrance, button hover/active states"
```

---

### Task 6: Update Results phase transition and title

**Files:**
- Modify: `src/styles/Results.css`

- [ ] **Step 1: Rewrite `src/styles/Results.css`**

```css
@keyframes fadeUp {
  from { transform: translateY(12px); opacity: 0; }
  to   { transform: translateY(0);    opacity: 1; }
}

.results {
  display: flex;
  flex-direction: column;
  padding: 36px 32px 44px;
  gap: 0;
  animation: fadeUp 320ms cubic-bezier(0.16, 1, 0.3, 1) both;
}

.results-eyebrow {
  font-family: var(--font-sans);
  font-size: 10px;
  letter-spacing: 4px;
  text-transform: uppercase;
  color: var(--faint);
  margin-bottom: 10px;
}

.results-title {
  font-family: var(--font-serif);
  font-size: 26px;
  font-weight: 700;
  color: var(--ink);
  line-height: 1.3;
  margin-bottom: 20px;
}

.results-desc {
  font-family: var(--font-sans);
  font-size: 13px;
  color: var(--muted);
  line-height: 1.75;
  margin-bottom: 28px;
}

.results-divider {
  width: 100%;
  height: 1px;
  background: var(--rule);
  margin-bottom: 24px;
}

.schools-label {
  font-family: var(--font-sans);
  font-size: 10px;
  letter-spacing: 3px;
  text-transform: uppercase;
  color: var(--faint);
  margin-bottom: 16px;
}

.school-list {
  display: flex;
  flex-direction: column;
}

.school-item {
  font-family: var(--font-sans);
  font-size: 13px;
  color: var(--ink);
  padding: 11px 0;
  border-top: 1px solid var(--rule);
}

.school-item:last-child {
  border-bottom: 1px solid var(--rule);
}

.school-item.adjusted {
  color: var(--faint);
  font-style: italic;
}

.no-schools-msg {
  font-family: var(--font-sans);
  font-size: 13px;
  color: var(--muted);
  line-height: 1.7;
  font-style: italic;
  padding: 16px 0;
  border-top: 1px solid var(--rule);
  border-bottom: 1px solid var(--rule);
}

.restart-btn {
  margin-top: 28px;
  font-family: var(--font-sans);
  font-size: 11px;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: var(--faint);
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  align-self: flex-start;
  opacity: 0.5;
  transition: opacity 150ms cubic-bezier(0.22, 1, 0.36, 1);
}

.restart-btn:hover {
  opacity: 1;
}
```

- [ ] **Step 2: Run tests**

```bash
npm test
```

Expected: all tests pass

- [ ] **Step 3: Commit**

```bash
git add src/styles/Results.css
git commit -m "feat: results fade+lift entrance, bold serif title, restart hover state"
```

---

### Task 7: Visual verification

**Files:** none (read-only verification step)

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

Open `http://localhost:5173` in your browser.

- [ ] **Step 2: Walk through the full quiz flow and check each screen**

Section 1 questions:
- Background is white — no card border, no shadow, no cream outer background
- Progress bar is 3px, dark, fills smoothly with ease-out-expo on each advance
- Question text renders in Libre Baskerville (not Georgia — the letterforms are visibly different, notably the `a` and `g`)
- Hovering an unselected option darkens the text slightly to `#333`
- Clicking an option: row gets a light gray tint background, letter turns bold, adjacent borders disappear cleanly
- Unselected options fade to `#ddd`
- Continue button fades from 20% to 100% opacity once an option is selected
- Hovering Continue button darkens it to `#333`
- Pressing Continue button visibly scales down to 0.98 on click
- Question slide animates in from the right at 280ms — snappy, not floaty
- Back button is 50% opacity, brightens to 100% on hover
- Going back: slide animates in from the left

Interstitial:
- Fades up from `translateY(12px)` at 320ms — noticeably different feel from question slides
- Divider line is slightly wider (32px vs 24px before)
- Begin button has border-radius: 2px, hover darkens, click scales

Results:
- Same fade+lift entrance as Interstitial
- Result title renders in Libre Baskerville **bold** (font-weight 700) — visibly heavier than before
- School list rows have clean 1px rules

- [ ] **Step 3: Run full test suite one final time**

```bash
npm test
```

Expected: all tests pass

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete design refinement — white canvas, Libre Baskerville, precision motion"
```
