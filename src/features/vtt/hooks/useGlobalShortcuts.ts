import { useEffect, useRef } from 'react';

export interface GlobalShortcutHandlers {
  /** `R` */
  onToggleRoller: () => void;
  /** `Space` or `Enter` */
  onToggleChat: () => void;
  /** `C`, ignored while no sheet is loaded. */
  onToggleSheet: () => void;
  /** Whether `C` should do anything right now. */
  canOpenSheet: boolean;
}

/**
 * Table-wide keyboard shortcuts.
 *
 * The handlers are held in a ref and the listener is attached exactly once for
 * the lifetime of the component. The version this replaces listed `character`
 * in its dependency array, so every resource tick, condition change and live
 * edit pushed from the host tore the `keydown` listener off `window` and
 * attached a new one — a `removeEventListener`/`addEventListener` pair on a
 * global target several times a second during combat.
 */
export function useGlobalShortcuts(handlers: GlobalShortcutHandlers) {
  // Refreshed in an effect rather than assigned during render: a ref write in
  // the render body is a side effect, and React may discard a render pass.
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      // Ignora atalhos de teclado se o usuário estiver digitando
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
