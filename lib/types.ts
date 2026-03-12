import type { ComponentType } from 'react';

export interface BottomSheetProps {
  id: string;
  close: () => void;
  snapToIndex: (index: number) => void;
  openFully: () => void;
}

export interface BottomSheetPushOptions<T = Record<string, unknown>> {
  component: ComponentType<T & BottomSheetProps>;
  props?: T;
  height?: string | number;
  /** Width in any CSS unit (%, rem, px, vw, etc.), or number (treated as px). When set, the sheet is centered. */
  width?: string | number;
  /** Snap points (e.g. ['10%', '25%']). Also accepts `snapPoints` as alias. */
  snapPoint?: string[];
  /** Alias for snapPoint. Prefer snapPoint. */
  snapPoints?: string[];
  className?: string;
  onClose?: () => void;
  enableClickBackdropToClose?: boolean;
  enableBackdrop?: boolean;
  disableEsc?: boolean;
  gestureOnlyOnHandler?: boolean;
  /** When true, swipe down never closes the sheet; it always returns to the first snap point or open position. */
  disableSwipeDownToClose?: boolean;
  /** When true, document body scroll is disabled while this sheet is the active (top) sheet. Falls back to BottomSheetRoot's disableBodyScroll if undefined. */
  disableBodyScroll?: boolean;
}

export interface SheetDescriptor<T = Record<string, unknown>> {
  id: string;
  component: ComponentType<T & BottomSheetProps>;
  props: T;
  height?: string | number;
  /** Width in any CSS unit (%, rem, px, vw, etc.), or number (treated as px). When set, the sheet is centered. */
  width?: string | number;
  snapPoint?: string[];
  className?: string;
  onClose?: () => void;
  enableClickBackdropToClose?: boolean;
  enableBackdrop?: boolean;
  disableEsc?: boolean;
  gestureOnlyOnHandler?: boolean;
  disableSwipeDownToClose?: boolean;
  /** When true, document body scroll is disabled while this sheet is the active (top) sheet. Falls back to BottomSheetRoot's disableBodyScroll if undefined. */
  disableBodyScroll?: boolean;
}
