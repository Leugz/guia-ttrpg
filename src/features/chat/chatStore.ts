import { create } from 'zustand';
import { RollResult } from '../../shared/types';

export interface ChatMessage {
  id: string;
  sender: string;
  type: 'text' | 'roll';
  content?: string;
  rollLabel?: string;
  rollResult?: RollResult;
}

interface ChatStore {
  messages: ChatMessage[];
  ws: WebSocket | null;
  connect: (ipAddress: string) => void;
  addMessage: (msg: Omit<ChatMessage, 'id'>) => void;
}

// Fallback for LAN connections where crypto.randomUUID is blocked
const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback unique string generator
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
};

export const useChatStore = create<ChatStore>((set, get) => ({
  messages: [],
  ws: null,

  connect: (ipAddress: string) => {
    if (get().ws?.readyState === WebSocket.OPEN) return;

    const socket = new WebSocket(`ws://${ipAddress}:37373/ws`);

    socket.onopen = () => console.log('Connected to LAN server');

    socket.onmessage = (event) => {
      try {
        const incomingMsg = JSON.parse(event.data) as ChatMessage;
        set((state) => {
          if (state.messages.some((m) => m.id === incomingMsg.id)) return state;
          return { messages: [...state.messages, incomingMsg] };
        });
      } catch (e) {
        console.error('Failed to parse incoming WebSocket message', e);
      }
    };

    socket.onclose = () => {
      console.log('Disconnected from LAN server. Reconnecting...');
      setTimeout(() => get().connect(ipAddress), 3000);
    };

    set({ ws: socket });
  },

  addMessage: (msg) => {
    const fullMsg: ChatMessage = { ...msg, id: generateId() };
    const { ws } = get();

    set((state) => ({ messages: [...state.messages, fullMsg] }));

    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(fullMsg));
    } else {
      console.warn('WebSocket not connected. Message saved locally only.');
    }
  },
}));
