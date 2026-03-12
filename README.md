# @svnrnns/react-bottom-sheets

Imperative bottom sheets for React: open and close sheets via API, with gestures, snap points, and stacking. Compatible with React 18+ and Next.js.

## Installation

```bash
npm install @svnrnns/react-bottom-sheets
```

## Setup

Wrap your app with `BottomSheetRoot` (e.g. in `_app.tsx` or the root layout):

```tsx
import { BottomSheetRoot } from "@svnrnns/react-bottom-sheets";
import "@svnrnns/react-bottom-sheets/styles.css";

export default function App({ Component, pageProps }) {
  return (
    <BottomSheetRoot>
      <Component {...pageProps} />
    </BottomSheetRoot>
  );
}
```

**`BottomSheetRoot` props:**

| Prop           | Type               | Description                                                                                                                                 |
| -------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `width`        | `string \| number`  | Default width for all bottom sheets (e.g. `'50%'`, `'20rem'`, `400`). Number = px. When set, sheets are centered. Optional.                 |
| `disableBodyScroll` | `boolean` | When `true`, document body scroll is disabled while any bottom sheet is open. Scroll is re-enabled as soon as the close animation starts (or when the user releases a swipe that will close). Can be overridden per sheet via `pushBottomSheet({ disableBodyScroll })`. Optional. |

## Usage

### Opening a bottom sheet

```tsx
import { pushBottomSheet } from "@svnrnns/react-bottom-sheets";

function MyContent({ title, close, snapToIndex }) {
  return (
    <div>
      <h2>{title}</h2>
      <button onClick={() => snapToIndex(0)}>Half</button>
      <button onClick={() => snapToIndex(1)}>Full</button>
      <button onClick={close}>Close</button>
    </div>
  );
}

const instance = pushBottomSheet({
  component: MyContent,
  props: { title: "Hello" },
  enableBackdrop: true,
  enableClickBackdropToClose: true,
  snapPoint: ["50%", "100%"],
});

instance.close();
instance.snapToIndex(1);
instance.openFully();
```

### API

- **`pushBottomSheet<T>(options)`** — Opens a new bottom sheet. Returns `BottomSheetProps`.
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
  - `options.disableBodyScroll` — If `true`, document body scroll is disabled while this sheet is the active (top) sheet. Scroll is re-enabled when the close animation starts. If omitted, uses `BottomSheetRoot`'s `disableBodyScroll` default.

- **`BottomSheetProps`** (returned by `pushBottomSheet` and injected into content component):
  - `id` — Unique id (UUID string). Use with `closeBottomSheet(id)` to close a specific sheet.
  - `close()` — Closes this sheet.
  - `snapToIndex(index)` — Moves the sheet to the given snap point index (0-based).
  - `openFully()` — Opens to the highest snap point (or full height if no snaps). Calls to `snapToIndex` and `openFully` before the sheet is mounted are queued and applied when ready.

- **`popBottomSheet()`** — Closes the topmost sheet.

- **`closeBottomSheet(id)`** — Closes the sheet with the given `id`.

- **`closeAllBottomSheets()`** — Closes all open sheets.

### Injected props

Every component rendered inside a bottom sheet receives (all from `BottomSheetProps`):

- **`id`** — Unique id (UUID string). Use with `closeBottomSheet(id)` to close a specific sheet.
- **`close()`** — Closes this sheet.
- **`snapToIndex(index: number)`** — Snaps this sheet to the given index (0-based).
- **`openFully()`** — Opens to the highest snap point (or full height if no snaps).

### Scrollable content (`BottomSheetScrollable`)

When the sheet content is scrollable, vertical drags can conflict with sheet gestures. Use `BottomSheetScrollable` so scroll and gestures cooperate:

- **Scroll not at top (`scrollTop > 0`):** Vertical drags scroll the content only; sheet gestures are disabled.
- **Scroll at top (`scrollTop === 0`):** Swipe down activates sheet gestures (close or pan); swipe up scrolls the content.

```tsx
import { pushBottomSheet, BottomSheetScrollable } from "@svnrnns/react-bottom-sheets";

function MyContent({ close }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <h2>Header</h2>
      <BottomSheetScrollable>
        <p>Long scrollable content...</p>
      </BottomSheetScrollable>
    </div>
  );
}

pushBottomSheet({
  component: MyContent,
  snapPoint: ["50%", "100%"],
  enableBackdrop: true,
});
```

