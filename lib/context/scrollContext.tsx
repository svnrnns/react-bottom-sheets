import { createContext, useContext } from 'react';

/** Same idea as {@link DrawerScrollableContext}: single scroll root per sheet. */
export interface BottomSheetScrollContextValue {
  registerScrollable: (el: HTMLElement | null) => void;
}

const noopRegister = () => {};

export const ScrollContainerContext = createContext<BottomSheetScrollContextValue>({
  registerScrollable: noopRegister,
});

export function useScrollContainerContext(): BottomSheetScrollContextValue {
  return useContext(ScrollContainerContext);
}
