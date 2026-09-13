/**
 * Pointer-driven hand-off between the portrait card and the board.
 *
 * The board used to accept tokens through HTML5 drag and drop. That never
 * fires inside the WebView2 runtime Tauri uses on Windows, because the
 * webview registers an OS level drop target that swallows the gesture before
 * the page sees it. Plain pointer events behave identically on every
 * platform, so the drag is tracked here and the board simply registers where
 * a release should land.
 */

export interface TokenDragPayload {
  sheetId: string | null;
  label: string;
  color: string;
}

export type TokenDropHandler = (
  payload: TokenDragPayload,
  clientX: number,
  clientY: number
) => void;

let handler: TokenDropHandler | null = null;

export function registerTokenDropTarget(next: TokenDropHandler): () => void {
  handler = next;
  return () => {
    if (handler === next) handler = null;
  };
}

export function dropTokenAt(
  payload: TokenDragPayload,
  clientX: number,
  clientY: number
): void {
  handler?.(payload, clientX, clientY);
}
