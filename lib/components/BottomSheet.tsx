import {
  useRef,
  useState,
  useEffect,
  useCallback,
  useLayoutEffect,
  useContext,
} from 'react';
import { flushSync } from 'react-dom';
import type { SheetDescriptor } from '../types';
import { parseSnapPoints, rubberband } from '../utils/snap';
import { getReleaseTarget } from '../utils/gestures';
import { removeSheet } from '../store/store';
import { BottomSheetContext } from '../context/context';
import { ScrollContainerContext, useScrollContainerContextValue } from '../context/scrollContext';
import { useFocusTrap } from '../hooks/useFocusTrap';

const VIEWPORT_MAX = typeof window !== 'undefined' ? () => window.innerHeight : () => 800;
const DRAG_THRESHOLD = 5;

/** Interactive elements that must receive tap/click; don't capture pointer over these. */
function isInteractiveElement(target: Node, stopAt: Node | null): boolean {
  let el: Node | null = target;
  while (el && el !== stopAt) {
    if (!(el instanceof HTMLElement)) {
      el = el.parentNode;
      continue;
    }
    const tag = el.tagName.toLowerCase();
    if (tag === 'button' || tag === 'a' || tag === 'input' || tag === 'select' || tag === 'textarea') return true;
    const role = el.getAttribute('role');
    if (role === 'button' || role === 'link' || role === 'tab' || role === 'menuitem' || role === 'option') return true;
    if (el.hasAttribute('contenteditable')) return true;
    el = el.parentNode;
  }
  return false;
}

function getCssVar(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function getDurationMs(): number {
  const s = getCssVar('--bottom-sheet-duration', '0.5s');
  const match = s.match(/^([\d.]+)s$/);
  if (match) return parseFloat(match[1]) * 1000;
  const matchMs = s.match(/^([\d.]+)ms$/);
  if (matchMs) return parseFloat(matchMs[1]);
  return 500;
}

function getEaseCubicBezierY(t: number, y1: number, y2: number): number {
  const t2 = 1 - t;
  return 3 * t2 * t2 * t * y1 + 3 * t2 * t * t * y2 + t * t * t;
}

function getEasedProgress(progress: number, easingVar: string): number {
  const match = easingVar.match(/cubic-bezier\s*\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)/);
  if (!match) return progress;
  const values = match.map(Number);
  const y1 = values[2];
  const y2 = values[4];
  return getEaseCubicBezierY(progress, y1, y2);
}

function scaleForStackDepth(d: number): number {
  return d === 0 ? 1 : Math.max(0.5, 0.9 - (d - 1) * 0.05);
}

function offsetForStackDepth(d: number): number {
  return d === 0 ? 0 : 15 + (d - 1) * 10;
}

export interface BottomSheetComponentProps {
  descriptor: SheetDescriptor & { id: string };
  index: number;
  isTop: boolean;
  /** 0 = top sheet, 1 = first behind, 2 = second behind, etc. */
  stackDepth: number;
}

