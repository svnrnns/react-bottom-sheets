import type { ComponentType } from 'react';

export interface BottomSheetInjectedProps {
  closeDrawer: () => void;
  snapToIndex: (index: number) => void;
}

export interface BottomSheetInstance {
  id: string | symbol;
  close: () => void;
  snapToIndex: (index: number) => void;
  openFully: () => void;
}

export interface PushOptions<T = Record<string, unknown>> {
  component: ComponentType<T & BottomSheetInjectedProps>;
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
}

export interface SheetDescriptor<T = Record<string, unknown>> {
  id: string | symbol;
  component: ComponentType<T & BottomSheetInjectedProps>;
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
}
