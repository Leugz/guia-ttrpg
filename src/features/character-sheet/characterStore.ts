import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import {
  CharacterSheet,
  ParsedDocument,
  ResourceOutcome,
  DeathSaveOutcome,
} from '../../shared/types';
import { useChatStore } from '../chat/chatStore';

interface CharacterStore {
  character: CharacterSheet | null;
  notes: string;
  activePath: string | null;

  // Real-time Ability Trackers
  impeto: number;
  avaliacao: number;
  activeImpetoBuff: string | null;
  pendingImpetoD4: boolean;
  ajudado: boolean; // NEW: Transient Help Buff

  setImpeto: (val: number | ((prev: number) => number)) => void;
  setAvaliacao: (val: number | ((prev: number) => number)) => void;
  setActiveImpetoBuff: (attr: string | null) => void;
  setPendingImpetoD4: (val: boolean) => void;
  setAjudado: (val: boolean) => void; // NEW

  loadCharacter: (doc: ParsedDocument, path: string) => void;
  applyResourceChange: (resource: 'hp' | 'dp', delta: number) => Promise<void>;
  rollDeathSave: (resource: 'hp' | 'dp') => Promise<void>;
  stepAttribute: (attribute: string, steps: number) => Promise<void>;
  stepSkill: (skillId: string, steps: number) => Promise<void>;
  toggleEntry: (entryId: string, active: boolean) => Promise<void>;
  applyBuiltinEffect: (effectId: string, magnitude?: number) => Promise<void>;
  removeActiveEffect: (effectId: string) => Promise<void>;
}

export const useCharacterStore = create<CharacterStore>((set, get) => ({
  character: null,
  notes: '',
  activePath: null,

  impeto: 0,
  avaliacao: 0,
  activeImpetoBuff: null,
  pendingImpetoD4: false,
  ajudado: false,

  setImpeto: (val) =>
    set((state) => ({
      impeto: typeof val === 'function' ? val(state.impeto) : val,
    })),
  setAvaliacao: (val) =>
    set((state) => ({
      avaliacao: typeof val === 'function' ? val(state.avaliacao) : val,
    })),
  setActiveImpetoBuff: (attr) => set({ activeImpetoBuff: attr }),
  setPendingImpetoD4: (val) => set({ pendingImpetoD4: val }),
  setAjudado: (val) => set({ ajudado: val }),

  loadCharacter: (doc, path) =>
    set({
      character: doc.data,
      notes: doc.body,
      activePath: path,
      impeto: 0,
      avaliacao: 0,
      activeImpetoBuff: null,
      pendingImpetoD4: false,
      ajudado: false,
    }),

  applyResourceChange: async (resource, delta) => {
    const { activePath, character } = get();
    if (!activePath || !character) return;

    try {
      const outcome = await invoke<ResourceOutcome>('apply_resource_change', {
        path: activePath,
        resource,
        delta,
      });
      set({ character: outcome.character });

      if (outcome.change.triggered_save) {
        useChatStore.getState().addMessage({
          sender: 'Sistema',
          type: 'text',
          content: `${outcome.character.name} chegou a 0 ${resource.toUpperCase()}! Teste necessário.`,
          rollLabel: 'Aviso Crítico',
        });
      }
    } catch (error) {
      console.error(`Failed to modify ${resource}:`, error);
    }
  },

  rollDeathSave: async (resource) => {
    const { activePath } = get();
    if (!activePath) return;
    try {
      const outcome = await invoke<DeathSaveOutcome>('roll_death_save', {
        path: activePath,
        resource,
      });
      set({ character: outcome.character });
      useChatStore.getState().addMessage({
        sender: outcome.character.name,
        type: 'roll',
        rollLabel: `Teste de Sobrevivência (${resource.toUpperCase()}) - DT ${outcome.dc}`,
        rollResult: outcome.result,
      });
    } catch (error) {
      console.error(`Death save failed:`, error);
    }
  },

  stepAttribute: async (attribute, steps) => {
    const { activePath } = get();
    if (!activePath) return;
    try {
      const updated = await invoke<CharacterSheet>('step_attribute', {
        path: activePath,
        attribute,
        steps,
      });
      set({ character: updated });
    } catch (error) {
      console.error(error);
    }
  },

  stepSkill: async (skillId, steps) => {
    const { activePath } = get();
    if (!activePath) return;
    try {
      const updated = await invoke<CharacterSheet>('step_skill', {
        path: activePath,
        skillId,
        steps,
      });
      set({ character: updated });
    } catch (error) {
      console.error(error);
    }
  },

  toggleEntry: async (entryId, active) => {
    const { activePath } = get();
    if (!activePath) return;
    try {
      const updated = await invoke<CharacterSheet>('toggle_entry', {
        path: activePath,
        entryId,
        active,
      });
      set({ character: updated });
    } catch (error) {
      console.error(error);
    }
  },

  applyBuiltinEffect: async (effectId, magnitude) => {
    const { activePath } = get();
    if (!activePath) return;
    try {
      const updated = await invoke<CharacterSheet>('apply_builtin_effect', {
        path: activePath,
        effectId,
        magnitude: magnitude ?? null,
      });
      set({ character: updated });
    } catch (error) {
      console.error(error);
    }
  },

  removeActiveEffect: async (effectId) => {
    const { activePath } = get();
    if (!activePath) return;
    try {
      const updated = await invoke<CharacterSheet>('remove_active_effect', {
        path: activePath,
        effectId,
      });
      set({ character: updated });
    } catch (error) {
      console.error(error);
    }
  },
}));
