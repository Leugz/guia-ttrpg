import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { invoke } from '@tauri-apps/api/core';
import { useCharacterStore } from '../character-sheet/characterStore';
import { useChatStore } from '../chat/chatStore';
import { setGameContext } from './net/gameClient';
import { lan } from './net/lanConnection';
import { useLanStore } from './net/lanStore';

export interface HostedGame {
  id: string;
  name: string;
  actId: string;
  path: string;
  createdAt: number;
}

interface HostInfo {
  address: string;
  port: number;
}

interface SessionState {
  clientId: string;
  username: string | null;
  activeGamePath: string | null;
  /** Address to dial when joining, or the address to share when hosting. */
  lanHostAddress: string | null;
  isHosting: boolean;
  hostedGames: HostedGame[];
  /** Set when hosting or joining fails, so the UI can stay honest. */
  sessionError: string | null;

  setUsername: (name: string) => void;
  createGame: (name: string, actId: string) => Promise<void>;
  deleteGame: (id: string) => Promise<void>;
  hostGame: (gameId: string) => Promise<void>;
  joinGame: (ipAddress: string) => void;
  leaveGame: () => Promise<void>;
}

const generateClientId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID)
    return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
};

const resetTableState = () => {
  useCharacterStore.getState().clearCharacter();
  useChatStore.getState().clear();
};

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      clientId: generateClientId(),
      username: null,
      activeGamePath: null,
      lanHostAddress: null,
      isHosting: false,
      hostedGames: [],
      sessionError: null,

      setUsername: (name) => set({ username: name.trim() }),

      createGame: async (name, actId) => {
        const id = Date.now().toString(36);
        try {
          // Provisions an independent, mutable copy of the Act under the
          // application data directory.
          const path = await invoke<string>('create_game_instance', {
            gameId: id,
            actId,
          });
          const newGame: HostedGame = {
            id,
            name,
            actId,
            path,
            createdAt: Date.now(),
          };
          set({
            hostedGames: [...get().hostedGames, newGame],
            sessionError: null,
          });
        } catch (error) {
          console.error('Failed to create the game instance:', error);
          set({ sessionError: String(error) });
        }
      },

      deleteGame: async (id) => {
        const game = get().hostedGames.find((g) => g.id === id);
        set({ hostedGames: get().hostedGames.filter((g) => g.id !== id) });
        if (!game) return;
        try {
          await invoke('delete_game_instance', {
            gameId: game.id,
            actId: game.actId,
          });
        } catch (error) {
          // The entry is gone from the list either way; the folder is orphaned
          // at worst, which is recoverable and not worth blocking the UI for.
          console.error('Failed to delete the game folder:', error);
        }
      },

      hostGame: async (gameId) => {
        const game = get().hostedGames.find((g) => g.id === gameId);
        if (!game) return;

        resetTableState();

        try {
          // Re-provision if the folder is missing. Tables created by earlier
          // builds recorded a path that only existed on one machine, so this
          // also repairs them in place.
          const path = await invoke<string>('create_game_instance', {
            gameId: game.id,
            actId: game.actId,
          });

          const info = await invoke<HostInfo>('start_hosting', {
            gameId: game.id,
            gamePath: path,
            clientId: get().clientId,
          });

          setGameContext({ mode: 'host', gameRoot: path });
          set({
            activeGamePath: path,
            isHosting: true,
            lanHostAddress: info.address,
            sessionError: null,
            hostedGames: get().hostedGames.map((g) =>
              g.id === game.id ? { ...g, path } : g
            ),
          });
        } catch (error) {
          console.error('Failed to start hosting:', error);
          setGameContext({ mode: 'offline', gameRoot: null });
          set({ sessionError: String(error) });
        }
      },

      joinGame: (ipAddress) => {
        resetTableState();
        setGameContext({ mode: 'client', gameRoot: null });
        set({
          lanHostAddress: ipAddress.trim(),
          isHosting: false,
          activeGamePath: 'remote_session',
          sessionError: null,
        });
      },

      leaveGame: async () => {
        const { isHosting, clientId } = get();

        // Free the sheet before dropping the socket so nobody is locked out.
        if (!isHosting) lan.releaseSheet(clientId);

        useLanStore.getState().disconnect();
        setGameContext({ mode: 'offline', gameRoot: null });

        if (isHosting) {
          try {
            await invoke('stop_hosting');
          } catch (error) {
            console.error('Failed to stop hosting:', error);
          }
        }

        resetTableState();
        set({
          activeGamePath: null,
          isHosting: false,
          lanHostAddress: null,
          sessionError: null,
        });
      },
    }),
    {
      name: 'guia-user-identity',
      partialize: (state) => ({
        clientId: state.clientId,
        username: state.username,
        hostedGames: state.hostedGames,
      }),
    }
  )
);
