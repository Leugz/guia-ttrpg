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

  loadCharacter: (doc, path) =>
    set({
      character: doc.data,
      notes: doc.body,
      activePath: path,
    }),

  applyResourceChange: async (resource, delta) => {
    const { activePath } = get();
    if (!activePath) return;

    try {
      const outcome = await invoke<ResourceOutcome>('apply_resource_change', {
        path: activePath,
        resource,
        delta,
      });

      set({ character: outcome.character });

      if (outcome.change.triggered_save) {
        useChatStore.getState().addMessage({
          sender: 'System',
          type: 'text',
          content: `${outcome.character.name} chegou a 0 ${resource.toUpperCase()}! Teste de ${outcome.save_skill} (CD ${outcome.save_dc}) necessário.`,
          rollLabel: 'Aviso de Sobrevivência',
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
        rollLabel: `Teste de Sobrevivência (${resource.toUpperCase()}) - CD ${outcome.dc}`,
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
      // Changed skill_id to skillId
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
      // Changed entry_id to entryId
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
      // Changed effect_id to effectId
      const updated = await invoke<CharacterSheet>('apply_builtin_effect', {
        path: activePath,
        effectId,
        magnitude: magnitude ?? null,
      });
      set({ character: updated });
    } catch (error) {
      console.error('Failed to apply effect:', error);
    }
  },

  removeActiveEffect: async (effectId) => {
    const { activePath } = get();
    if (!activePath) return;
    try {
      // Changed effect_id to effectId
      const updated = await invoke<CharacterSheet>('remove_active_effect', {
        path: activePath,
        effectId,
      });
      set({ character: updated });
    } catch (error) {
      console.error('Failed to remove effect:', error);
    }
  },
}));
