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
        if (saved.length > 0 && useLanStore.getState().tokens.length === 0) {
          tokenMotion.seed(saved);
          useLanStore.setState({ tokens: saved });
        }
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

    const gameRoot = activeGamePath;
    const save = () => {
      const board = snapshotBoard();
      if (!board) return;
      gameClient.saveBoard(board, gameRoot).catch((error) => {
        console.error('Falha ao salvar o tabuleiro:', error);
      });
    };

    save();
    const interval = setInterval(save, 120000);
    window.addEventListener('beforeunload', save);
    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', save);
    };
  }, [tokens, isHosting, isLanOpen, activeGameId, activeGamePath]);
}
