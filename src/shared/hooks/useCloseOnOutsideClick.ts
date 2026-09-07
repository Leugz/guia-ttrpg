import { useEffect, useRef } from 'react';

export interface OutsideClickPanel {
  isOpen: boolean;
  onClose: () => void;

  ignoreIds: string[];
}

export function useCloseOnOutsideClick(panels: OutsideClickPanel[]) {
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
