import { useEffect, useRef } from 'react';

export interface OutsideClickPanel {
  /** Whether this panel is currently open; closed panels are skipped entirely. */
  isOpen: boolean;
  onClose: () => void;
  /**
   * DOM ids that count as "inside" this panel: typically its trigger button
   * and its own container. A click whose path includes none of them is
   * treated as outside.
   */
  ignoreIds: string[];
}

/**
 * Closes each open panel when a `mousedown` lands outside both its trigger
 * and its own contents.
 *
 * Matching is id-based rather than ref-based because several panels here are
 * toggled independently and don't share a single wrapping element a ref
 * could attach to (e.g. a toolbar button and a menu it opens elsewhere in
 * the tree). One shared listener replaces one per panel.
 */
export function useCloseOnOutsideClick(panels: OutsideClickPanel[]) {
  // Latest callbacks/ignoreIds are read from a ref so the listener itself
  // only needs to be re-attached when the open/closed shape actually changes.
  const panelsRef = useRef(panels);
  useEffect(() => {
    panelsRef.current = panels;
  });

  const openFlags = panels.map((panel) => panel.isOpen).join(',');

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const path = event.composedPath();
      for (const panel of panelsRef.current) {
        if (!panel.isOpen) continue;
        const isInside = panel.ignoreIds.some((id) =>
          path.some((el) => (el as HTMLElement).id === id)
        );
        if (!isInside) panel.onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openFlags]);
}
