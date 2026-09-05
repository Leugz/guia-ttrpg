/**
 * The one place that knows whether we own the campaign files or have to ask
 * the host for them.
 *
 * Every store and component addresses characters by *sheet id* (the file name,
 * e.g. `alan.md`). When hosting, that id is joined onto the local game
 * directory and handled over Tauri IPC. When joined, the same call goes to the
 * host over the LAN socket and runs against the identical Rust code there.
 *
 * This module deliberately imports no stores, so the dependency graph stays
 * acyclic: `sessionStore` pushes context in, everyone else just calls.
 */

import { invoke } from '@tauri-apps/api/core';

import type {
  CharacterSheet,
  DeathSaveOutcome,
  ParsedDocument,
  ResolvedPool,
  ResourceOutcome,
  RollResult,
  TestOutcome,
  TestRequest,
} from '../../../shared/types';
import { lan } from './lanConnection';
import { RpcMethod, type SheetSummary } from './protocol';

export type GameMode = 'offline' | 'host' | 'client';

interface GameContext {
  mode: GameMode;
  /** Absolute path to the game instance. Only meaningful when hosting. */
  gameRoot: string | null;
}

let context: GameContext = { mode: 'offline', gameRoot: null };

export const setGameContext = (next: GameContext) => {
  context = next;
};

export const getGameContext = (): GameContext => context;

export const isHostingGame = () => context.mode === 'host';

/** Sheet ids are bare file names; the backend refuses anything else. */
const localPath = (sheetId: string): string => {
  if (!context.gameRoot) {
    throw new Error('Nenhuma mesa está aberta nesta máquina.');
  }
  return `${context.gameRoot}/${sheetId}`;
};

/**
 * Run an operation against the local files when hosting, or against the host
 * when joined. Both branches return the same shape.
 */
const dispatch = async <T>(
  local: () => Promise<T>,
  remote: () => Promise<T>
): Promise<T> => {
  if (context.mode === 'host') return local();
  if (context.mode === 'client') return remote();
  throw new Error('Você não está em uma sessão.');
};

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export const listSheets = (): Promise<SheetSummary[]> =>
  dispatch(
    () =>
      invoke<SheetSummary[]>('list_game_sheets', {
        gamePath: context.gameRoot,
      }),
    () => lan.request(RpcMethod.listSheets)
  );

export const loadSheet = (sheetId: string): Promise<ParsedDocument> =>
  dispatch(
    () =>
      invoke<ParsedDocument>('load_character_sheet', {
        path: localPath(sheetId),
      }),
    () => lan.request(RpcMethod.loadSheet, { sheetId })
  );

export const previewTest = (
  sheetId: string,
  request: TestRequest
): Promise<ResolvedPool> =>
  dispatch(
    () =>
      invoke<ResolvedPool>('preview_test', {
        path: localPath(sheetId),
        request,
      }),
    () => lan.request(RpcMethod.previewTest, { sheetId, request })
  );

// ---------------------------------------------------------------------------
// Writes
//
// Each of these persists on the host and fans a `sheet_update` out to every
// connected client, so a GM watching a player's sheet sees the change land.
// ---------------------------------------------------------------------------

export const applyResourceChange = (
  sheetId: string,
  resource: 'hp' | 'dp',
  delta: number
): Promise<ResourceOutcome> =>
  dispatch(
    () =>
      invoke<ResourceOutcome>('apply_resource_change', {
        path: localPath(sheetId),
        resource,
        delta,
      }),
    () =>
      lan.request(RpcMethod.applyResourceChange, { sheetId, resource, delta })
  );

export const rollDeathSave = (
  sheetId: string,
  resource: 'hp' | 'dp'
): Promise<DeathSaveOutcome> =>
  dispatch(
    () =>
      invoke<DeathSaveOutcome>('roll_death_save', {
        path: localPath(sheetId),
        resource,
      }),
    () => lan.request(RpcMethod.rollDeathSave, { sheetId, resource })
  );

export const stepAttribute = (
  sheetId: string,
  attribute: string,
  steps: number
): Promise<CharacterSheet> =>
  dispatch(
    () =>
      invoke<CharacterSheet>('step_attribute', {
        path: localPath(sheetId),
        attribute,
        steps,
      }),
    () => lan.request(RpcMethod.stepAttribute, { sheetId, attribute, steps })
  );

export const stepSkill = (
  sheetId: string,
  skillId: string,
  steps: number
): Promise<CharacterSheet> =>
  dispatch(
    () =>
      invoke<CharacterSheet>('step_skill', {
        path: localPath(sheetId),
        skillId,
        steps,
      }),
    () => lan.request(RpcMethod.stepSkill, { sheetId, skillId, steps })
  );

export const toggleEntry = (
  sheetId: string,
  entryId: string,
  active: boolean
): Promise<CharacterSheet> =>
  dispatch(
    () =>
      invoke<CharacterSheet>('toggle_entry', {
        path: localPath(sheetId),
        entryId,
        active,
      }),
    () => lan.request(RpcMethod.toggleEntry, { sheetId, entryId, active })
  );

export const applyBuiltinEffect = (
  sheetId: string,
  effectId: string,
  magnitude?: number
): Promise<CharacterSheet> =>
  dispatch(
    () =>
      invoke<CharacterSheet>('apply_builtin_effect', {
        path: localPath(sheetId),
        effectId,
        magnitude: magnitude ?? null,
      }),
    () =>
      lan.request(RpcMethod.applyBuiltinEffect, {
        sheetId,
        effectId,
        magnitude: magnitude ?? null,
      })
  );

export const removeActiveEffect = (
  sheetId: string,
  effectId: string
): Promise<CharacterSheet> =>
  dispatch(
    () =>
      invoke<CharacterSheet>('remove_active_effect', {
        path: localPath(sheetId),
        effectId,
      }),
    () => lan.request(RpcMethod.removeActiveEffect, { sheetId, effectId })
  );

export const rollTest = (
  sheetId: string,
  request: TestRequest
): Promise<TestOutcome> =>
  dispatch(
    () =>
      invoke<TestOutcome>('roll_test', { path: localPath(sheetId), request }),
    () => lan.request(RpcMethod.rollTest, { sheetId, request })
  );

/**
 * Free-form dice need no sheet and no campaign directory, so they stay local on
 * every machine. The result reaches the table as a chat message like any other.
 */
export const rollDice = (
  sides: number[],
  secret: boolean
): Promise<RollResult> => invoke<RollResult>('roll_dice', { sides, secret });
