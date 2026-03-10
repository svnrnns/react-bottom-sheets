/**
 * Parse a single snap point string to pixels relative to viewport height.
 * Valid: "50%", "100px", "20rem", "50" (treated as px).
 * Invalid entries return null.
 */
function parseSnapValue(value: string, viewportHeightPx: number, remPx: number): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (trimmed.endsWith('%')) {
    const num = parseFloat(trimmed.slice(0, -1));
    if (Number.isNaN(num) || num < 0 || num > 100) return null;
    return (num / 100) * viewportHeightPx;
  }

  if (trimmed.endsWith('px')) {
    const num = parseFloat(trimmed.slice(0, -2));
    if (Number.isNaN(num)) return null;
    return num;
  }

  if (trimmed.endsWith('rem')) {
    const num = parseFloat(trimmed.slice(0, -3));
    if (Number.isNaN(num)) return null;
    return num * remPx;
  }

  const asNumber = parseFloat(trimmed);
  if (!Number.isNaN(asNumber)) return asNumber;
  return null;
}

function getRemPx(): number {
  if (typeof document === 'undefined') return 16;
  const root = document.documentElement;
  const fontSize = getComputedStyle(root).fontSize;
  const rem = parseFloat(fontSize);
  return Number.isNaN(rem) ? 16 : rem;
}

/**
 * Parse snap point strings to an array of heights in pixels (from bottom of viewport).
 * Sorted ascending (smallest = most closed, largest = most open).
 * viewportHeightPx: window.innerHeight or equivalent.
 */
export function parseSnapPoints(
  snapPoint: string[] | undefined,
  viewportHeightPx: number
): number[] {
  if (!snapPoint?.length) return [];
  const remPx = getRemPx();
  const parsed = snapPoint
    .map((s) => parseSnapValue(s, viewportHeightPx, remPx))
    .filter((v): v is number => v !== null && v >= 0);
  const unique = [...new Set(parsed)];
  unique.sort((a, b) => a - b);
  return unique;
}

/**
 * Clamp value between min and max. For rubberband, we allow overscroll with resistance.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

const RUBBERBAND_SCALE_PX = 80;
const RUBBERBAND_FACTOR_MAX = 0.35;
const RUBBERBAND_FACTOR_MIN = 0.08;

/**
 * Resistance factor that decreases as overscroll (over) increases, approaching min but never 0.
 */
function rubberbandFactor(over: number): number {
  return (
    RUBBERBAND_FACTOR_MIN +
    (RUBBERBAND_FACTOR_MAX - RUBBERBAND_FACTOR_MIN) / (1 + over / RUBBERBAND_SCALE_PX)
  );
}

/**
 * Apply rubberband when beyond bounds. Resistance is incremental: the more you overscroll,
 * the stronger the resistance (smaller movement per pixel), approaching a minimum factor but never zero.
 * Used when swiping past the last (highest) snap point, or past max height when there are no snap points.
 */
export function rubberband(value: number, min: number, max: number): number {
  if (value >= min && value <= max) return value;
  if (value < min) {
    const over = min - value;
    const factor = rubberbandFactor(over);
    return min - over * factor;
  }
  const over = value - max;
  const factor = rubberbandFactor(over);
  return max + over * factor;
}
