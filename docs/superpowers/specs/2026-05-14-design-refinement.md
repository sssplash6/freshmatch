# Design Refinement

**Date:** 2026-05-14
**Scope:** Visual redesign of the school-fit calculator — typography, color, selection state, motion, card removal.

---

## Summary

A thorough visual refinement of the existing quiz UI. No structural or logic changes. The goal is to make the interface feel more precise and trustworthy — matching the product's purpose as a frank, calm assessment tool for CIS students applying abroad.

---

## Changes

### 1. Background and card removal

- Remove `.card` `border-radius`, `box-shadow`, and outer `--bg-outer` background
- Set `body` and `html` background to white (`oklch(100% 0 0)` tinted slightly toward neutral)
- The page IS the card — content sits directly on white, constrained to `max-width: 480px`, centered
- Progress bar sits at the very top edge of the content area

### 2. Color palette

| Token | Before | After |
|---|---|---|
| `--bg` | `#faf9f7` | `#ffffff` |
| `--bg-outer` | `#f0ece3` | `#ffffff` |
| `--rule` | `#ede9e2` | `#e8e8e8` |
| `--faint` | `#b0a89e` | `#aaaaaa` |
| `--muted` | `#6b6560` | `#666666` |
| `--ink` | `#1a1a1a` | `#111111` |
| `--selected-bg` | (none) | `oklch(96.5% 0 0)` |

### 3. Typography

- Load **Libre Baskerville** (400, 700) from Google Fonts in `index.html`
- `--font-serif`: change from `'Georgia', 'Times New Roman', serif` to `'Libre Baskerville', Georgia, serif`
- Applied to: `.question-text`, `.results-title`, `.interstitial-title`
- All sans-serif elements stay on system-ui

### 4. Option selection state

Replace the color-only selection indicator with a tinted-row approach:

- **Selected**: `background-color: var(--selected-bg)` on the row + `border-radius: 3px` + `font-weight: 600` on letter + `font-weight: 500` on text. Suppress adjacent borders so the tinted row floats cleanly against the rule lines.
- **Dimmed**: color fades to `#dddddd` (unchanged behavior, new value)
- **No left-border stripe** — explicitly removed, replaced by background tint

The row uses `padding: 11px 4px; margin: 0 -4px` so the tinted background bleeds 4px into the `.options` padding on each side — full-bleed look without changing the text alignment.

CSS changes in `QuestionSlide.css`:
```css
.option {
  padding: 11px 4px;
  margin: 0 -4px;
  border-radius: 3px;
  transition: color 180ms cubic-bezier(0.22, 1, 0.36, 1),
              background-color 180ms cubic-bezier(0.22, 1, 0.36, 1);
}

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

.option.dimmed .option-letter,
.option.dimmed .option-text {
  color: #dddddd;
}

/* Hover before any selection is made */
.option:not(.selected):not(.dimmed):hover .option-letter,
.option:not(.selected):not(.dimmed):hover .option-text {
  color: #333333;
}
```

### 5. Motion

All easing uses `ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1)` or `ease-out-quint: cubic-bezier(0.22, 1, 0.36, 1)`.

| Element | Property | Duration | Easing |
|---|---|---|---|
| Question slide (forward) | `translateX(32px→0)` + `opacity` | 280ms | ease-out-expo |
| Question slide (back) | `translateX(-32px→0)` + `opacity` | 280ms | ease-out-expo |
| Option color + bg | `color`, `background-color` | 180ms | ease-out-quint |
| Continue button opacity | `opacity` | 200ms | ease-out-quint |
| Progress bar width | `width` | 500ms | ease-out-expo |
| Phase enter (Interstitial, Results) | `opacity` + `translateY(12px→0)` | 320ms | ease-out-expo |

Slide translate distance: 40px → 32px (less theatrical).

Phase transitions change from slideInFromRight to a fade + lift (`translateY`), distinguishing them visually from question-to-question navigation.

Add `prefers-reduced-motion` override in `global.css`:
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

### 6. Progress bar

- Height: `2px` → `3px`
- Easing upgrade: current `cubic-bezier(0.4, 0, 0.2, 1)` → `ease-out-expo`

### 7. Buttons

- `border-radius: 2px` on `.next-btn` and `.interstitial-begin`
- Continue button transition: `0.25s` → `200ms ease-out-quint`
- **Hover**: background shifts `#111 → #333`, transition `150ms ease-out-quint`
- **Active**: `transform: scale(0.98)`, transition `100ms ease-out-quint` — tactile press feedback
- **Back button hover**: `opacity: 0.5 → 1`, transition `150ms ease-out-quint`

### 8. Results page

- `.results-title`: font-size `26px` → `26px`, switch to Libre Baskerville bold (`font-weight: 700`)

---

## What is NOT changing

- Component structure and JSX
- CSS variable names
- Quiz logic, routing, scoring
- Max-width (480px) and centering
- Section labels, counters, back/next button placement

---

## Files to modify

| File | Changes |
|---|---|
| `index.html` | Add Google Fonts link for Libre Baskerville |
| `src/styles/global.css` | Color tokens, body bg, remove outer bg, `prefers-reduced-motion`; remove `.card` `border-radius`, `box-shadow`, `overflow: hidden` |
| `src/styles/QuestionSlide.css` | Selection state, option hover, option transitions, slide animation, button hover/active states |
| `src/styles/ProgressBar.css` | Height, easing |
| `src/styles/Interstitial.css` | Phase transition (fade+lift), button border-radius, hover/active states |
| `src/styles/Results.css` | Phase transition (fade+lift), title font-weight |
