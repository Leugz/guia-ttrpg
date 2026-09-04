import { create } from 'zustand';
import { RollResult } from '../../shared/types';

export interface Player {
  client_id: string;
  username: string;
  claimed_sheet: string | null;
  color: string;
}

export interface ChatMessage {
  id: string;
  sender: string;
  color: string;
  type: 'text' | 'roll';
  content?: string;
  rollLabel?: string;
  rollResult?: RollResult;
}

interface ChatStore {
  messages: ChatMessage[];
  roster: Player[];
  ws: WebSocket | null;
  connect: (
    ipAddress: string,
    clientId: string,
    username: string,
    color: string
  ) => void;
  addMessage: (
    msg: Omit<ChatMessage, 'id' | 'color'> & { color?: string }
  ) => void;
  claimSheet: (clientId: string, sheetId: string) => void;
  updateIdentity: (clientId: string, username: string, color: string) => void;
}

const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
};

export const useChatStore = create<ChatStore>((set, get) => ({
  messages: [],
  roster: [],
  ws: null,

  connect: (ipAddress, clientId, username, color) => {
    if (get().ws?.readyState === WebSocket.OPEN) return;

    // We use the provided IP Address (or localhost if hosting)
    const socket = new WebSocket(`ws://${ipAddress}:37373/ws`);

    socket.onopen = () => {
      console.log('Connected to LAN server');
      // Announce our presence to the server immediately
      socket.send(JSON.stringify({ type: 'join', clientId, username, color }));
    };

    socket.onmessage = (event) => {
      try {
        const incomingMsg = JSON.parse(event.data);

        // Intercept Roster Syncs to update the Lobby UI
        if (incomingMsg.type === 'roster_sync') {
          set({ roster: incomingMsg.players });
        }
        // Standard chat messages
        else if (incomingMsg.type === 'text' || incomingMsg.type === 'roll') {
          set((state) => {
            if (state.messages.some((m) => m.id === incomingMsg.id))
              return state;
            return {
              messages: [...state.messages, incomingMsg as ChatMessage],
            };
          });
        }
      } catch (e) {
        console.error('Failed to parse incoming WebSocket message', e);
      }
    };

    socket.onclose = () => {
      console.log('Disconnected from LAN server. Reconnecting...');
      setTimeout(
        () => get().connect(ipAddress, clientId, username, color),
        3000
      );
    };

    set({ ws: socket });
  },

  addMessage: (msg) => {
    const finalColor = msg.color || '#71717a';
    const fullMsg: ChatMessage = {
      ...msg,
      color: finalColor,
      id: generateId(),
    };

    const { ws } = get();
    set((state) => ({ messages: [...state.messages, fullMsg] }));

    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(fullMsg));
    } else {
      console.warn('WebSocket not connected. Message saved locally only.');
    }
  },

  claimSheet: (clientId, sheetId) => {
    const { ws } = get();
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'claim', clientId, sheetId }));
    }
  },

  updateIdentity: (clientId, username, color) => {
    const { ws } = get();
    if (ws && ws.readyState === WebSocket.OPEN) {
      // Re-emitting 'join' safely updates our record in the Rust HashMap
      ws.send(JSON.stringify({ type: 'join', clientId, username, color }));
    }
  },
}));
