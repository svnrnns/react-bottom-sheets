# @svnrnns/bottom-sheets

Imperative bottom sheets for React: open and close sheets via API, with gestures, snap points, and stacking. Compatible with React 18+ and Next.js.

## Installation

```bash
npm install @svnrnns/bottom-sheets
```

## Setup

Wrap your app with `BottomSheetRoot` (e.g. in `_app.tsx` or the root layout):

```tsx
import { BottomSheetRoot } from '@svnrnns/bottom-sheets';
import '@svnrnns/bottom-sheets/styles.css';

export default function App({ Component, pageProps }) {
  return (
    <BottomSheetRoot>
      <Component {...pageProps} />
    </BottomSheetRoot>
  );
}
```

**`BottomSheetRoot` props:**

| Prop | Type | Description |
|------|------|-------------|
| `width` | `string` | Default width for all bottom sheets (e.g. `'50%'`, `'20rem'`, `'400px'`). When set, sheets are centered. Optional. |

## Usage

### Opening a bottom sheet

```tsx
import { pushBottomSheet } from '@svnrnns/bottom-sheets';

function MyContent({ title, closeDrawer, snapToIndex }) {
  return (
    <div>
      <h2>{title}</h2>
      <button onClick={() => snapToIndex(0)}>Half</button>
      <button onClick={() => snapToIndex(1)}>Full</button>
      <button onClick={closeDrawer}>Close</button>
    </div>
  );
}

const instance = pushBottomSheet({
  component: MyContent,
  props: { title: 'Hello' },
  enableBackdrop: true,
  enableClickBackdropToClose: true,
  snapPoint: ['50%', '100%'],
});

instance.close();
instance.snapToIndex(1);
instance.openFully();
```

### API

- **`pushBottomSheet<T>(options)`** — Opens a new bottom sheet. Returns `BottomSheetInstance`.
  - `options.component` — React component to render inside the sheet.
  - `options.props` — Props passed to the component (type-inferred).
  - `options.height` — Optional fixed height (number in px, or string e.g. `"50%"`, `"20rem"`).
  - `options.width` — Optional width in any CSS unit (`%`, `rem`, `px`, `vw`, etc.). When set, the sheet is centered. Overrides `BottomSheetRoot` default width for this sheet.
  - `options.snapPoint` — Optional array of snap points (e.g. `['25%', '50%', '100%']`). Percent is relative to viewport height; also supports `'200px'`, `'10rem'`. Alias: `snapPoints`.
  - `options.className` — Optional class for the sheet wrapper.
  - `options.onClose` — Callback when the sheet is closed.
  - `options.enableClickBackdropToClose` — If `true`, clicking the backdrop closes the sheet.
  - `options.enableBackdrop` — If `true`, shows an overlay behind the sheet.
  - `options.disableEsc` — If `true`, Escape key does not close this sheet.
  - `options.gestureOnlyOnHandler` — If `true`, only the handler bar is draggable; otherwise the whole sheet is.
  - `options.disableSwipeDownToClose` — If `true`, swipe-down never closes the sheet; it always snaps back to the first snap point or open position.

- **`BottomSheetInstance`** (returned by `pushBottomSheet`):
  - `id` — Unique id (symbol). Use with `closeBottomSheet(id)` to close a specific sheet.
  - `close()` — Closes this sheet.
  - `snapToIndex(index)` — Moves the sheet to the given snap point index (0-based).
  - `openFully()` — Opens to the highest snap point (or full height if no snaps). Calls to `snapToIndex` and `openFully` before the sheet is mounted are queued and applied when ready.

- **`popBottomSheet()`** — Closes the topmost sheet.

- **`closeBottomSheet(id)`** — Closes the sheet with the given `id`.

- **`closeAllBottomSheets()`** — Closes all open sheets.

### Injected props

Every component rendered inside a bottom sheet receives:

- **`closeDrawer()`** — Closes this sheet.
- **`snapToIndex(index: number)`** — Snaps this sheet to the given index.

## CSS variables

Override these in your app (e.g. in `:root` or a wrapper) to customize styles:

| Variable | Default | Description |
|----------|---------|-------------|
| `--bottom-sheet-bg` | `#fff` | Sheet background |
| `--bottom-sheet-padding` | `1rem` | Inner padding |
| `--bottom-sheet-border-radius` | `12px 12px 0 0` | Sheet corners |
| `--bottom-sheet-shadow` | `0 25px 50px -12px rgb(0 0 0 / 0.25)` | Box shadow |
| `--bottom-sheet-overlay-bg` | `rgba(0, 0, 0, 0.3)` | Backdrop color |
| `--bottom-sheet-overlay-blur-filter` | `blur(8px)` | Backdrop blur |
| `--bottom-sheet-duration` | `0.5s` | Duration for programmatic animations |
| `--bottom-sheet-easing` | `cubic-bezier(0.32, 0.72, 0, 1)` | Easing for programmatic animations |
| `--bottom-sheet-handler-bg` | `#cbd5e1` | Handler bar color |
| `--bottom-sheet-handler-width` | `40px` | Handler bar width |
| `--bottom-sheet-handler-height` | `4px` | Handler bar height |
| `--bottom-sheet-handler-border-radius` | `2px` | Handler bar radius |
| `--bottom-sheet-handler-padding` | `0.5rem` | Handler padding |
| `--bottom-sheet-gap` | `0.5rem` | Gap between handler and content |
| `--bottom-sheet-close-extra-offset` | `0` | Extra offset when animating to closed |

Example:

```css
:root {
  --bottom-sheet-bg: #1e293b;
  --bottom-sheet-handler-bg: #64748b;
  --bottom-sheet-duration: 0.3s;
}
```

## Behavior

- Sheets open from the bottom and are rendered in a portal above the rest of the page.
- **Stacking:** Multiple sheets can be open at once. Only the topmost sheet receives backdrop click (when `enableClickBackdropToClose` is true) and Escape. `popBottomSheet()` closes the top sheet; `closeBottomSheet(id)` closes a specific one.
- Height is content-based (max 100vh) unless `height` is set. Snap points can be `%`, `px`, or `rem`.
- Drag with mouse or touch: the sheet follows in real time (no animation during drag). On release, it snaps or closes using the configured duration and easing.
- Fast swipe down can close the sheet; past 60% travel toward closed also allows close. Use `disableSwipeDownToClose: true` to prevent swipe-to-close. Between snap points, 50% progress decides the target snap.
- Rubberband effect when dragging beyond min/max (unless moving to another snap point).
- Escape closes the top sheet (including while dragging). Each sheet can disable this with `disableEsc`.

## TypeScript

The package exports these types:

- `BottomSheetInstance` — Return type of `pushBottomSheet`.
- `PushOptions<T>` — Options for `pushBottomSheet`; `T` is the props type of your content component.
- `BottomSheetInjectedProps` — Props injected into the content component (`closeDrawer`, `snapToIndex`).
- `BottomSheetRootProps` — Props for `BottomSheetRoot` (`width`).
