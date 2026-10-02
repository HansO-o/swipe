/** True when running as an installed app (standalone, fullscreen, minimal-ui or window-controls-overlay). */
export function isStandalone(): boolean;

/**
 * Keep the page at 100%: blocks pinch, double-tap, Ctrl/⌘ + wheel, trackpad pinch and Ctrl/⌘ + = - 0.
 * standaloneOnly (default true): do nothing unless running as an installed app.
 * Returns a function that undoes everything.
 */
export function preventZoom(options?: { standaloneOnly?: boolean }): () => void;
