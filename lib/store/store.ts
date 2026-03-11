import type { SheetDescriptor } from '../types';

export type SheetController = {
  snapToIndex: (index: number) => void;
  openFully: () => void;
  close: () => void;
};

function nextId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

let sheets: Array<SheetDescriptor & { id: string }> = [];
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function getSheets(): ReadonlyArray<SheetDescriptor & { id: string }> {
  return sheets;
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function addSheet(descriptor: Omit<SheetDescriptor, 'id'>): string {
  const id = nextId();
  const entry = { ...descriptor, id } as SheetDescriptor & { id: string };
  sheets = [...sheets, entry];
  emit();
  return id;
}

export function removeSheet(id: string): void {
  sheets = sheets.filter((s) => s.id !== id);
  emit();
}

export function removeAllSheets(): void {
  sheets = [];
  emit();
}

const sheetControllers = new Map<string, SheetController>();
const pendingSnapIndex = new Map<string, number>();
const pendingOpenFully = new Set<string>();

export function registerSheetController(id: string, controller: SheetController): void {
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

export function unregisterSheetController(id: string): void {
  sheetControllers.delete(id);
}

export function getSheetController(id: string): SheetController | undefined {
  return sheetControllers.get(id);
}

export function invokeSnapToIndex(id: string, index: number): void {
  const ctrl = sheetControllers.get(id);
  if (ctrl) ctrl.snapToIndex(index);
  else pendingSnapIndex.set(id, index);
}

export function invokeOpenFully(id: string): void {
  const ctrl = sheetControllers.get(id);
  if (ctrl) ctrl.openFully();
  else pendingOpenFully.add(id);
}
