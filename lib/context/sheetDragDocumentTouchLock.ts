/**
 * While the user is dragging the bottom sheet (pointer captured on the sheet),
 * we must call preventDefault() on document touchmove for touches inside the portal.
 * Otherwise iOS/Safari treats the sequence as native scroll on the scrollable and
 * fires pointercancel ~300–500ms after pointerdown.
 */

let lockCount = 0;

export function beginSheetDragDocumentTouchLock(): void {
  lockCount += 1;
}

export function endSheetDragDocumentTouchLock(): void {
  lockCount = Math.max(0, lockCount - 1);
}

export function isSheetDragDocumentTouchLocked(): boolean {
  return lockCount > 0;
}
