import type { ComponentType, CSSProperties, AnchorHTMLAttributes, ReactNode, ReactElement } from 'react';
import type { SwipeFrame, SwipeOptions } from './swipe';
import type { SwipeHistory } from './history';

export interface PageProps {
  params: Record<string, string>;
  query: Record<string, string>;
  path: string;
}

/** The DOM of one page: el = .swipe-page, scroll = .swipe-scroll, dim = .swipe-dim */
export interface PageParts {
  el: HTMLElement;
  scroll: HTMLElement;
  dim: HTMLElement;
}

/** d: 0 on screen, +1 gone to the right, -1 covered (clamped to -1..1). */
export type Transition = (page: PageParts, d: number, frame: SwipeFrame) => void;

export interface SwipeRouterProps {
  /** { '/': Home, '/item/:id': Item, '*': NotFound }, matched in order */
  routes: Record<string, ComponentType<PageProps>>;
  hash?: boolean;
  base?: string;
  transition?: Transition;
  swipe?: Omit<SwipeOptions, 'limits' | 'onCommit'>;
  className?: string;
  style?: CSSProperties;
  /** Rendered above the stage (tab bars, overlays); may use the hooks */
  children?: ReactNode;
}

export function SwipeRouter(props: SwipeRouterProps): ReactElement;
export function Link(props: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string; replace?: boolean }): ReactElement;
export const slide: Transition;
export function matchRoute(
  routes: SwipeRouterProps['routes'],
  path: string,
): { component: ComponentType<PageProps>; params: Record<string, string>; query: Record<string, string>; pattern: string } | null;

export function useNavigator(): SwipeHistory | null;
export function useRoute(): { path: string; key: string; params: Record<string, string>; query: Record<string, string> };
export function usePageFrame(fn: (d: number, frame: SwipeFrame) => void): void;
export function useSwipeFrame(fn: (frame: SwipeFrame) => void): void;
export function useSwipeBlock(when: boolean, onBlocked?: () => void): void;
