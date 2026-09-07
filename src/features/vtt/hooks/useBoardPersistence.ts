import { useEffect } from 'react';
import * as gameClient from '../../session/net/gameClient';
import {
  markBoardLoaded,
  snapshotBoard,
  useLanStore,
} from '../../session/net/lanStore';
import { tokenMotion } from '../../map/tokenMotion';

export interface BoardPersistenceOptions {
  isHosting: boolean;
  isLanOpen: boolean;
  activeGameId: string | null;
  activeGamePath: string | null;
}

/**
 * Cada mesa guarda o próprio tabuleiro em `board.json`.
 *
 * Both effects below only run while the LAN is closed. Once a table is open
 * the Rust host owns the file: it loaded the board as it bound the port and
 * it has every player's positions, not just this window's.
 */
export function useBoardPersistence({
  isHosting,
  isLanOpen,
  activeGameId,
  activeGamePath,
}: BoardPersistenceOptions) {
  const tokens = useLanStore((state) => state.tokens);

  useEffect(() => {
    if (!isHosting || isLanOpen || !activeGameId) return;

    let cancelled = false;

    gameClient
      .loadBoard()
      .then((saved) => {
        if (cancelled) return;
        // Never clobber a board that is already live on screen.
        if (saved.length > 0 && useLanStore.getState().tokens.length === 0) {
          tokenMotion.seed(saved);
          useLanStore.setState({ tokens: saved });
        }
        // Only now may this window save: until the read came back it had no
        // idea what was on the table.
        markBoardLoaded();
      })
      .catch((error) => {
        console.error('Falha ao carregar o tabuleiro:', error);
      });

    return () => {
      cancelled = true;
    };
  }, [isHosting, isLanOpen, activeGameId]);

  useEffect(() => {
    if (!isHosting || isLanOpen || !activeGameId) return;

    // Captured, so a save in flight while the table closes still names the
    // game it belongs to.
    const gameRoot = activeGamePath;
    const save = () => {
      const board = snapshotBoard();
      if (!board) return;
      gameClient.saveBoard(board, gameRoot).catch((error) => {
        console.error('Falha ao salvar o tabuleiro:', error);
      });
    };

    save(); // Toda vez que uma miniatura for colocada, movida ou removida
    const interval = setInterval(save, 120000); // Rede de segurança
    window.addEventListener('beforeunload', save);
    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', save);
    };
  }, [tokens, isHosting, isLanOpen, activeGameId, activeGamePath]);
}