`BottomSheetScrollable` supports `className` and `style` props. It must be used inside a bottom sheet; outside it behaves as a normal scroll container.

## CSS variables

Override these in your app (e.g. in `:root` or a wrapper) to customize styles:

| Variable                               | Default                               | Description                           |
| -------------------------------------- | ------------------------------------- | ------------------------------------- |
| `--bottom-sheet-bg`                    | `#fff`                                | Sheet background                      |
| `--bottom-sheet-padding`               | `1rem`                                | Inner padding                         |
| `--bottom-sheet-border-radius`         | `12px 12px 0 0`                       | Sheet corners                         |
| `--bottom-sheet-shadow`                | `0 25px 50px -12px rgb(0 0 0 / 0.25)` | Box shadow                            |
| `--bottom-sheet-overlay-bg`            | `rgba(0, 0, 0, 0.3)`                  | Backdrop color                        |
| `--bottom-sheet-overlay-blur-filter`   | `blur(8px)`                           | Backdrop blur                         |
| `--bottom-sheet-duration`              | `0.5s`                                | Duration for programmatic animations  |
| `--bottom-sheet-easing`                | `cubic-bezier(0.32, 0.72, 0, 1)`      | Easing for programmatic animations    |
| `--bottom-sheet-handler-bg`            | `#cbd5e1`                             | Handler bar color                     |
| `--bottom-sheet-handler-width`         | `40px`                                | Handler bar width                     |
| `--bottom-sheet-handler-height`        | `4px`                                 | Handler bar height                    |
| `--bottom-sheet-handler-border-radius` | `2px`                                 | Handler bar radius                    |
| `--bottom-sheet-handler-padding`       | `0.5rem`                              | Handler padding                       |
| `--bottom-sheet-gap`                   | `0.5rem`                              | Gap between handler and content       |
| `--bottom-sheet-close-extra-offset`    | `0`                                   | Extra offset when animating to closed |
| `--bottom-sheet-stack-overlay-bg`      | `rgba(0, 0, 0, 0.5)`                  | Overlay on non-top stacked sheets     |

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
- **Stacking:** Multiple sheets can be open at once. When a new sheet is pushed, all sheets behind it (non-top) get scaled to 90%, translated up by 10%, and display an overlay. Customize the overlay via `--bottom-sheet-stack-overlay-bg`. Only the topmost sheet receives backdrop click (when `enableClickBackdropToClose` is true) and Escape. `popBottomSheet()` closes the top sheet; `closeBottomSheet(id)` closes a specific one.
- Height is content-based (max 100vh) unless `height` is set. Snap points can be `%`, `px`, or `rem`.
- Drag with mouse or touch: the sheet follows in real time (no animation during drag). On release, it snaps or closes using the configured duration and easing.
- Fast swipe down can close the sheet; past 60% travel toward closed also allows close. Use `disableSwipeDownToClose: true` to prevent swipe-to-close. Between snap points, 50% progress decides the target snap.
- Rubberband effect when dragging beyond min/max (unless moving to another snap point).
- Escape closes the top sheet (including while dragging). Each sheet can disable this with `disableEsc`.

### Accessibility (focus trap)

When a bottom sheet is pushed and becomes the top sheet, focus is trapped inside it: Tab/Shift+Tab cycle only through focusable elements within the sheet, and focus is restored to the previously focused element when the sheet closes. The first focusable element is focused when the sheet opens. To avoid auto-focus on a close button, add the class `modals-close` to that button; the trap will then focus the first other focusable element (or the sheet container if none). The top sheet is exposed as a dialog (`role="dialog"`, `aria-modal="true"`) for screen readers.

## TypeScript

The package exports these types:

- `BottomSheetProps` — Return type of `pushBottomSheet` and props injected into the content component (`id`, `close`, `snapToIndex`, `openFully`).
- `BottomSheetPushOptions<T>` — Options for `pushBottomSheet`; `T` is the props type of your content component.
- `BottomSheetRootProps` — Props for `BottomSheetRoot` (`width?: string | number`, `disableBodyScroll?: boolean`).
- `BottomSheetScrollableProps` — Props for `BottomSheetScrollable` (`className`, `style`, `children`).
