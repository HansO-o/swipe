export type SwipeState = 'idle' | 'pending' | 'held' | 'tracking' | 'settling';

/** How far the gesture may go from the current page, in pages. */
export interface SwipeLimits {
  back: number;
  forward: number;
}

/** What subscribers receive each frame. Positions are in p units: 100 = one page. */
export interface SwipeFrame {
  /** performance.now() of this frame */
  time: number;
  /** the signal: 0 at rest, 100 = one page back, -100 = one page forward */
  p: number;
  /** p units per millisecond */
  v: number;
  state: SwipeState;
  /** true from the first touch until rest; limits are frozen meanwhile */
  busy: boolean;
  /** where this gesture started from: 0 at rest, or the target of the flight it caught */
  base: number;
  /** landing point of the current flight, null while not settling */
  target: number | null;
  /** where the page is heading: stable while dragging (position + hysteresis), the target once released */
  intent: number;
  /** allowed p range for this session */
  range: readonly [number, number];
}

export interface SwipeOptions {
  /** Pages available from the current one. Return null to disable the gesture (e.g. a root page). Default: one page back. */
  limits?: () => SwipeLimits | null;
  /** p came to rest at pages × 100 and has been reset to 0. Move your page index by `pages` here, synchronously. */
  onCommit?: ((pages: number) => void) | null;
  /** Width of one page in px. Default: the element's width. */
  width?: (() => number) | null;
  /** Spring period in seconds. Default 0.42 */
  response?: number;
  /** Spring damping ratio. Default 0.92 */
  damping?: number;
  /** Per-ms deceleration for the flick projection. Default 0.998 */
  decel?: number;
  /** ms the release velocity is extrapolated along the measured acceleration. Default 20 */
  accelTau?: number;
  /** Rubber-band stiffness past the limits. Default 0.55 */
  rubber?: number;
  /** % of a page before `intent` switches. Default 50 */
  intentOn?: number;
  /** % of a page the finger must come back to switch `intent` back. Default 30 */
  intentOff?: number;
  /** px from the screen edge where a swipe may start; 0 = anywhere. Default 0 */
  edge?: number;
  /** CSS selector of elements a swipe never starts on. */
  ignore?: string | null;
  /** Slow motion factor for flights. Default 1 */
  timeScale?: number;
  /** cubic-bezier [x1, y1, x2, y2] for go() / enter(); null = spring. Default [0.32, 0.72, 0, 1] */
  curve?: readonly [number, number, number, number] | null;
  /** ms for one page along `curve`; longer trips scale by √pages. Default 460 */
  duration?: number;
}

export interface FlightOptions {
  /** cubic-bezier [x1, y1, x2, y2], or null for the spring. Default: opts.curve */
  curve?: readonly [number, number, number, number] | null;
}

export interface Swipe {
  /** Exact p at this instant (computed from the spring during a flight). */
  readonly p: number;
  /** p units per millisecond. */
  readonly velocity: number;
  readonly state: SwipeState;
  readonly busy: boolean;
  /** Live options: change any field at any time. */
  opts: Required<Omit<SwipeOptions, 'onCommit' | 'width'>> & Pick<SwipeOptions, 'onCommit' | 'width'>;
  snapshot(): SwipeFrame;
  /** Runs once per frame while anything moves. Return true to request another frame. */
  subscribe(fn: (frame: SwipeFrame) => boolean | void): () => void;
  on(type: 'start', fn: (e: { base: number }) => void): () => void;
  on(type: 'release', fn: (e: { target: number; proj: number; p: number; v: number; base: number }) => void): () => void;
  on(type: 'commit', fn: (e: { pages: number }) => void): () => void;
  /** Request a frame (e.g. your own animation just started). */
  wake(): void;
  /** Animate n pages (n > 0 back, n < 0 forward). Chains onto a flight. False while a finger is down. */
  go(pages: number, options?: FlightOptions): boolean;
  /** You just added pages on top: slide in from p = pages × 100 to 0. False while busy. */
  enter(pages?: number, options?: FlightOptions): boolean;
  destroy(): void;
}

export const defaults: Readonly<Required<Omit<SwipeOptions, 'limits' | 'onCommit' | 'width'>>>;

export function createSwipe(el: HTMLElement, opts?: SwipeOptions): Swipe;
