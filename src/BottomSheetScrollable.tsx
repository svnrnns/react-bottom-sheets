import { useRef, useEffect, type CSSProperties } from 'react';
import { useScrollContainerContext } from './scrollContext';

export interface BottomSheetScrollableProps {
  children: React.ReactNode;
  className?: string;
  style?: CSSProperties;
}

/**
 * A scrollable container that coordinates with BottomSheet gestures.
 * - When scrollTop > 0: vertical drags scroll the content (sheet gestures disabled)
 * - When scrollTop === 0: swipe down activates sheet gestures (close/pan), swipe up scrolls
 */
export function BottomSheetScrollable({ children, className, style }: BottomSheetScrollableProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef<number>(0);
  const ctx = useScrollContainerContext();

  useEffect(() => {
    if (!ctx || !scrollRef.current) return;
    const el = scrollRef.current;
    const getCanDrag = () => el.scrollTop === 0;
    return ctx.registerScrollContainer(el, getCanDrag);
  }, [ctx]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onTouchStart = (e: TouchEvent) => {
      touchStartY.current = e.touches[0]?.clientY ?? 0;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (el.scrollTop > 0 || !e.cancelable) return;
      const touch = e.touches[0];
      if (!touch) return;
      const deltaY = touch.clientY - touchStartY.current;
      if (deltaY > 8) {
        e.preventDefault();
      }
    };
    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false, capture: true });
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove, { capture: true });
    };
  }, []);

  return (
    <div
      ref={scrollRef}
      className={className}
      style={{
        flex: 1,
        minHeight: 0,
        overflow: 'auto',
        WebkitOverflowScrolling: 'touch',
        overscrollBehaviorY: 'contain',
        ...style,
      }}
    >
      {children}
    </div>
  );
}
