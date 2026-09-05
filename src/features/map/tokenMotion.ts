/**
 * Live token positions, deliberately kept outside React.
 *
 * A drag emits a position roughly every animation frame. Routing that through
 * a store would re-render the board sixty times a second and drop frames for
 * everyone watching, so positions live here instead: the board subscribes once
 * and writes straight to the Konva node, and React only re-renders when the
 * *structure* of the board changes (a token placed, removed, or restyled).
 *
 * The map holds the last known position of every token so a node that mounts
 * late — someone joining mid-fight — starts in the right place instead of
 * snapping there on the next move.
 */

export interface Motion {
  x: number;
  y: number;
}

type MotionListener = (
  tokenId: string,
  x: number,
  y: number,
  dragging: boolean
) => void;

const positions = new Map<string, Motion>();
const listeners = new Set<MotionListener>();
/**
 * Tokens this client is physically dragging right now. Incoming updates for
 * them are ignored: the pointer is the source of truth until it lifts, and
 * applying the echo of our own movement would fight the drag.
 */
const heldLocally = new Set<string>();

export const tokenMotion = {
  /** Apply an authoritative position, unless we are dragging that token. */
  apply(tokenId: string, x: number, y: number, dragging = false) {
    if (heldLocally.has(tokenId)) return;
    positions.set(tokenId, { x, y });
    listeners.forEach((listener) => listener(tokenId, x, y, dragging));
  },

  /** Record a position without notifying anyone — used for local drags. */
  set(tokenId: string, x: number, y: number) {
    positions.set(tokenId, { x, y });
  },

  position(tokenId: string): Motion | undefined {
    return positions.get(tokenId);
  },

  /** Reconcile the cache with a full board, dropping tokens that are gone. */
  seed(tokens: { id: string; x: number; y: number }[]) {
    const live = new Set(tokens.map((token) => token.id));
    for (const id of [...positions.keys()]) {
      if (!live.has(id)) positions.delete(id);
    }
    tokens.forEach((token) => {
      if (heldLocally.has(token.id)) return;
      positions.set(token.id, { x: token.x, y: token.y });
    });
  },

  claim(tokenId: string) {
    heldLocally.add(tokenId);
  },

  release(tokenId: string) {
    heldLocally.delete(tokenId);
  },

  clear() {
    positions.clear();
    heldLocally.clear();
  },

  on(listener: MotionListener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
