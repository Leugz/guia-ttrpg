import type {
  CharacterSheet,
  DeathSaveOutcome,
  Handout,
  MapDefinition,
  MapToken,
  ParsedDocument,
  ResolvedPool,
  ResourceOutcome,
  RollResult,
  SaveIndicator,
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

// Add the payload type
export type JukeboxPayload =
  | { action: 'play'; track_url: string; looped: boolean }
  | { action: 'pause' }
  | { action: 'resume' }
  | { action: 'stop' };

// Add to your ServerMessage union type:
export interface JukeboxSyncMessage {
  type: 'jukebox_sync';
  payload: JukeboxPayload;
}

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
  handouts: Handout[];
  maps: MapDefinition[];
  tokens: MapToken[];
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

export interface HandoutUpdateMessage {
  type: 'handout_update';
  handout: Handout;
}

export interface HandoutForceOpenMessage {
  type: 'handout_force_open';
  handoutId: string;
  target: string | null;
}

/** The map list changed — in practice, the GM revealed a different map. */
export interface MapsUpdateMessage {
  type: 'maps_update';
  maps: MapDefinition[];
}

/** The full board, sent on join and after any structural change. */
export interface TokensSyncMessage {
  type: 'tokens_sync';
  tokens: MapToken[];
}

/**
 * One token moved. The smallest message on the wire, because it is sent on
 * every animation frame of a drag.
 */
export interface TokenMovedMessage {
  type: 'token_moved';
  tokenId: string;
  x: number;
  y: number;
  dragging: boolean;
}

export type ServerMessage =
  | RosterSyncMessage
  | SessionStateMessage
  | SheetUpdateMessage
  | RpcResultMessage
  | SessionClosedMessage
  | HandoutUpdateMessage
  | HandoutForceOpenMessage
  | MapsUpdateMessage
  | TokensSyncMessage
  | TokenMovedMessage
  | ToolSyncMessage
  | JukeboxSyncMessage;

// --- Client -> Server: board traffic ---------------------------------------
//
// Token operations are fire-and-forget broadcasts rather than RPCs. A drag
// produces one message per frame, and waiting for a response on each would
// both add latency and pointlessly burn request ids.

export interface TokenPlaceMessage {
  type: 'token_place';
  clientId: string;
  token: MapToken;
}

export interface TokenMoveMessage {
  type: 'token_move';
  clientId: string;
  tokenId: string;
  x: number;
  y: number;
  dragging: boolean;
}

export interface TokenStateMessage {
  type: 'token_state';
  clientId: string;
  tokenId: string;
  grayscale: boolean;
  save_indicator: SaveIndicator | null;
}

export interface TokenRemoveMessage {
  type: 'token_remove';
  clientId: string;
  tokenId: string;
}

export type ToolPayload =
  | { action: 'ping'; x: number; y: number; color: string }
  | {
      action: 'ruler';
      start_x: number;
      start_y: number;
      end_x: number;
      end_y: number;
      color: string;
    }
  | { action: 'ruler_clear' };

export interface ToolClientMessage {
  type: 'tool';
  clientId: string;
  payload: ToolPayload;
}

export interface ToolSyncMessage {
  type: 'tool_sync';
  clientId: string;
  payload: ToolPayload;
}

export type TokenClientMessage =
  TokenPlaceMessage | TokenMoveMessage | TokenStateMessage | TokenRemoveMessage;

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
  rollDice: 'roll_dice',
  toggleHandoutPublic: 'toggle_handout_public',
  toggleHandoutShare: 'toggle_handout_share',
  openHandoutForAll: 'open_handout_for_all',
  openHandoutForPlayer: 'open_handout_for_player',
  getHandoutAsset: 'get_handout_asset',
  listMaps: 'list_maps',
  setActiveMap: 'set_active_map',
  getMapAsset: 'get_map_asset',
  getSheetPortrait: 'get_sheet_portrait',
  getSheetTokenImage: 'get_sheet_token_image',
} as const;

export type RpcMethodName = (typeof RpcMethod)[keyof typeof RpcMethod];

/** The raw bytes of an image handout, ready to become a `data:` URL. */
export interface HandoutAsset {
  mimeType: string;
  dataBase64: string;
}

/** Same shape, for map images and character portraits. */
export type AssetPayload = HandoutAsset;

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
  [RpcMethod.rollDice]: RollResult;
  [RpcMethod.toggleHandoutPublic]: Handout;
  [RpcMethod.toggleHandoutShare]: Handout;
  [RpcMethod.openHandoutForAll]: Handout;
  [RpcMethod.openHandoutForPlayer]: Handout;
  [RpcMethod.getHandoutAsset]: HandoutAsset;
  [RpcMethod.listMaps]: MapDefinition[];
  [RpcMethod.setActiveMap]: MapDefinition[];
  [RpcMethod.getMapAsset]: AssetPayload;
  [RpcMethod.getSheetPortrait]: AssetPayload;
  [RpcMethod.getSheetTokenImage]: AssetPayload;
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
