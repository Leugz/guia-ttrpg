import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import {
  CharacterSheet,
  ParsedDocument,
  ResourceOutcome,
  DeathSaveOutcome,
} from '../lib/types';
import { useChatStore } from './chatStore';

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

      // Automatically log to chat if a death save is triggered
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

  stepSkill: async (skill_id, steps) => {
    const { activePath } = get();
    if (!activePath) return;
    try {
      const updated = await invoke<CharacterSheet>('step_skill', {
        path: activePath,
        skill_id,
        steps,
      });
      set({ character: updated });
    } catch (error) {
      console.error(error);
    }
  },

  toggleEntry: async (entry_id, active) => {
    const { activePath } = get();
    if (!activePath) return;
    try {
      const updated = await invoke<CharacterSheet>('toggle_entry', {
        path: activePath,
        entry_id,
        active,
      });
      set({ character: updated });
    } catch (error) {
      console.error(error);
    }
  },
}));
