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

export interface ParsedDocument {
  data: any;
  body: string;
}

export interface CharacterSheet {
  type: string;
  name: string;
  profile: string;
  occupation: string;
  level: number;
  resources: { pv: ResourceStat; pd: ResourceStat };
  base_attributes: BaseAttributes;
  abilities: Ability[];
}

interface CharacterStore {
  character: CharacterSheet | null;
  notes: string;
  activePath: string | null;
  loadCharacter: (rawPayload: ParsedDocument, path: string) => void;
  takeDamage: (amount: number) => Promise<void>;
}

// --- DTO ADAPTERS ---
const toEnglish = (raw: any): CharacterSheet => ({
  type: raw.type,
  name: raw.nome,
  profile: raw.perfil,
  occupation: raw.ocupacao,
  level: raw.nivel,
  resources: {
    pv: { current: raw.recursos.pv.atual, max: raw.recursos.pv.max },
    pd: { current: raw.recursos.pd.atual, max: raw.recursos.pd.max },
  },
  base_attributes: {
    physical: raw.atributos_base.fisico,
    mind: raw.atributos_base.mente,
    emotion: raw.atributos_base.emocao,
  },
  abilities: raw.habilidades.map((h: any) => ({
    name: h.nome,
    description: h.descricao,
    active: h.ativa,
  })),
});

const toPortuguese = (eng: CharacterSheet) => ({
  type: eng.type,
  nome: eng.name,
  perfil: eng.profile,
  ocupacao: eng.occupation,
  nivel: eng.level,
  recursos: {
    pv: { atual: eng.resources.pv.current, max: eng.resources.pv.max },
    pd: { atual: eng.resources.pd.current, max: eng.resources.pd.max },
  },
  atributos_base: {
    fisico: eng.base_attributes.physical,
    mente: eng.base_attributes.mind,
    emocao: eng.base_attributes.emotion,
  },
  habilidades: eng.abilities.map((h) => ({
    nome: h.name,
    descricao: h.description,
    ativa: h.active,
  })),
});

export const useCharacterStore = create<CharacterStore>((set, get) => ({
  character: null,
  notes: '',
  activePath: null,

  loadCharacter: (rawPayload, path) =>
    set({
      character: toEnglish(rawPayload.data),
      notes: rawPayload.body,
      activePath: path,
    }),

  takeDamage: async (amount: number) => {
    const { character, notes, activePath } = get();
    if (!character || !activePath) return;

    const updatedCharacter = {
      ...character,
      resources: {
        ...character.resources,
        pv: {
          ...character.resources.pv,
          current: character.resources.pv.current - amount,
        },
      },
    };

    set({ character: updatedCharacter });

    try {
      await invoke('save_character_sheet', {
        path: activePath,
        data: toPortuguese(updatedCharacter),
        body: notes,
      });
    } catch (error) {
      console.error('Failed to save to disk:', error);
    }
  },
}));
