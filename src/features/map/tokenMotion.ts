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

const heldLocally = new Set<string>();

export const tokenMotion = {
  apply(tokenId: string, x: number, y: number, dragging = false) {
    if (heldLocally.has(tokenId)) return;
    positions.set(tokenId, { x, y });
    listeners.forEach((listener) => listener(tokenId, x, y, dragging));
  },

  set(tokenId: string, x: number, y: number) {
    positions.set(tokenId, { x, y });
  },

  position(tokenId: string): Motion | undefined {
    return positions.get(tokenId);
  },

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
