import { create } from 'zustand';
import { RollResult } from '../lib/systemRules';

export interface ChatMessage {
  id: string;
  sender: string;
  type: 'text' | 'roll';
  content?: string;
  rollResult?: RollResult;
  rollLabel?: string;
}

interface ChatStore {
  messages: ChatMessage[];
  addMessage: (msg: Omit<ChatMessage, 'id'>) => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  messages: [],
  addMessage: (msg) =>
    set((state) => ({
      // Append the new message and generate a unique UUID for React mapping
      messages: [...state.messages, { ...msg, id: crypto.randomUUID() }],
    })),
}));
