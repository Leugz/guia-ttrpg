import { useCallback, useEffect, useRef, useState } from 'react';

import { dropTokenAt, type TokenDragPayload } from '../../map/tokenDragSource';

/** How far the pointer must travel before a press becomes a drag. */
const DRAG_THRESHOLD_PX = 6;

export interface TokenDragHandle {
  /** Attach to the element that should be draggable. */
  onPointerDown: (event: React.PointerEvent) => void;
  /** Where the ghost should currently sit, in viewport coordinates. */
  ghost: { x: number; y: number } | null;
  /** True once the press has crossed the drag threshold. */
  isDragging: boolean;
  /**
   * Guards the element's own click handler so releasing a drag does not
   * also count as a tap.
   */
  shouldIgnoreClick: () => boolean;
}

/**
 * Drives a token drag with pointer events instead of HTML5 drag and drop,
 * which is inert inside the Windows webview.
 */
export function useTokenDragHandle(
  enabled: boolean,
  buildPayload: () => TokenDragPayload | null
): TokenDragHandle {
  const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const buildRef = useRef(buildPayload);
  useEffect(() => {
    buildRef.current = buildPayload;
  });

  const cleanupRef = useRef<(() => void) | null>(null);
  const swallowClickRef = useRef(false);

  useEffect(() => () => cleanupRef.current?.(), []);

  const onPointerDown = useCallback(
    (event: React.PointerEvent) => {
      if (!enabled || event.button !== 0) return;

      const payload = buildRef.current();
      if (!payload) return;

      const origin = { x: event.clientX, y: event.clientY };
      let armed = false;

      const move = (moveEvent: PointerEvent) => {
        if (
          !armed &&
          Math.hypot(
            moveEvent.clientX - origin.x,
            moveEvent.clientY - origin.y
          ) < DRAG_THRESHOLD_PX
        ) {
          return;
        }
        if (!armed) {
          armed = true;
          setIsDragging(true);
        }
        setGhost({ x: moveEvent.clientX, y: moveEvent.clientY });
      };

      const finish = (upEvent: PointerEvent, dropped: boolean) => {
        cleanupRef.current?.();
        if (!armed) return;
        swallowClickRef.current = true;
        if (dropped) dropTokenAt(payload, upEvent.clientX, upEvent.clientY);
      };

      const up = (upEvent: PointerEvent) => finish(upEvent, true);
      const cancel = (cancelEvent: PointerEvent) => finish(cancelEvent, false);

      cleanupRef.current = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', cancel);
        cleanupRef.current = null;
        setGhost(null);
        setIsDragging(false);
      };

      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', cancel);
    },
    [enabled]
  );

  const shouldIgnoreClick = useCallback(() => {
    if (!swallowClickRef.current) return false;
    swallowClickRef.current = false;
    return true;
  }, []);

  return { onPointerDown, ghost, isDragging, shouldIgnoreClick };
}
