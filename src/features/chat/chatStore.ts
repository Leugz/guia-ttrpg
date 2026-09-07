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
  setHistory: (messages: ChatMessage[]) => void;
  clear: () => void;
}

const createChatMessage = (input: {
  id: string;
  sender: string;
  username?: string;
  timestamp?: number;
  color?: string;
  type: 'text' | 'roll';
  content?: string;
  rollLabel?: string;
  rollResult?: RollResult;
}): ChatMessage => ({
  id: input.id,
  sender: input.sender,
  username: input.username,
  timestamp: input.timestamp ?? Date.now(),
  color: input.color || '#71717a',
  type: input.type,
  content: input.content,
  rollLabel: input.rollLabel,
  rollResult: input.rollResult,
});

const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
};

const appendUnique = (messages: ChatMessage[], incoming: ChatMessage) =>
  messages.some((m) => m.id === incoming.id)
    ? messages
    : [...messages, incoming];

export const useChatStore = create<ChatStore>((set) => ({
  messages: [],
  addMessage: (msg) => {
    const fullMsg = createChatMessage({
      id: generateId(),
      sender: msg.sender,
      username: msg.username,
      timestamp: msg.timestamp,
      color: msg.color,
      type: msg.type,
      content: msg.content,
      rollLabel: msg.rollLabel,
      rollResult: msg.rollResult,
    });

    set((state) => ({ messages: appendUnique(state.messages, fullMsg) }));

    if (!lan.send(fullMsg)) {
      console.warn(
        'Sem conexão com o mestre: mensagem registrada apenas localmente.'
      );
    }
  },
  setHistory: (messages) => set({ messages: messages.map(createChatMessage) }),
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
    messages: appendUnique(state.messages, createChatMessage(payload)),
  }));
});

lan.on('session', (session) => {
  const restored = session.history.filter(isChatMessage).map(createChatMessage);
  if (restored.length === 0) return;

  useChatStore.setState((state) => {
    const merged = [...restored];
    for (const message of state.messages) {
      if (!merged.some((m) => m.id === message.id)) merged.push(message);
    }
    return { messages: merged };
  });
});