export function BottomSheet({ descriptor, index, isTop, stackDepth }: BottomSheetComponentProps) {
  const ctx = useContext(BottomSheetContext);
  const {
    id,
    component: Component,
    props: componentProps,
    height: heightProp,
    width: widthProp,
    snapPoint,
    className,
    onClose,
    enableBackdrop,
    enableClickBackdropToClose,
    disableEsc,
    gestureOnlyOnHandler,
    disableSwipeDownToClose,
  } = descriptor;

  const effectiveWidth = widthProp ?? ctx?.defaultWidth;
  const widthCss =
    effectiveWidth == null ? undefined : typeof effectiveWidth === 'number' ? `${effectiveWidth}px` : effectiveWidth;

  const viewportHeight = VIEWPORT_MAX();
  const closeOffset =
    typeof document !== 'undefined'
      ? parseFloat(getCssVar('--bottom-sheet-close-extra-offset', '0')) || 0
      : 0;

  const hasSnapPoints = Boolean(snapPoint?.length);
  const contentDrivenHeight = heightProp == null && !hasSnapPoints;

  const sheetRef = useRef<HTMLDivElement>(null);
  const handlerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const scrollCtxValue = useScrollContainerContextValue();
  const [sheetHeight, setSheetHeight] = useState(() => {
    if (heightProp != null) return parseHeight(heightProp);
    if (contentDrivenHeight) return 0;
    return viewportHeight;
  });
  const [contentHeightMeasured, setContentHeightMeasured] = useState(!contentDrivenHeight);
  const closedY = sheetHeight + closeOffset;
  const snapPointsPx = parseSnapPoints(snapPoint, viewportHeight);
  const effectiveSnaps = snapPointsPx
    .filter((s) => s <= sheetHeight)
    .sort((a, b) => a - b);
  const firstSnapY = effectiveSnaps.length > 0 ? sheetHeight - effectiveSnaps[0] : 0;
  const [translateY, setTranslateY] = useState(() =>
    contentDrivenHeight ? viewportHeight : effectiveSnaps.length > 0 ? closedY : 0
  );
  const [isDragging, setIsDragging] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  const [backdropOpacity, setBackdropOpacity] = useState(0);
  const dragStartRef = useRef<{ y: number; sheetY: number; time: number } | null>(null);
  const lastMoveRef = useRef<{ y: number; time: number } | null>(null);
  const hasCapturedRef = useRef(false);
  const heightAnimationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useLayoutEffect(() => {
    if (effectiveSnaps.length > 0) setTranslateY(closedY);
  }, []);

  useEffect(() => {
    if (heightProp != null) {
      setSheetHeight(parseHeight(heightProp));
      setContentHeightMeasured(true);
      return;
    }
    if (!contentDrivenHeight) {
      const el = contentRef.current;
      if (!el) return;
      const ro = new ResizeObserver(() => {
        const h = el.getBoundingClientRect().height;
        setSheetHeight((prev) => Math.min(Math.max(prev, h), viewportHeight));
      });
      ro.observe(el);
      const h = el.getBoundingClientRect().height;
      setSheetHeight((prev) => Math.min(Math.max(prev, h), viewportHeight));
      return () => ro.disconnect();
    }
    const el = sheetRef.current;
    if (!el) return;
    const updateHeight = () => {
      const sheet = sheetRef.current;
      const handler = handlerRef.current;
      const content = contentRef.current;
      if (!sheet || !handler || !content) return;
      if (sheetHeight === 0) {
        const h = Math.min(sheet.getBoundingClientRect().height, viewportHeight);
        if (h > 0) {
          setSheetHeight(h);
          setContentHeightMeasured(true);
        }
        return;
      }
      const style = getComputedStyle(sheet);
      const paddingTop = parseFloat(style.paddingTop) || 0;
      const paddingBottom = parseFloat(style.paddingBottom) || 0;
      const gapStr = style.gap || '0.5rem';
      const gapPx = gapStr.endsWith('rem')
        ? parseFloat(gapStr) * (parseFloat(getComputedStyle(document.documentElement).fontSize) || 16)
        : parseFloat(gapStr) || 8;
      const contentEl = content.firstElementChild;
      const contentHeight = contentEl
        ? contentEl.getBoundingClientRect().height
        : content.scrollHeight || content.getBoundingClientRect().height;
      const h = Math.min(
        paddingTop + paddingBottom + handler.offsetHeight + gapPx + contentHeight,
        viewportHeight
      );
      if (h > 0) {
        if (heightAnimationTimeoutRef.current) {
          clearTimeout(heightAnimationTimeoutRef.current);
          heightAnimationTimeoutRef.current = null;
        }
        setSheetHeight(h);
        setIsAnimating(true);
        heightAnimationTimeoutRef.current = setTimeout(() => {
          heightAnimationTimeoutRef.current = null;
          setIsAnimating(false);
        }, getDurationMs());
      }
    };
    const ro = new ResizeObserver(updateHeight);
    if (contentRef.current) ro.observe(contentRef.current);
    const firstChild = contentRef.current?.firstElementChild;
    if (firstChild) ro.observe(firstChild);
    if (handlerRef.current) ro.observe(handlerRef.current);
    ro.observe(sheetRef.current);
    requestAnimationFrame(updateHeight);
    return () => {
      ro.disconnect();
      if (heightAnimationTimeoutRef.current) {
        clearTimeout(heightAnimationTimeoutRef.current);
        heightAnimationTimeoutRef.current = null;
      }
    };
  }, [heightProp, viewportHeight, contentDrivenHeight, sheetHeight]);

  useEffect(() => {
    if (hasOpened) return;
    if (contentDrivenHeight && !contentHeightMeasured) return;
    setHasOpened(true);
    setTranslateY(closedY);
    requestAnimationFrame(() => {
      setBackdropOpacity(1);
      setIsAnimating(true);
      setTranslateY(firstSnapY);
      const duration = getDurationMs();
      setTimeout(() => setIsAnimating(false), duration);
    });
  }, [hasOpened, contentDrivenHeight, contentHeightMeasured, firstSnapY, closedY, sheetHeight]);

  const closeDrawer = useCallback(() => {
    if (isAnimating) return;
    setBackdropOpacity(0);
    setIsAnimating(true);
    const duration = getDurationMs();
    setTranslateY(sheetHeight + closeOffset);
    if (isTop && ctx) {
      ctx.setTopSheetClosingProgress(0);
      const startTime = Date.now();
      const tick = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(1, elapsed / duration);
        ctx?.setTopSheetClosingProgress(progress);
        if (progress < 1) {
          requestAnimationFrame(tick);
        } else {
          onClose?.();
          removeSheet(id);
          ctx?.setTopSheetClosingProgress(null);
          setIsAnimating(false);
        }
      };
      requestAnimationFrame(tick);
    } else {
      const t = setTimeout(() => {
        onClose?.();
        removeSheet(id);
        setIsAnimating(false);
      }, duration);
      return () => clearTimeout(t);
    }
  }, [id, sheetHeight, closeOffset, onClose, isAnimating, isTop, ctx]);

  const snapToIndex = useCallback(
    (i: number) => {
      if (isAnimating) return;
      if (effectiveSnaps.length === 0) {
        setTranslateY(0);
        return;
      }
      const idx = Math.max(0, Math.min(i, effectiveSnaps.length - 1));
      const targetY = sheetHeight - effectiveSnaps[idx];
      setIsAnimating(true);
      setTranslateY(targetY);
      const duration = getDurationMs();
      const t = setTimeout(() => setIsAnimating(false), duration);
      return () => clearTimeout(t);
    },
    [effectiveSnaps, sheetHeight, isAnimating]
  );

  const openFully = useCallback(() => {
    if (effectiveSnaps.length > 0) {
      snapToIndex(effectiveSnaps.length - 1);
    } else {
      setIsAnimating(true);
      setTranslateY(0);
      const t = setTimeout(() => setIsAnimating(false), getDurationMs());
      return () => clearTimeout(t);
    }
  }, [effectiveSnaps.length, snapToIndex]);

  useLayoutEffect(() => {
    if (!ctx) return;
    ctx.registerController(id, { snapToIndex, openFully, close: closeDrawer });
    return () => ctx.unregisterController(id);
  }, [id, ctx, snapToIndex, openFully, closeDrawer]);

  useEffect(() => {
    if (!isTop) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !disableEsc) {
        e.preventDefault();
        flushSync(() => {
          setIsDragging(false);
          setIsAnimating(false);
        });
        dragStartRef.current = null;
        lastMoveRef.current = null;
        closeDrawer();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isTop, disableEsc, closeDrawer]);

  useFocusTrap(sheetRef, isTop && hasOpened);

  const cleanupDragState = useCallback((pointerId?: number) => {
    if (hasCapturedRef.current && sheetRef.current && pointerId != null) {
      try {
        sheetRef.current.releasePointerCapture(pointerId);
      } catch {
        /* ignore if no capture */
      }
      setIsDragging(false);
    }
    dragStartRef.current = null;
    lastMoveRef.current = null;
    hasCapturedRef.current = false;
  }, []);

  const handlePointerDownCapture = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      const isTouch = e.pointerType === 'touch';
      const isInContent = contentRef.current?.contains(e.target as Node) ?? false;
      if (isTouch && isInContent) {
        // When inside a scroll container, defer capture until we know swipe direction (see handlePointerMove)
        if (scrollCtxValue.isInScrollContainer(e.target as Node)) {
          return;
        }
        // Don't capture over interactive elements (buttons, links, inputs) so tap/click works on touch
        if (isInteractiveElement(e.target as Node, contentRef.current)) {
          return;
        }
        e.currentTarget.setPointerCapture(e.pointerId);
        hasCapturedRef.current = true;
        setIsDragging(true);
      }
    },
    [scrollCtxValue]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      const pointerId = e.pointerId;
      dragStartRef.current = { y: e.clientY, sheetY: translateY, time: Date.now() };
      lastMoveRef.current = { y: e.clientY, time: Date.now() };
      const onPointerUpGlobal = (ev: PointerEvent) => {
        if (ev.pointerId !== pointerId) return;
        window.removeEventListener('pointerup', onPointerUpGlobal);
        window.removeEventListener('pointercancel', onPointerUpGlobal);
        cleanupDragState(pointerId);
      };
      window.addEventListener('pointerup', onPointerUpGlobal);
      window.addEventListener('pointercancel', onPointerUpGlobal);
    },
    [translateY, cleanupDragState]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragStartRef.current) return;
      if (e.buttons === 0) {
        if (hasCapturedRef.current) {
          e.currentTarget.releasePointerCapture(e.pointerId);
          setIsDragging(false);
        }
        dragStartRef.current = null;
        lastMoveRef.current = null;
        hasCapturedRef.current = false;
        return;
      }
      lastMoveRef.current = { y: e.clientY, time: Date.now() };
      const delta = e.clientY - dragStartRef.current.y;
      const threshold = e.pointerType === 'touch' ? 1 : DRAG_THRESHOLD;
      if (!hasCapturedRef.current && Math.abs(delta) > threshold) {
        const target = e.target as Node;
        if (scrollCtxValue.isInScrollContainer(target)) {
          if (scrollCtxValue.shouldBlockGestures(target)) return;
          if (!scrollCtxValue.canCaptureForDownSwipe(target) || delta <= 0) return;
          e.preventDefault();
        }
        e.currentTarget.setPointerCapture(e.pointerId);
        hasCapturedRef.current = true;
        setIsDragging(true);
      }
      if (!hasCapturedRef.current) return;
      let next = dragStartRef.current.sheetY + delta;
      const min = 0;
      const max = sheetHeight + closeOffset;
      if (effectiveSnaps.length > 0) {
        const maxSnap = Math.max(...effectiveSnaps);
        const minY = sheetHeight - maxSnap;
        if (next > max) next = rubberband(next, minY, max);
        else if (next < minY) next = rubberband(next, minY, max);
        else next = Math.max(minY, Math.min(max, next));
      } else {
        if (next > max || next < min) next = rubberband(next, min, max);
        else next = Math.max(min, Math.min(max, next));
      }
      setTranslateY(next);
    },
    [sheetHeight, closeOffset, effectiveSnaps, scrollCtxValue]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!dragStartRef.current) return;
      const didCapture = hasCapturedRef.current;
      if (didCapture) {
        e.currentTarget.releasePointerCapture(e.pointerId);
        setIsDragging(false);
      }
      const last = lastMoveRef.current;
      const velocityY =
        last && last.time !== dragStartRef.current.time
          ? (e.clientY - last.y) / (Date.now() - last.time)
          : 0;
      dragStartRef.current = null;
      lastMoveRef.current = null;
      hasCapturedRef.current = false;

      if (!didCapture) return;

      const result = getReleaseTarget(
        translateY,
        sheetHeight,
        effectiveSnaps,
        velocityY,
        closeOffset
      );

      if (result.action === 'close') {
        if (disableSwipeDownToClose) {
          const targetY = effectiveSnaps.length > 0 ? sheetHeight - effectiveSnaps[0] : 0;
          setIsAnimating(true);
          setTranslateY(targetY);
          const duration = getDurationMs();
          setTimeout(() => setIsAnimating(false), duration);
          return;
        }
        setBackdropOpacity(0);
        setIsAnimating(true);
        setTranslateY(sheetHeight + closeOffset);
        const duration = getDurationMs();
        if (isTop && ctx) {
          ctx.setTopSheetClosingProgress(0);
          const startTime = Date.now();
          const tick = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(1, elapsed / duration);
            ctx?.setTopSheetClosingProgress(progress);
            if (progress < 1) {
              requestAnimationFrame(tick);
            } else {
              onClose?.();
              removeSheet(id);
              ctx?.setTopSheetClosingProgress(null);
              setIsAnimating(false);
            }
          };
          requestAnimationFrame(tick);
        } else {
          setTimeout(() => {
            onClose?.();
            removeSheet(id);
            setIsAnimating(false);
          }, duration);
        }
        return;
      }

      const targetY = result.targetY ?? 0;
      setIsAnimating(true);
      setTranslateY(targetY);
      const duration = getDurationMs();
      setTimeout(() => setIsAnimating(false), duration);
    },
    [
      translateY,
      sheetHeight,
      effectiveSnaps,
      closeOffset,
      id,
      onClose,
      disableSwipeDownToClose,
      isTop,
      ctx,
    ]
  );

  const handlePointerCancel = useCallback((e: React.PointerEvent) => {
    if (hasCapturedRef.current) {
      e.currentTarget.releasePointerCapture(e.pointerId);
      setIsDragging(false);
    }
    dragStartRef.current = null;
    lastMoveRef.current = null;
    hasCapturedRef.current = false;
  }, []);

  useEffect(() => {
    if (!isDragging) return;
    const prev = document.body.style.userSelect;
    document.body.style.userSelect = 'none';
    return () => {
      document.body.style.userSelect = prev;
    };
  }, [isDragging]);

  const gestureProps = {
    onPointerDownCapture: handlePointerDownCapture,
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: handlePointerUp,
    onPointerCancel: handlePointerCancel,
  };

  const duration = getCssVar('--bottom-sheet-duration', '0.5s');
  const easing = getCssVar('--bottom-sheet-easing', 'cubic-bezier(0.32, 0.72, 0, 1)');
  const closingProgress = ctx?.topSheetClosingProgress ?? null;
  const isRevealingDuringClose = stackDepth >= 1 && closingProgress != null;
  const easedProgress = isRevealingDuringClose ? getEasedProgress(closingProgress, easing) : 0;
  const transition =
    isDragging || isRevealingDuringClose
      ? 'none'
      : `transform ${duration} ${easing}, height ${duration} ${easing}, transform-origin ${duration} ${easing}`;

  const fromScale = scaleForStackDepth(stackDepth);
  const toScale = scaleForStackDepth(stackDepth - 1);
  const fromOffset = offsetForStackDepth(stackDepth);
  const toOffset = offsetForStackDepth(stackDepth - 1);
  const stackScale = isRevealingDuringClose
    ? fromScale + (toScale - fromScale) * easedProgress
    : fromScale;
  const stackOffsetY = isRevealingDuringClose
    ? fromOffset + (toOffset - fromOffset) * easedProgress
    : fromOffset;

  const closedYNum = sheetHeight + closeOffset;
  const dragProgress =
    closedYNum > firstSnapY
      ? Math.max(0, Math.min(1, (translateY - firstSnapY) / (closedYNum - firstSnapY)))
      : 0;
  const overlayOpacity = isDragging ? 1 - dragProgress : backdropOpacity;
  const overlayTransition = isDragging ? 'none' : `opacity ${duration} ${easing}`;

  const lastOverlayStyleRef = useRef<{ opacity: number; transition: string; pointerEvents: 'auto' | 'none' } | null>(null);

  useEffect(() => {
    if (!isTop || !ctx) return;
    const opacity = enableBackdrop ? overlayOpacity : 0;
    const transition = overlayTransition;
    const pointerEvents = enableBackdrop && enableClickBackdropToClose ? 'auto' : 'none';
    const last = lastOverlayStyleRef.current;
    if (last && last.opacity === opacity && last.transition === transition && last.pointerEvents === pointerEvents) return;
    lastOverlayStyleRef.current = { opacity, transition, pointerEvents };
    ctx.setOverlayStyle({ opacity, transition, pointerEvents });
  }, [isTop, ctx, enableBackdrop, enableClickBackdropToClose, overlayOpacity, overlayTransition]);

  const content = (
    <>
      <div
        ref={sheetRef}
        role={isTop ? 'dialog' : undefined}
        aria-modal={isTop ? true : undefined}
        className={`bottom-sheet${isDragging ? ' dragging' : ''}${stackDepth > 0 ? ' stacked' : ''} ${className ?? ''}`.trim()}
        {...(stackDepth === 0 && !gestureOnlyOnHandler ? gestureProps : {})}
        style={{
          position: 'fixed',
          ...(widthCss
            ? {
              width: widthCss,
              maxWidth: '100%',
              left: '50%',
              transform: `translateX(-50%) translateY(${translateY}px) scale(${stackScale}) translateY(-${stackOffsetY}%)`,
              transformOrigin: 'bottom center',
            }
            : {
              left: 0,
              right: 0,
              transform: `translateY(${translateY}px) scale(${stackScale}) translateY(-${stackOffsetY}%)`,
              transformOrigin: 'bottom center',
            }),
          bottom: 0,
          ...(contentDrivenHeight
            ? { height: sheetHeight === 0 ? 'auto' : sheetHeight, maxHeight: '100vh' }
            : { height: sheetHeight, maxHeight: '100vh' }),
          ['--bottom-sheet-height' as string]: `${sheetHeight}px`,
          transition,
          zIndex: index + 1,
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bottom-sheet-bg)',
          borderRadius: 'var(--bottom-sheet-border-radius)',
          boxShadow: 'var(--bottom-sheet-shadow)',
          padding: 'var(--bottom-sheet-padding)',
        }}
      >
        <div
          ref={handlerRef}
          className="bottom-sheet-handler"
          {...(stackDepth === 0 && gestureOnlyOnHandler ? gestureProps : {})}
          style={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--bottom-sheet-handler-padding)',
            gap: 'var(--bottom-sheet-gap)',
          }}
        >
          <div
            style={{
              width: 'var(--bottom-sheet-handler-width)',
              height: 'var(--bottom-sheet-handler-height)',
              borderRadius: 'var(--bottom-sheet-handler-border-radius)',
              background: 'var(--bottom-sheet-handler-bg)',
            }}
          />
        </div>
        <div
          ref={contentRef}
          className="bottom-sheet-content"
          style={{
            ...(contentDrivenHeight && sheetHeight === 0
              ? { flex: '0 0 auto', overflow: 'visible', minHeight: 0 }
              : { flex: 1, overflow: 'auto', minHeight: 0 }),
          }}
        >
          <ScrollContainerContext.Provider value={scrollCtxValue}>
            <Component
              {...(componentProps as object)}
              id={id}
              close={closeDrawer}
              snapToIndex={snapToIndex}
              openFully={openFully}
            />
          </ScrollContainerContext.Provider>
        </div>
        <div
          className="bottom-sheet-stack-overlay"
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            background: 'var(--bottom-sheet-stack-overlay-bg)',
            borderRadius: 'inherit',
            pointerEvents: stackDepth === 0 && !isRevealingDuringClose ? 'none' : 'auto',
            opacity: isRevealingDuringClose && stackDepth === 1
              ? 1 - easedProgress
              : (stackDepth === 0 ? 0 : 1),
            transition: isRevealingDuringClose ? 'none' : `opacity ${duration} ${easing}`,
            ...((stackDepth > 0 || isRevealingDuringClose) ? { cursor: 'default' as const } : {}),
          }}
        />
      </div>
    </>
  );

  return content;
}

function parseHeight(h: string | number): number {
  if (typeof h === 'number') return h;
  if (typeof document === 'undefined') return 400;
  const v = h.trim();
  if (v.endsWith('%')) {
    return (window.innerHeight * parseFloat(v.slice(0, -1))) / 100;
  }
  if (v.endsWith('px')) return parseFloat(v.slice(0, -2)) || 400;
  if (v.endsWith('rem')) {
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    return parseFloat(v.slice(0, -3)) * rem || 400;
  }
  return parseFloat(v) || 400;
}
