/**
 * Nodes that must receive wheel/touch scroll while disableBodyScroll is active.
 * BottomSheetRoot prevents default on document wheel/touchmove unless the event target
 * is inside one of these roots (overflow heuristics are fragile with flex / shorthand overflow).
 */

const scrollRoots = new Set<HTMLElement>();

export function registerSheetInternalScrollRoot(el: HTMLElement): () => void {
  scrollRoots.add(el);
  return () => {
    scrollRoots.delete(el);
  };
}

export function isTargetInsideSheetScrollRoot(target: EventTarget | null): boolean {
  if (!(target instanceof Node)) return false;
  let n: Node | null = target;
  while (n) {
    if (n instanceof HTMLElement && scrollRoots.has(n)) return true;
    n = n.parentNode;
  }
  return false;
}
