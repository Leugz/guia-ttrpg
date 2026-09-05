import { create } from 'zustand';
import {
  CharacterSheet,
  ParsedDocument,
  ResourceOutcome,
  DeathSaveOutcome,
} from '../../shared/types';
import { useChatStore } from '../chat/chatStore';
import * as gameClient from '../session/net/gameClient';
import { lan } from '../session/net/lanConnection';

export const GM_COLOR = '#987c50';

export const getProfileColor = (profile?: string) => {
  if (!profile) return '#71717a';
  switch (profile.toUpperCase()) {
    case 'EXECUTOR':
      return '#ae2c12';
    case 'ANALISTA':
      return '#4176ba';
    case 'VIGILANTE':
      return '#4b7e2f';
    case 'MESTRE':
    case 'GM':
      return GM_COLOR;
    default:
      return '#71717a';
  }
};

interface CharacterStore {
  character: CharacterSheet | null;
  notes: string;
  /** File name of the active sheet, e.g. `alan.md`. */
  activeSheetId: string | null;

  impeto: number;
  avaliacao: number;
  activeImpetoBuff: string | null;
  pendingImpetoD4: boolean;
  ajudado: boolean;

  setImpeto: (val: number | ((prev: number) => number)) => void;
  setAvaliacao: (val: number | ((prev: number) => number)) => void;
  setActiveImpetoBuff: (attr: string | null) => void;
  setPendingImpetoD4: (val: boolean) => void;
  setAjudado: (val: boolean) => void;

  loadCharacter: (doc: ParsedDocument, sheetId: string) => void;
  clearCharacter: () => void;
  /** Accept a sheet pushed by the host without touching per-scene UI state. */
  syncCharacter: (sheetId: string, sheet: CharacterSheet) => void;

  applyResourceChange: (resource: 'hp' | 'dp', delta: number) => Promise<void>;
  rollDeathSave: (resource: 'hp' | 'dp') => Promise<void>;
  stepAttribute: (attribute: string, steps: number) => Promise<void>;
  stepSkill: (skillId: string, steps: number) => Promise<void>;
  toggleEntry: (entryId: string, active: boolean) => Promise<void>;
  applyBuiltinEffect: (effectId: string, magnitude?: number) => Promise<void>;
  removeActiveEffect: (effectId: string) => Promise<void>;
}

const SCENE_DEFAULTS = {
  impeto: 0,
  avaliacao: 0,
  activeImpetoBuff: null,
  pendingImpetoD4: false,
  ajudado: false,
} as const;

export const useCharacterStore = create<CharacterStore>((set, get) => ({
  character: null,
  notes: '',
  activeSheetId: null,
  ...SCENE_DEFAULTS,

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

  loadCharacter: (doc, sheetId) =>
    set({
      character: doc.data,
      notes: doc.body,
      activeSheetId: sheetId,
      ...SCENE_DEFAULTS,
    }),

  clearCharacter: () =>
    set({
      character: null,
      notes: '',
      activeSheetId: null,
      ...SCENE_DEFAULTS,
    }),

  syncCharacter: (sheetId, sheet) => {
    if (get().activeSheetId !== sheetId) return;
    set({ character: sheet });
  },

  applyResourceChange: async (resource, delta) => {
    const { activeSheetId, character } = get();
    if (!activeSheetId || !character) return;

    try {
      const outcome: ResourceOutcome = await gameClient.applyResourceChange(
        activeSheetId,
        resource,
        delta
      );
      set({ character: outcome.character });

      if (outcome.change.triggered_save) {
        useChatStore.getState().addMessage({
          sender: 'Sistema',
          color: getProfileColor(character.profile),
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
    const { activeSheetId, character } = get();
    if (!activeSheetId || !character) return;
    try {
      const outcome: DeathSaveOutcome = await gameClient.rollDeathSave(
        activeSheetId,
        resource
      );
      set({ character: outcome.character });
      useChatStore.getState().addMessage({
        sender: outcome.character.name,
        color: getProfileColor(character.profile),
        type: 'roll',
        rollLabel: `Teste de Sobrevivência (${resource.toUpperCase()}) - DT ${outcome.dc}`,
        rollResult: outcome.result,
      });
    } catch (error) {
      console.error('Death save failed:', error);
    }
  },

  stepAttribute: async (attribute, steps) => {
    const { activeSheetId } = get();
    if (!activeSheetId) return;
    try {
      set({
        character: await gameClient.stepAttribute(
          activeSheetId,
          attribute,
          steps
        ),
      });
    } catch (error) {
      console.error(error);
    }
  },

  stepSkill: async (skillId, steps) => {
    const { activeSheetId } = get();
    if (!activeSheetId) return;
    try {
      set({
        character: await gameClient.stepSkill(activeSheetId, skillId, steps),
      });
    } catch (error) {
      console.error(error);
    }
  },

  toggleEntry: async (entryId, active) => {
    const { activeSheetId } = get();
    if (!activeSheetId) return;
    try {
      set({
        character: await gameClient.toggleEntry(activeSheetId, entryId, active),
      });
    } catch (error) {
      console.error(error);
    }
  },

  applyBuiltinEffect: async (effectId, magnitude) => {
    const { activeSheetId } = get();
    if (!activeSheetId) return;
    try {
      set({
        character: await gameClient.applyBuiltinEffect(
          activeSheetId,
          effectId,
          magnitude
        ),
      });
    } catch (error) {
      console.error(error);
    }
  },

  removeActiveEffect: async (effectId) => {
    const { activeSheetId } = get();
    if (!activeSheetId) return;
    try {
      set({
        character: await gameClient.removeActiveEffect(activeSheetId, effectId),
      });
    } catch (error) {
      console.error(error);
    }
  },
}));

// The host announces every write, so a sheet open in two windows stays in step.
lan.on('sheet', ({ sheetId, sheet }) => {
  useCharacterStore.getState().syncCharacter(sheetId, sheet);
});
