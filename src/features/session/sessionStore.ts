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

  activeGameId: string | null;
  activeGamePath: string | null;
  localClaim: string | null;

  lanHostAddress: string | null;
  isHosting: boolean;
  isLanOpen: boolean;

  hostedGames: HostedGame[];
  sessionError: string | null;

  setUsername: (name: string) => void;
  createGame: (name: string, actId: string) => Promise<void>;
  deleteGame: (id: string) => Promise<void>;
  loadLocalGame: (gameId: string) => Promise<void>;

  openLan: () => Promise<void>;
  closeLan: () => Promise<void>;

  joinGame: (ipAddress: string) => void;
  leaveGame: () => Promise<void>;
  setLocalClaim: (claim: string | null) => void;
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
      activeGameId: null,
      activeGamePath: null,
      localClaim: null,
      lanHostAddress: null,
      isHosting: false,
      isLanOpen: false,
      hostedGames: [],
      sessionError: null,

      setUsername: (name) => set({ username: name.trim() }),

      createGame: async (name, actId) => {
        const id = Date.now().toString(36);
        try {
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
          console.error('Failed to delete the game folder:', error);
        }
      },

      loadLocalGame: async (gameId) => {
        const game = get().hostedGames.find((g) => g.id === gameId);
        if (!game) return;

        resetTableState();

        try {
          const path = await invoke<string>('create_game_instance', {
            gameId: game.id,
            actId: game.actId,
          });

          setGameContext({ mode: 'host', gameRoot: path });
          set({
            activeGameId: game.id,
            activeGamePath: path,
            isHosting: true,
            isLanOpen: false,
            lanHostAddress: null,
            sessionError: null,
            localClaim: null,
            hostedGames: get().hostedGames.map((g) =>
              g.id === game.id ? { ...g, path } : g
            ),
          });
        } catch (error) {
          console.error('Failed to load local game:', error);
          setGameContext({ mode: 'offline', gameRoot: null });
          set({ sessionError: String(error) });
        }
      },

      openLan: async () => {
        const { activeGameId, activeGamePath, clientId } = get();
        if (!activeGameId || !activeGamePath) return;

        try {
          const info = await invoke<HostInfo>('start_hosting', {
            gameId: activeGameId,
            gamePath: activeGamePath,
            clientId,
          });
          set({
            lanHostAddress: info.address,
            isLanOpen: true,
          });
        } catch (error) {
          console.error('Failed to open LAN:', error);
          set({ sessionError: String(error) });
        }
      },

      closeLan: async () => {
        try {
          await invoke('stop_hosting');
        } catch (error) {
          console.error('Failed to stop hosting:', error);
        }
        set({ lanHostAddress: null, isLanOpen: false });
        lan.disconnect();
      },

      joinGame: (ipAddress) => {
        resetTableState();
        setGameContext({ mode: 'client', gameRoot: null });
        set({
          lanHostAddress: ipAddress.trim(),
          isHosting: false,
          isLanOpen: true,
          activeGameId: 'remote',
          activeGamePath: 'remote_session',
          sessionError: null,
        });
      },

      leaveGame: async () => {
        const { isHosting, isLanOpen, clientId } = get();

        if (!isHosting) lan.releaseSheet(clientId);
        useLanStore.getState().disconnect();

        setGameContext({ mode: 'offline', gameRoot: null });

        if (isHosting && isLanOpen) {
          try {
            await invoke('stop_hosting');
          } catch (error) {
            console.error('Failed to stop hosting:', error);
          }
        }

        resetTableState();
        set({
          activeGamePath: null,
          activeGameId: null,
          isHosting: false,
          isLanOpen: false,
          lanHostAddress: null,
          sessionError: null,
          localClaim: null,
        });
      },

      setLocalClaim: (claim) => set({ localClaim: claim }),
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
