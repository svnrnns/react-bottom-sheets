import { createContext, useSyncExternalStore, useCallback, useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  getSheets,
  subscribe,
  registerSheetController,
  unregisterSheetController,
  getSheetController,
} from '../store/store';
import type { SheetDescriptor } from '../types';
import { BottomSheet } from '../components/BottomSheet';
import { isTargetInsideSheetScrollRoot } from './sheetScrollLockRegistry';
import { isSheetDragDocumentTouchLocked } from './sheetDragDocumentTouchLock';

export const BottomSheetContext = createContext<{
  registerController: (id: string, ctrl: { snapToIndex: (i: number) => void; openFully: () => void; close: () => void }) => void;
  unregisterController: (id: string) => void;
  defaultWidth?: string | number;
  setOverlayStyle: (style: { opacity: number; transition: string; pointerEvents: 'auto' | 'none' }) => void;
  topSheetClosingProgress: number | null;
  setTopSheetClosingProgress: (progress: number | null) => void;
} | null>(null);

function useSheets(): ReadonlyArray<SheetDescriptor & { id: string }> {
  return useSyncExternalStore(subscribe, getSheets, getSheets);
}

export interface BottomSheetRootProps {
  /** Default width for all bottom sheets (e.g. '50%', '20rem', 400). Number = px. When set, sheets are centered. */
  width?: string | number;
  /** When true, document body scroll is disabled while any bottom sheet is open. Can be overridden per sheet via pushBottomSheet({ disableBodyScroll: false }). */
  disableBodyScroll?: boolean;
}

export function BottomSheetRoot({ width, disableBodyScroll: defaultDisableBodyScroll }: BottomSheetRootProps = {}) {
  const sheets = useSheets();
  const [topSheetClosingProgress, setTopSheetClosingProgress] = useState<number | null>(null);
  const [overlayStyle, setOverlayStyle] = useState<{
    opacity: number;
    transition: string;
    pointerEvents: 'auto' | 'none';
  }>({ opacity: 0, transition: 'opacity 0.5s cubic-bezier(0.32, 0.72, 0, 1)', pointerEvents: 'none' });

  const topSheet = sheets.length > 0 ? sheets[sheets.length - 1] : null;
  const isTopSheetClosing = topSheetClosingProgress !== null;
  const shouldDisableBodyScroll =
    typeof document !== 'undefined' &&
    topSheet != null &&
    !isTopSheetClosing &&
    (topSheet.disableBodyScroll ?? defaultDisableBodyScroll) === true;

  const portalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof document === 'undefined' || !shouldDisableBodyScroll) return;
    const shouldPreventScroll = (target: EventTarget | null): boolean => {
      if (!portalRef.current || !(target instanceof Node)) return true;
      if (!portalRef.current.contains(target)) return true;
      /* BottomSheetScrollable registers here — do not block wheel/touch (overflow heuristics fail with text nodes, flex, shorthand). */
      if (isTargetInsideSheetScrollRoot(target)) return false;
      let el: Element | null =
        target instanceof Element ? target : target.parentElement;
      while (el && el !== portalRef.current) {
        if (el instanceof HTMLElement) {
          const style = getComputedStyle(el);
          const overflowY = style.overflowY;
          if (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') {
            return false;
          }
        }
        el = el.parentElement;
      }
      return true;
    };
    const onWheel = (e: WheelEvent) => {
      if (shouldPreventScroll(e.target)) e.preventDefault();
    };
    const onTouchMove = (e: TouchEvent) => {
      if (shouldPreventScroll(e.target)) e.preventDefault();
    };
    document.addEventListener('wheel', onWheel, { passive: false });
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => {
      document.removeEventListener('wheel', onWheel);
      document.removeEventListener('touchmove', onTouchMove);
    };
  }, [shouldDisableBodyScroll]);

  /* Independent of disableBodyScroll: while a sheet drag holds the lock, prevent document touch scrolling inside the portal (WebKit pointercancel ~500ms). */
  useEffect(() => {
    if (typeof document === 'undefined' || sheets.length === 0) return;
    const onTouchMoveCapture = (e: TouchEvent) => {
      if (!isSheetDragDocumentTouchLocked()) return;
      if (!portalRef.current || !(e.target instanceof Node) || !portalRef.current.contains(e.target)) return;
      e.preventDefault();
    };
    document.addEventListener('touchmove', onTouchMoveCapture, { capture: true, passive: false });
    return () => {
      document.removeEventListener('touchmove', onTouchMoveCapture, { capture: true });
    };
  }, [sheets.length]);

  const registerController = useCallback(
    (id: string, ctrl: { snapToIndex: (i: number) => void; openFully: () => void; close: () => void }) => {
      registerSheetController(id, ctrl);
    },
    []
  );

  const unregisterController = useCallback((id: string) => {
    unregisterSheetController(id);
  }, []);

  const container = typeof document !== 'undefined' ? document.body : null;
  const hasContent = sheets.length > 0 && container;

  if (!hasContent) return null;

  return (
    <BottomSheetContext.Provider value={{ registerController, unregisterController, defaultWidth: width, setOverlayStyle, topSheetClosingProgress, setTopSheetClosingProgress }}>
      {createPortal(
        <div ref={portalRef} className="bottom-sheets-portal" aria-hidden="false">
          {shouldDisableBodyScroll && (
            <div
              className="bottom-sheet-scroll-lock"
              aria-hidden
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: -1,
                touchAction: 'none',
                pointerEvents: 'auto',
              }}
            />
          )}
          {sheets.length > 0 && (
            <div
              className="bottom-sheet-overlay"
              style={{
                position: 'fixed',
                inset: 0,
                background: 'var(--bottom-sheet-overlay-bg)',
                backdropFilter: 'var(--bottom-sheet-overlay-blur-filter)',
                zIndex: 0,
                pointerEvents: overlayStyle.pointerEvents ?? 'none',
                opacity: overlayStyle.opacity,
                transition: overlayStyle.transition,
                ...(shouldDisableBodyScroll ? { touchAction: 'none' as const } : {}),
              }}
              onClick={() => {
                const top = sheets[sheets.length - 1];
                if (top?.enableClickBackdropToClose) {
                  getSheetController(top.id)?.close();
                }
              }}
              aria-hidden
            />
          )}
          {sheets.map((descriptor, index) => (
            <BottomSheet
              key={descriptor.id}
              descriptor={descriptor}
              index={index}
              isTop={index === sheets.length - 1}
              stackDepth={sheets.length - 1 - index}
            />
          ))}
        </div>,
        container
      )}
    </BottomSheetContext.Provider>
  );
}
