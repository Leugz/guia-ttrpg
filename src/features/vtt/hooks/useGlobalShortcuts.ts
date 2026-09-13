import { useEffect, useRef } from 'react';

export interface GlobalShortcutHandlers {
  onToggleRoller: () => void;
  onToggleChat: () => void;
  onToggleSheet: () => void;
  onToggleHelp: () => void;
  onToggleCurtain: () => void;
  canOpenSheet: boolean;
  canUseCurtain: boolean;
}

const isTypingTarget = (target: EventTarget | null) =>
  target instanceof HTMLInputElement ||
  target instanceof HTMLTextAreaElement ||
  target instanceof HTMLSelectElement ||
  (target instanceof HTMLElement && target.isContentEditable);

export function useGlobalShortcuts(handlers: GlobalShortcutHandlers) {
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;
      // Leave browser and window chords (copy, reload, alt-tab) alone.
      if (event.ctrlKey || event.metaKey || event.altKey) return;

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
      } else if (key === 'v') {
        if (!current.canUseCurtain) return;
        event.preventDefault();
        current.onToggleCurtain();
      } else if (key === '?' || key === 'h') {
        event.preventDefault();
        current.onToggleHelp();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);
}
