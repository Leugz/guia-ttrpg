import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { invoke } from '@tauri-apps/api/core';
import { useCharacterStore } from '../character-sheet/characterStore';

export interface HostedGame {
  id: string;
  name: string;
  actId: string;
  path: string;
  createdAt: number;
}

interface SessionState {
  clientId: string;
  username: string | null;
  activeGamePath: string | null;
  lanHostAddress: string | null;
  isHosting: boolean;
  hostedGames: HostedGame[];

  setUsername: (name: string) => void;
  createGame: (name: string, actId: string) => Promise<void>;
  deleteGame: (id: string) => void;
  hostGame: (gameId: string) => void;
  joinGame: (ipAddress: string) => void;
  leaveGame: () => void;
}

const generateClientId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID)
    return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
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

      setUsername: (name) => set({ username: name.trim() }),

      createGame: async (name, actId) => {
        const id = Date.now().toString(36);
        try {
          // Invokes the new Rust backend command to physically duplicate the folder
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
          set({ hostedGames: [...get().hostedGames, newGame] });
        } catch (e) {
          console.error('Failed to clone game directories:', e);
        }
      },

      deleteGame: (id) => {
        // Future: You could also invoke a Rust command here to delete the physical folder
        set({ hostedGames: get().hostedGames.filter((g) => g.id !== id) });
      },

      hostGame: (gameId) => {
        useCharacterStore.getState().clearCharacter(); // WIPE BLEEDING STATE
        const game = get().hostedGames.find((g) => g.id === gameId);
        if (game) {
          set({
            activeGamePath: game.path,
            isHosting: true,
            lanHostAddress: 'localhost',
          });
        }
      },

      joinGame: (ipAddress) => {
        useCharacterStore.getState().clearCharacter(); // WIPE BLEEDING STATE
        set({
          lanHostAddress: ipAddress.trim(),
          isHosting: false,
          activeGamePath: 'remote_session',
        });
      },

      leaveGame: () => {
        useCharacterStore.getState().clearCharacter(); // WIPE BLEEDING STATE ON LOGOUT
        set({ activeGamePath: null, isHosting: false, lanHostAddress: null });
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
