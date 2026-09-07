import { useEffect, useRef } from 'react';

export interface GlobalShortcutHandlers {
  onToggleRoller: () => void;
  onToggleChat: () => void;
  onToggleSheet: () => void;
  canOpenSheet: boolean;
}

export function useGlobalShortcuts(handlers: GlobalShortcutHandlers) {
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      const current = handlersRef.current;
      const key = event.key.toLowerCase();

      if (key === 'r') {
        event.preventDefault();
        current.onToggleRoller();
      } else if (key === ' ' || key === 'enter') {
        event.preventDefault();
        current.onToggleChat();
      } else if (key === 'c') {
        event.preventDefault();
        if (current.canOpenSheet) current.onToggleSheet();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);
}
