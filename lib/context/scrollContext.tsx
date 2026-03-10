import { createContext, useCallback, useRef, useContext } from 'react';

export interface ScrollContainerContextValue {
  /** Register a scroll container. Returns unregister function. */
  registerScrollContainer: (el: HTMLElement, getCanDrag: () => boolean) => () => void;
  /** True if target is inside any registered scroll container. */
  isInScrollContainer: (target: Node) => boolean;
  /**
   * Returns true if sheet gestures should be blocked for this target.
   * (e.g. when inside a scrollable that is not at top)
   */
  shouldBlockGestures: (target: Node) => boolean;
  /**
   * For targets inside a scroll container at top: can we capture for a downward swipe?
   * (scrollTop === 0)
   */
  canCaptureForDownSwipe: (target: Node) => boolean;
}

export const ScrollContainerContext = createContext<ScrollContainerContextValue | null>(null);

export function useScrollContainerContext(): ScrollContainerContextValue | null {
  return useContext(ScrollContainerContext);
}

function findScrollContainer(
  target: Node,
  containers: Map<HTMLElement, () => boolean>
): { el: HTMLElement; getCanDrag: () => boolean } | null {
  let node: Node | null = target;
  while (node && node !== document.body) {
    if (node instanceof HTMLElement && containers.has(node)) {
      return { el: node, getCanDrag: containers.get(node)! };
    }
    node = node.parentNode;
  }
  return null;
}

export function useScrollContainerContextValue(): ScrollContainerContextValue {
  const containersRef = useRef<Map<HTMLElement, () => boolean>>(new Map());

  const registerScrollContainer = useCallback((el: HTMLElement, getCanDrag: () => boolean) => {
    containersRef.current.set(el, getCanDrag);
    return () => {
      containersRef.current.delete(el);
    };
  }, []);

  const isInScrollContainer = useCallback((target: Node): boolean => {
    return findScrollContainer(target, containersRef.current) !== null;
  }, []);

  const shouldBlockGestures = useCallback((target: Node): boolean => {
    const entry = findScrollContainer(target, containersRef.current);
    if (!entry) return false;
    return !entry.getCanDrag();
  }, []);

  const canCaptureForDownSwipe = useCallback((target: Node): boolean => {
    const entry = findScrollContainer(target, containersRef.current);
    if (!entry) return false;
    return entry.getCanDrag();
  }, []);

  return {
    registerScrollContainer,
    isInScrollContainer,
    shouldBlockGestures,
    canCaptureForDownSwipe,
  };
}
