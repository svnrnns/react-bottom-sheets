import {
  addSheet,
  removeSheet,
  removeAllSheets,
  getSheets,
  invokeSnapToIndex,
  invokeOpenFully,
} from './store/store';
import type { PushOptions, BottomSheetInstance, SheetDescriptor } from './types';
import { BottomSheetRoot } from './context/context';

export { BottomSheetRoot };
export type { BottomSheetRootProps } from './context/context';

export function pushBottomSheet<T = Record<string, unknown>>(
  options: PushOptions<T>
): BottomSheetInstance {
  const descriptor: Omit<SheetDescriptor<T>, 'id'> = {
    component: options.component,
    props: (options.props ?? {}) as T,
    height: options.height,
    width: options.width,
    snapPoint: options.snapPoint ?? options.snapPoints,
    className: options.className,
    onClose: options.onClose,
    enableClickBackdropToClose: options.enableClickBackdropToClose,
    enableBackdrop: options.enableBackdrop,
    disableEsc: options.disableEsc,
    gestureOnlyOnHandler: options.gestureOnlyOnHandler,
    disableSwipeDownToClose: options.disableSwipeDownToClose,
  };
  const id = addSheet(descriptor as Omit<SheetDescriptor, 'id'>);
  return {
    id,
    close: () => removeSheet(id),
    snapToIndex: (index: number) => invokeSnapToIndex(id, index),
    openFully: () => invokeOpenFully(id),
  };
}

export function popBottomSheet(): void {
  const sheets = getSheets();
  if (sheets.length > 0) {
    const last = sheets[sheets.length - 1];
    removeSheet(last.id);
  }
}

export function closeBottomSheet(id: string | symbol): void {
  removeSheet(id);
}

export function closeAllBottomSheets(): void {
  removeAllSheets();
}
