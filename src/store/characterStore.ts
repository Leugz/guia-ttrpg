import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';

export interface ResourceStat {
  atual: number;
  max: number;
}
export interface AtributosBase {
  fisico: string;
  mente: string;
  emocao: string;
}
export interface Habilidade {
  nome: string;
  descricao: string;
  ativa: boolean;
}

export interface CharacterSheet {
  type: string;
  nome: string;
  perfil: string;
  ocupacao: string;
  nivel: number;
  recursos: { pv: ResourceStat; pd: ResourceStat };
  atributos_base: AtributosBase;
  habilidades: Habilidade[];
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

    // Mutate state
    const updatedCharacter = {
      ...character,
      recursos: {
        ...character.recursos,
        pv: {
          ...character.recursos.pv,
          atual: character.recursos.pv.atual - amount,
        },
      },
    };

    // Update frontend immediately for responsiveness
    set({ character: updatedCharacter });

    // Push to Rust for atomic disk save
    try {
      await invoke('save_character_sheet', {
        path: activePath,
        data: updatedCharacter,
        body: notes,
      });
      console.log('Saved atomically to disk.');
    } catch (error) {
      console.error('Failed to save to disk:', error);
    }
  },
}));
