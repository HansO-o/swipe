import type { Swipe, SwipeOptions } from './swipe';

export interface SwipeEntry {
  key: string;
  /** path including the query string, e.g. "/item/3?tab=info" */
  path: string;
}

export interface SwipeHistoryOptions {
  /** Use #/path URLs (works on any static host). Default false */
  hash?: boolean;
  /** Path prefix when not in hash mode, e.g. "/app". Default "" */
  base?: string;
  /** sessionStorage key for the saved stack. Default "swipe-history" */
  storageKey?: string;
  /** swipe.js tuning (limits and onCommit are managed for you) */
  swipe?: Omit<SwipeOptions, 'limits' | 'onCommit'>;
}

export interface SwipeHistory {
  readonly swipe: Swipe;
  readonly entries: readonly SwipeEntry[];
  readonly index: number;
  readonly current: SwipeEntry;
  getSnapshot(): { entries: readonly SwipeEntry[]; index: number };
  subscribe(fn: () => void): () => void;
  on(type: 'change', fn: (s: { entries: readonly SwipeEntry[]; index: number }) => void): () => void;
  on(type: 'blocked', fn: (entry: SwipeEntry) => void): () => void;
  href(path: string): string;
  push(path: string): void;
  replace(path: string): void;
  /** Like the browser's back button (n < 0: forward), animated. force: ignore blocks. */
  back(n?: number, options?: { force?: boolean }): boolean;
  forward(n?: number): boolean;
  /** Keep a page from being left; returns a function that lifts the block. */
  block(key: string, on?: boolean): () => void;
  destroy(): void;
}

export function createSwipeHistory(el: HTMLElement, options?: SwipeHistoryOptions): SwipeHistory;
