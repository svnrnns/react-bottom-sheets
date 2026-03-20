import {
  createElement,
  useCallback,
  useContext,
  useRef,
  type ComponentPropsWithoutRef,
} from 'react';
import { ScrollContainerContext } from '../context/scrollContext';
import { registerSheetInternalScrollRoot } from '../context/sheetScrollLockRegistry';

const DEFAULT_CLASS = 'bottom-sheet-scrollable';

export type BottomSheetScrollableProps = ComponentPropsWithoutRef<'div'>;

type BottomSheetScrollablePropsWithRef = BottomSheetScrollableProps & { ref?: React.Ref<HTMLDivElement> };

/**
 * Same pattern as {@link DrawerScrollable}: register the scroll node with the sheet.
 * Touch blocking at scroll-top + down lives on BottomSheet (mirrors `useDrawerGesture` + scrollable).
 */
export function BottomSheetScrollable(props: BottomSheetScrollablePropsWithRef) {
  const { registerScrollable } = useContext(ScrollContainerContext);
  const unregisterScrollRootRef = useRef<(() => void) | null>(null);

  const { className: propsClassName, ref: refFromProps, ...rest } = props as BottomSheetScrollablePropsWithRef;

  const setRef = useCallback(
    (el: HTMLDivElement | null) => {
      unregisterScrollRootRef.current?.();
      unregisterScrollRootRef.current = null;
      registerScrollable(el);
      if (typeof refFromProps === 'function') {
        refFromProps(el);
      } else if (refFromProps != null) {
        (refFromProps as React.MutableRefObject<HTMLDivElement | null>).current = el;
      }
      if (el != null) {
        unregisterScrollRootRef.current = registerSheetInternalScrollRoot(el);
      }
    },
    [registerScrollable, refFromProps]
  );

  const className = [DEFAULT_CLASS, propsClassName].filter(Boolean).join(' ');

  return createElement('div', {
    ref: setRef,
    className,
    ...rest,
  });
}
