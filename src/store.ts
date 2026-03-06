import type { SheetDescriptor } from './types';

export type SheetController = {
  snapToIndex: (index: number) => void;
  openFully: () => void;
  close: () => void;
};

let idCounter = 0;
function nextId(): symbol {
  return Symbol(`bottom-sheet-${++idCounter}`);
}

let sheets: Array<SheetDescriptor & { id: symbol }> = [];
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function getSheets(): ReadonlyArray<SheetDescriptor & { id: symbol }> {
  return sheets;
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function addSheet(descriptor: Omit<SheetDescriptor, 'id'>): symbol {
  const id = nextId();
  const entry = { ...descriptor, id } as SheetDescriptor & { id: symbol };
  sheets = [...sheets, entry];
  emit();
  return id;
}

export function removeSheet(id: string | symbol): void {
  sheets = sheets.filter((s) => s.id !== id);
  emit();
}

export function removeAllSheets(): void {
  sheets = [];
  emit();
}

const sheetControllers = new Map<symbol | string, SheetController>();
const pendingSnapIndex = new Map<symbol | string, number>();
const pendingOpenFully = new Set<symbol | string>();

export function registerSheetController(id: symbol | string, controller: SheetController): void {
  sheetControllers.set(id, controller);
  const snap = pendingSnapIndex.get(id);
  if (snap !== undefined) {
    pendingSnapIndex.delete(id);
    controller.snapToIndex(snap);
  }
  if (pendingOpenFully.has(id)) {
    pendingOpenFully.delete(id);
    controller.openFully();
  }
}

export function unregisterSheetController(id: symbol | string): void {
  sheetControllers.delete(id);
}

export function getSheetController(id: symbol | string): SheetController | undefined {
  return sheetControllers.get(id);
}

export function invokeSnapToIndex(id: symbol | string, index: number): void {
  const ctrl = sheetControllers.get(id);
  if (ctrl) ctrl.snapToIndex(index);
  else pendingSnapIndex.set(id, index);
}

export function invokeOpenFully(id: symbol | string): void {
  const ctrl = sheetControllers.get(id);
  if (ctrl) ctrl.openFully();
  else pendingOpenFully.add(id);
}
