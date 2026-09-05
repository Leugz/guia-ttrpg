import { create } from 'zustand';
import { RollResult } from '../../shared/types';
import { lan } from '../session/net/lanConnection';

export type { LanPlayer as Player } from '../session/net/protocol';

export interface ChatMessage {
  id: string;
  sender: string;
  username?: string;
  timestamp?: number;
  color: string;
  type: 'text' | 'roll';
  content?: string;
  rollLabel?: string;
  rollResult?: RollResult;
}

interface ChatStore {
  messages: ChatMessage[];
  addMessage: (
    msg: Omit<ChatMessage, 'id' | 'color' | 'timestamp'> & {
      color?: string;
      timestamp?: number;
    }
  ) => void;
  /** Replace the log, used when the host sends the backlog on (re)connect. */
  setHistory: (messages: ChatMessage[]) => void;
  clear: () => void;
}

const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
};

/** Append unless we already hold this id, so echoes and replays are harmless. */
const appendUnique = (messages: ChatMessage[], incoming: ChatMessage) =>
  messages.some((m) => m.id === incoming.id)
    ? messages
    : [...messages, incoming];

export const useChatStore = create<ChatStore>((set) => ({
  messages: [],
  addMessage: (msg) => {
    const fullMsg: ChatMessage = {
      ...msg,
      color: msg.color || '#71717a',
      id: generateId(),
      timestamp: msg.timestamp || Date.now(),
    };
    // Shown locally straight away; the host echoes it back to everyone else and
    // the id keeps that echo from duplicating.
    set((state) => ({ messages: appendUnique(state.messages, fullMsg) }));

    if (!lan.send(fullMsg)) {
      console.warn(
        'Sem conexão com o mestre: mensagem registrada apenas localmente.'
      );
    }
  },
  setHistory: (messages) => set({ messages }),
  clear: () => set({ messages: [] }),
}));

const isChatMessage = (value: unknown): value is ChatMessage => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ChatMessage>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.sender === 'string' &&
    (candidate.type === 'text' || candidate.type === 'roll')
  );
};

lan.on('chat', (payload) => {
  if (!isChatMessage(payload)) return;
  useChatStore.setState((state) => ({
    messages: appendUnique(state.messages, payload),
  }));
});

// Backlog on join. Anything already on screen is preserved by id.
lan.on('session', (session) => {
  const restored = session.history.filter(isChatMessage);
  if (restored.length === 0) return;

  useChatStore.setState((state) => {
    const merged = [...restored];
    for (const message of state.messages) {
      if (!merged.some((m) => m.id === message.id)) merged.push(message);
    }
    return { messages: merged };
  });
});
