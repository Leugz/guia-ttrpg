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
  attributes: BaseAttributes;
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
  modifyResource: (resource: 'hp' | 'dp', delta: number) => Promise<void>;
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

  modifyResource: async (resource: 'hp' | 'dp', delta: number) => {
    const { activePath } = get();
    if (!activePath) return;

    try {
      // We pass the delta (e.g., -1 for damage, +1 for healing) to Rust
      const updatedCharacter = await invoke<CharacterSheet>('modify_resource', {
        path: activePath,
        resource,
        delta,
      });

      // Update the frontend only AFTER Rust confirms the math and disk save
      set({ character: updatedCharacter });
    } catch (error) {
      console.error(`Failed to modify ${resource}:`, error);
    }
  },
}));
