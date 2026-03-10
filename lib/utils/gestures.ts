/**
 * Velocity threshold (px/ms) above which we consider it a "fast swipe" for closing or snapping.
 */
export const VELOCITY_THRESHOLD = 0.5;

/**
 * Fraction of travel (0..1) toward closed position. If past this and velocity is down, can close.
 */
export const CLOSE_THRESHOLD = 0.6;

/**
 * Fraction of travel (0..1) between two snap points. If past 50%, go to next snap.
 */
export const SNAP_PROGRESS_THRESHOLD = 0.5;

export interface ReleaseResult {
  action: 'close' | 'snap';
  targetIndex?: number;
  targetY?: number;
}

/**
 * Given current position (translateY, 0 = top), sheet height, snap points in px (heights from bottom),
 * and velocity (positive = downward), decide whether to close or snap to an index.
 * Snap points are ordered ascending (smallest = most closed). Position is "how much the sheet is down"
 * so 0 = fully open (sheet top at viewport top), sheetHeight = fully closed.
 */
export function getReleaseTarget(
  currentTranslateY: number,
  sheetHeight: number,
  snapPointsPx: number[],
  velocityY: number,
  closeOffset: number = 0
): ReleaseResult {
  const closedPosition = sheetHeight + closeOffset;

  if (snapPointsPx.length === 0) {
    if (currentTranslateY >= closedPosition * CLOSE_THRESHOLD) {
      return { action: 'close' };
    }
    return { action: 'snap', targetY: 0 };
  }

  const sortedSnaps = [...snapPointsPx].sort((a, b) => a - b);
  const firstSnap = sortedSnaps[0];
  const firstSnapTranslateY = sheetHeight - firstSnap;
  const closedPos = sheetHeight + closeOffset;
  const closeZoneStart = firstSnapTranslateY;
  const closeZoneLength = closedPos - closeZoneStart;
  const closeThresholdY = closeZoneStart + CLOSE_THRESHOLD * closeZoneLength;

  if (velocityY > VELOCITY_THRESHOLD) {
    if (currentTranslateY >= closeThresholdY) {
      return { action: 'close' };
    }
    const nextSnapDown = findNextSnapDown(currentTranslateY, sortedSnaps, sheetHeight);
    if (nextSnapDown !== undefined) {
      const targetY = sheetHeight - nextSnapDown;
      return { action: 'snap', targetY, targetIndex: snapPointsPx.indexOf(nextSnapDown) };
    }
  }

  if (velocityY < -VELOCITY_THRESHOLD) {
    const nextSnapUp = findNextSnapUp(currentTranslateY, sortedSnaps, sheetHeight);
    if (nextSnapUp !== undefined) {
      const targetY = sheetHeight - nextSnapUp;
      const idx = sortedSnaps.indexOf(nextSnapUp);
      return { action: 'snap', targetY, targetIndex: idx };
    }
  }

  const currentSnapIndex = findCurrentSnapIndex(currentTranslateY, sortedSnaps, sheetHeight);
  const progress = getProgressToNextSnap(currentTranslateY, currentSnapIndex, sortedSnaps, sheetHeight);

  if (progress >= SNAP_PROGRESS_THRESHOLD && currentSnapIndex < sortedSnaps.length - 1) {
    const nextSnap = sortedSnaps[currentSnapIndex + 1];
    return { action: 'snap', targetY: sheetHeight - nextSnap, targetIndex: currentSnapIndex + 1 };
  }

  if (currentSnapIndex > 0 || currentTranslateY < closeZoneStart) {
    const snap = sortedSnaps[currentSnapIndex];
    return { action: 'snap', targetY: sheetHeight - snap, targetIndex: currentSnapIndex };
  }

  if (currentTranslateY >= closeThresholdY) {
    return { action: 'close' };
  }

  return { action: 'snap', targetY: firstSnapTranslateY, targetIndex: 0 };
}

function findNextSnapDown(
  currentY: number,
  sortedSnaps: number[],
  sheetHeight: number
): number | undefined {
  const currentVisible = sheetHeight - currentY;
  for (let i = sortedSnaps.length - 1; i >= 0; i--) {
    if (sortedSnaps[i] < currentVisible) return sortedSnaps[i];
  }
  return undefined;
}

function findNextSnapUp(
  currentY: number,
  sortedSnaps: number[],
  sheetHeight: number
): number | undefined {
  const currentVisible = sheetHeight - currentY;
  for (let i = 0; i < sortedSnaps.length; i++) {
    if (sortedSnaps[i] > currentVisible) return sortedSnaps[i];
  }
  return undefined;
}

function findCurrentSnapIndex(
  currentY: number,
  sortedSnaps: number[],
  sheetHeight: number
): number {
  const currentVisible = sheetHeight - currentY;
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < sortedSnaps.length; i++) {
    const d = Math.abs(sortedSnaps[i] - currentVisible);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

function getProgressToNextSnap(
  currentY: number,
  currentSnapIndex: number,
  sortedSnaps: number[],
  sheetHeight: number
): number {
  if (currentSnapIndex >= sortedSnaps.length - 1) return 0;
  const currentVisible = sheetHeight - currentY;
  const fromSnap = sortedSnaps[currentSnapIndex];
  const toSnap = sortedSnaps[currentSnapIndex + 1];
  const segment = toSnap - fromSnap;
  if (segment <= 0) return 0;
  const progress = (currentVisible - fromSnap) / segment;
  return Math.max(0, Math.min(1, progress));
}
