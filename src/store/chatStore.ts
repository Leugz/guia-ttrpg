import { create } from 'zustand';
import { RollResult } from '../lib/types'; // Updated import path

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
  addMessage: (msg: Omit<ChatMessage, 'id'>) => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  messages: [],
  addMessage: (msg) =>
    set((state) => ({
      messages: [...state.messages, { ...msg, id: crypto.randomUUID() }],
    })),
}));
