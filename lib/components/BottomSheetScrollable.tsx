import {
  createElement,
  useRef,
  useEffect,
  useCallback,
  type CSSProperties,
  type ComponentPropsWithoutRef,
} from 'react';
import { useScrollContainerContext } from '../context/scrollContext';

/** Tolerance in px for "at scroll boundary" (matches drawer behavior). */
const SCROLL_EDGE_TOLERANCE = 2;

export interface BottomSheetScrollableProps extends ComponentPropsWithoutRef<'div'> {
  children?: React.ReactNode;
  className?: string;
  style?: CSSProperties;
  ref?: React.Ref<HTMLDivElement>;
}

/**
 * Scrollable container that integrates with BottomSheet gestures (same pattern as DrawerScrollable).
 * - When scrollTop > 0: vertical drags scroll the content (sheet gestures disabled).
 * - When scrollTop === 0: swipe down activates sheet gestures (close/pan); swipe up scrolls.
 * Touch/pointer: only when at top (scrollTop <= tolerance) and dragging down do we prevent scroll
 * so the sheet can claim the gesture.
 */
export function BottomSheetScrollable({
  children,
  className,
  style,
  ref: refFromProps,
  ...rest
}: BottomSheetScrollableProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const ctx = useScrollContainerContext();

  useEffect(() => {
    if (!ctx || !scrollRef.current) return;
    const el = scrollRef.current;
    const getCanDrag = () => el.scrollTop <= SCROLL_EDGE_TOLERANCE;
    return ctx.registerScrollContainer(el, getCanDrag);
  }, [ctx]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        touchStartRef.current = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
        };
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 0) return;
      const deltaY = e.touches[0].clientY - touchStartRef.current.y;
      const atTop = el.scrollTop <= SCROLL_EDGE_TOLERANCE;
      const draggingDown = deltaY > 0;
      if (atTop && draggingDown && e.cancelable) {
        e.preventDefault();
      }
    };
    el.addEventListener('touchstart', onTouchStart, { capture: true, passive: true });
    el.addEventListener('touchmove', onTouchMove, { capture: true, passive: false });
    return () => {
      el.removeEventListener('touchstart', onTouchStart, { capture: true });
      el.removeEventListener('touchmove', onTouchMove, { capture: true });
    };
  }, []);

  const setRef = useCallback(
    (node: HTMLDivElement | null) => {
      (scrollRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
      if (typeof refFromProps === 'function') {
        refFromProps(node);
      } else if (refFromProps != null) {
        (refFromProps as React.MutableRefObject<HTMLDivElement | null>).current = node;
      }
    },
    [refFromProps]
  );

  const combinedClassName = ['bottom-sheet-scrollable', className].filter(Boolean).join(' ');
  const combinedStyle: React.CSSProperties = {
    flex: 1,
    minHeight: 0,
    overflow: 'auto',
    WebkitOverflowScrolling: 'touch',
    overscrollBehaviorY: 'contain',
    ...style,
  };

  return createElement('div', {
    ref: setRef,
    className: combinedClassName,
    style: combinedStyle,
    ...rest,
    children,
  });
}
