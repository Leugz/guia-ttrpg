/**
 * The wire contract with the host, mirroring `src-tauri/src/network/protocol.rs`.
 * Change one, change the other.
 */

import type {
  CharacterSheet,
  DeathSaveOutcome,
  ParsedDocument,
  ResolvedPool,
  ResourceOutcome,
  TestOutcome,
  TestRequest,
} from '../../../shared/types';

export const LAN_PORT = 37373;

export interface LanPlayer {
  client_id: string;
  username: string;
  claimed_sheet: string | null;
  color: string;
  connected: boolean;
  is_gm: boolean;
}

/** A character file the host is offering, addressed by its file name. */
export interface SheetSummary {
  id: string;
  name: string;
  profile: string;
  occupation: string;
  level: number;
}

export type ConnectionStatus =
  'idle' | 'connecting' | 'online' | 'reconnecting' | 'offline';

// --- Server -> Client -------------------------------------------------------

export interface RosterSyncMessage {
  type: 'roster_sync';
  players: LanPlayer[];
}

export interface SessionStateMessage {
  type: 'session_state';
  sheets: SheetSummary[];
  history: unknown[];
  players: LanPlayer[];
  gameId: string;
}

export interface SheetUpdateMessage {
  type: 'sheet_update';
  sheetId: string;
  sheet: CharacterSheet;
}

export interface RpcResultMessage {
  type: 'rpc_result';
  requestId: string;
  ok: boolean;
  data?: unknown;
  error?: string;
}

export interface SessionClosedMessage {
  type: 'session_closed';
  reason: string;
}

export type ServerMessage =
  | RosterSyncMessage
  | SessionStateMessage
  | SheetUpdateMessage
  | RpcResultMessage
  | SessionClosedMessage;

// --- RPC --------------------------------------------------------------------

/**
 * Method names understood by the host. Typed as a const map so a typo is a
 * compile error rather than an "unknown method" at the table.
 */
export const RpcMethod = {
  listSheets: 'list_sheets',
  loadSheet: 'load_sheet',
  applyResourceChange: 'apply_resource_change',
  rollDeathSave: 'roll_death_save',
  stepAttribute: 'step_attribute',
  stepSkill: 'step_skill',
  toggleEntry: 'toggle_entry',
  applyBuiltinEffect: 'apply_builtin_effect',
  removeActiveEffect: 'remove_active_effect',
  previewTest: 'preview_test',
  rollTest: 'roll_test',
  describeEntry: 'describe_entry',
  grantSheetAccess: 'grant_sheet_access',
  revokeSheetAccess: 'revoke_sheet_access',
} as const;

export type RpcMethodName = (typeof RpcMethod)[keyof typeof RpcMethod];

/** Maps each method to the shape the host answers with. */
export interface RpcResults {
  [RpcMethod.listSheets]: SheetSummary[];
  [RpcMethod.loadSheet]: ParsedDocument;
  [RpcMethod.applyResourceChange]: ResourceOutcome;
  [RpcMethod.rollDeathSave]: DeathSaveOutcome;
  [RpcMethod.stepAttribute]: CharacterSheet;
  [RpcMethod.stepSkill]: CharacterSheet;
  [RpcMethod.toggleEntry]: CharacterSheet;
  [RpcMethod.applyBuiltinEffect]: CharacterSheet;
  [RpcMethod.removeActiveEffect]: CharacterSheet;
  [RpcMethod.previewTest]: ResolvedPool;
  [RpcMethod.rollTest]: TestOutcome;
  [RpcMethod.describeEntry]: unknown;
  [RpcMethod.grantSheetAccess]: CharacterSheet;
  [RpcMethod.revokeSheetAccess]: CharacterSheet;
}

export interface TestRpcParams {
  sheetId: string;
  request: TestRequest;
}

export const buildWsUrl = (address: string) => {
  const trimmed = address.trim();
  // Accept both "192.168.1.10" and "192.168.1.10:37373" so a player can paste
  // whatever the GM sent them.
  const hasPort = /:\d+$/.test(trimmed);
  return `ws://${hasPort ? trimmed : `${trimmed}:${LAN_PORT}`}/ws`;
};
