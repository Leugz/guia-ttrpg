import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';

export interface ResourceStat {
  current: number;
  max: number;
}
export interface BaseAttributes {
  physical: string;
  mind: string;
  emotion: string;
}
export interface Ability {
  name: string;
  description: string;
  active: boolean;
}

export interface CharacterSheet {
  type: string;
  name: string;
  profile: string;
  occupation: string;
  level: number;
  resources: { hp: ResourceStat; dp: ResourceStat };
  base_attributes: BaseAttributes;
  abilities: Ability[];
}

export interface ParsedDocument {
  data: CharacterSheet;
  body: string;
}

interface CharacterStore {
  character: CharacterSheet | null;
  notes: string;
  activePath: string | null;
  loadCharacter: (doc: ParsedDocument, path: string) => void;
  takeDamage: (amount: number) => Promise<void>;
}

export const useCharacterStore = create<CharacterStore>((set, get) => ({
  character: null,
  notes: '',
  activePath: null,

  loadCharacter: (doc, path) =>
    set({
      character: doc.data,
      notes: doc.body,
      activePath: path,
    }),

  takeDamage: async (amount: number) => {
    const { character, notes, activePath } = get();
    if (!character || !activePath) return;

    const updatedCharacter = {
      ...character,
      resources: {
        ...character.resources,
        hp: {
          ...character.resources.hp,
          current: character.resources.hp.current - amount,
        },
      },
    };

    set({ character: updatedCharacter });

    try {
      await invoke('save_character_sheet', {
        path: activePath,
        data: updatedCharacter,
        body: notes,
      });
    } catch (error) {
      console.error('Failed to save to disk:', error);
    }
  },
}));
