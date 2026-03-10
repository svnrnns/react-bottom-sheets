import { createContext, useSyncExternalStore, useCallback, useState } from 'react';
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

export const BottomSheetContext = createContext<{
  registerController: (id: symbol | string, ctrl: { snapToIndex: (i: number) => void; openFully: () => void; close: () => void }) => void;
  unregisterController: (id: symbol | string) => void;
  defaultWidth?: string | number;
  setOverlayStyle: (style: { opacity: number; transition: string; pointerEvents: 'auto' | 'none' }) => void;
  topSheetClosingProgress: number | null;
  setTopSheetClosingProgress: (progress: number | null) => void;
} | null>(null);

function useSheets(): ReadonlyArray<SheetDescriptor & { id: symbol }> {
  return useSyncExternalStore(subscribe, getSheets, getSheets);
}

export interface BottomSheetRootProps {
  /** Default width for all bottom sheets (e.g. '50%', '20rem', 400). Number = px. When set, sheets are centered. */
  width?: string | number;
}

export function BottomSheetRoot({ width }: BottomSheetRootProps = {}) {
  const sheets = useSheets();
  const [topSheetClosingProgress, setTopSheetClosingProgress] = useState<number | null>(null);
  const [overlayStyle, setOverlayStyle] = useState<{
    opacity: number;
    transition: string;
    pointerEvents: 'auto' | 'none';
  }>({ opacity: 0, transition: 'opacity 0.5s cubic-bezier(0.32, 0.72, 0, 1)', pointerEvents: 'none' });

  const registerController = useCallback(
    (id: symbol | string, ctrl: { snapToIndex: (i: number) => void; openFully: () => void; close: () => void }) => {
      registerSheetController(id, ctrl);
    },
    []
  );

  const unregisterController = useCallback((id: symbol | string) => {
    unregisterSheetController(id);
  }, []);

  const container = typeof document !== 'undefined' ? document.body : null;
  const hasContent = sheets.length > 0 && container;

  if (!hasContent) return null;

  return (
    <BottomSheetContext.Provider value={{ registerController, unregisterController, defaultWidth: width, setOverlayStyle, topSheetClosingProgress, setTopSheetClosingProgress }}>
      {createPortal(
        <div className="bottom-sheets-portal" aria-hidden="false">
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
              key={descriptor.id.toString()}
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
