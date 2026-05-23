# Keyboard Fix Notes

This document summarizes how the iPhone PWA keyboard jump issue was resolved in this project.

## Symptom

On iPhone Safari / iOS PWA:

- The page jumped when the keyboard opened.
- The page jumped again when the keyboard closed.
- The composer could land in the wrong visual position during keyboard animation.
- Manually dragging the page could temporarily "fix" the layout.

## Root Cause

This was not a single CSS bug. It came from several iOS behaviors interacting at the same time:

- `visualViewport.height` changes when the keyboard opens and closes.
- `visualViewport.offsetTop` changes while iOS shifts the visible area.
- Safari tries to auto-scroll focused inputs into view.
- If the outer page can scroll, Safari may scroll `window`/`body` during focus.
- Our own layout sync and message auto-scroll can conflict with system keyboard animation if timed poorly.

## Final Fix Strategy

The final implementation lives in:

- [src/useKeyboardCompat.js](C:/Downloads/ichigo--main/ichigo--main/src/useKeyboardCompat.js)

The CSS support lives in:

- [src/styles.css](C:/Downloads/ichigo--main/ichigo--main/src/styles.css)

## What Actually Solved It

### 1. Sync the app container to the real visible viewport

We listen to `visualViewport.resize` and `visualViewport.scroll`, then update:

- `--app-height`
- `--viewport-offset-top`

This keeps the main app shell aligned with the actual visible viewport during keyboard animation.

### 2. Detect keyboard-open state from viewport shrink

We keep track of the largest viewport height seen and compute:

- `keyboardInset = maxViewportHeight - viewportHeight`

If the inset is greater than a threshold (`120px`), we treat the keyboard as open and set:

- `document.documentElement.dataset.keyboardOpen = "true"`

This avoids applying offset compensation during normal resizes.

### 3. Lock outer-page scrolling

This was one of the most important fixes.

The page is designed so that:

- `window` should not scroll
- only the internal message list should scroll

To enforce that:

- `body` is fixed and hidden from normal page scrolling
- we also listen to `window.scroll`, `resize`, `focusin`, and `focusout`
- if `window.scrollX` or `window.scrollY` moves away from `0`, we reset it immediately

This prevents Safari from shifting the outer page during keyboard transitions.

### 4. Focus the textarea with `preventScroll`

This was the key fix for the keyboard-open jump.

On touch interaction, instead of letting Safari focus the textarea normally, we manually do:

```js
textarea.focus({ preventScroll: true });
```

Then we move the caret to the end of the current value.

This prevents Safari from auto-scrolling the whole page when the textarea gains focus.

### 5. Only auto-scroll the internal message list

We do not rely on methods that may scroll ancestors or the page.

Instead:

- we update only the internal message list's `scrollTop`
- we do a short assist after focus/viewport resize so the chat stays pinned to the bottom

This keeps the scroll target stable.

### 6. Keep composer height in sync

We use a `ResizeObserver` on the composer and sync its height into:

- `--composer-height`

The message area uses that CSS variable for bottom spacing so the last message stays visible above the composer.

### 7. Keep textarea height in sync with content

On input change, the textarea height is recalculated up to a max height so the composer grows predictably without introducing extra layout jumps.

## Most Important Takeaway

The two changes that made the biggest difference were:

1. Locking the outer page scroll
2. Focusing the textarea with `preventScroll`

If those two are missing, iOS Safari tends to jump even if `visualViewport` handling is otherwise correct.

## Why This Works

This project treats the page as an app shell:

- outer page: fixed, non-scrollable
- inner content area: scrollable
- keyboard layout: driven by `visualViewport`

That matches the behavior of a chat UI much better than relying on normal document flow and Safari's default input-focus scrolling behavior.

## When To Reuse This

This approach is a good fit for:

- chat UIs
- message composers
- bottom-docked input bars
- iPhone PWA layouts that should behave like an app shell

It is less suitable for:

- long traditional form pages
- pages that intentionally use normal document scrolling

## Files Touched

- [src/useKeyboardCompat.js](C:/Downloads/ichigo--main/ichigo--main/src/useKeyboardCompat.js)
- [src/App.jsx](C:/Downloads/ichigo--main/ichigo--main/src/App.jsx)
- [src/styles.css](C:/Downloads/ichigo--main/ichigo--main/src/styles.css)

## Current Architecture

The keyboard-related behavior has been extracted into a reusable hook:

- `useKeyboardCompat(...)`

It currently handles:

- textarea focus without page scroll
- message list bottom pinning
- composer height syncing
- viewport height / offset syncing
- outer-page scroll locking

That makes it easier to reuse the same solution in other mobile input pages later.
