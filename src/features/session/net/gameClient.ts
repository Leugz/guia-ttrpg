import { convertFileSrc, invoke } from '@tauri-apps/api/core';

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
import { lan } from './lanConnection';
import { RpcMethod, ToolPayload, type SheetSummary } from './protocol';

export type GameMode = 'offline' | 'host' | 'client';

interface GameContext {
  mode: GameMode;
  gameRoot: string | null;
}

let context: GameContext = { mode: 'offline', gameRoot: null };

export const setGameContext = (next: GameContext) => {
  context = next;
};

export const getGameContext = (): GameContext => context;

export const isHostingGame = () => context.mode === 'host';

const localPath = (sheetId: string): string => {
  if (!context.gameRoot) {
    throw new Error('Nenhuma mesa está aberta nesta máquina.');
  }
  return `${context.gameRoot}/${sheetId}`;
};

const dispatch = async <T>(
  local: () => Promise<T>,
  remote: () => Promise<T>
): Promise<T> => {
  if (context.mode === 'host') return local();
  if (context.mode === 'client') return remote();
  throw new Error('Você não está em uma sessão.');
};

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

export const rollDice = (
  sides: number[],
  secret: boolean
): Promise<RollResult> =>
  dispatch(
    () => invoke<RollResult>('roll_dice', { sides, secret }),
    () => lan.request(RpcMethod.rollDice, { sides, secret })
  );

export const toggleHandoutPublic = (handoutId: string): Promise<Handout> =>
  dispatch(
    () =>
      invoke<Handout>('toggle_handout_public', {
        gameRoot: getGameContext().gameRoot,
        handoutId,
      }),
    () => lan.request(RpcMethod.toggleHandoutPublic, { handoutId })
  );

export const toggleHandoutShare = (
  handoutId: string,
  targetClientId: string
): Promise<Handout> =>
  dispatch(
    () =>
      invoke<Handout>('toggle_handout_share', {
        gameRoot: getGameContext().gameRoot,
        handoutId,
        targetClientId,
      }),
    () =>
      lan.request(RpcMethod.toggleHandoutShare, { handoutId, targetClientId })
  );

export const listHandouts = (): Promise<Handout[]> =>
  dispatch(
    () =>
      invoke<Handout[]>('list_game_handouts', {
        gamePath: getGameContext().gameRoot,
      }),
    () => Promise.resolve([])
  );

export const openHandoutForAll = (handoutId: string): Promise<Handout> =>
  dispatch(
    () =>
      invoke<Handout>('open_handout_for_all', {
        gameRoot: getGameContext().gameRoot,
        handoutId,
      }),
    () => lan.request(RpcMethod.openHandoutForAll, { handoutId })
  );

export const openHandoutForPlayer = (
  handoutId: string,
  targetClientId: string
): Promise<Handout> =>
  dispatch(
    () =>
      invoke<Handout>('open_handout_for_player', {
        gameRoot: getGameContext().gameRoot,
        handoutId,
        targetClientId,
      }),
    () =>
      lan.request(RpcMethod.openHandoutForPlayer, { handoutId, targetClientId })
  );

export const getHandoutAssetUrl = (
  handout: Pick<Handout, 'id' | 'content'>
): Promise<string> =>
  dispatch(
    () => Promise.resolve(convertFileSrc(localPath(handout.content))),
    () =>
      lan
        .request(RpcMethod.getHandoutAsset, { handoutId: handout.id })
        .then((asset) => `data:${asset.mimeType};base64,${asset.dataBase64}`)
  );

export const listMaps = (): Promise<MapDefinition[]> =>
  dispatch(
    () =>
      invoke<MapDefinition[]>('list_game_maps', {
        gamePath: context.gameRoot,
      }),
    () => lan.request(RpcMethod.listMaps)
  );

export const setActiveMap = (mapId: string): Promise<MapDefinition[]> =>
  dispatch(
    () =>
      invoke<MapDefinition[]>('set_active_map', {
        gameRoot: context.gameRoot,
        mapId,
      }),
    () => lan.request(RpcMethod.setActiveMap, { mapId })
  );

export const getMapImageUrl = (map: MapDefinition): Promise<string> =>
  dispatch(
    () => Promise.resolve(convertFileSrc(localPath(map.image))),
    () =>
      lan
        .request(RpcMethod.getMapAsset, { mapId: map.id })
        .then((asset) => `data:${asset.mimeType};base64,${asset.dataBase64}`)
  );

export const getPortraitUrl = (sheetId: string): Promise<string> =>
  dispatch(
    async () => {
      if (sheetId === '__GM__') {
        return convertFileSrc(`${context.gameRoot}/assets/portraits/gm.png`);
      }
      const document = await invoke<ParsedDocument>('load_character_sheet', {
        path: localPath(sheetId),
      });
      const portrait = document.data.portrait;
      if (!portrait) throw new Error(`A ficha "${sheetId}" não tem retrato.`);
      return convertFileSrc(localPath(portrait));
    },
    () =>
      lan
        .request(RpcMethod.getSheetPortrait, { sheetId })
        .then((asset) => `data:${asset.mimeType};base64,${asset.dataBase64}`)
  );

export const getTokenImageUrl = (sheetId: string): Promise<string> =>
  dispatch(
    async () => {
      if (sheetId === '__GM__') {
        return convertFileSrc(
          `${context.gameRoot}/assets/portraits/gm_token.png`
        );
      }
      const document = await invoke<ParsedDocument>('load_character_sheet', {
        path: localPath(sheetId),
      });
      const assetPath = document.data.token_image || document.data.portrait;
      if (!assetPath)
        throw new Error(`A ficha "${sheetId}" não tem imagem de token.`);
      return convertFileSrc(localPath(assetPath));
    },
    () =>
      lan
        .request(RpcMethod.getSheetTokenImage, { sheetId })
        .then((asset) => `data:${asset.mimeType};base64,${asset.dataBase64}`)
  );

export const loadBoard = (): Promise<MapToken[]> => {
  if (context.mode !== 'host' || !context.gameRoot) return Promise.resolve([]);
  return invoke<MapToken[]>('load_board', { gamePath: context.gameRoot });
};

export const saveBoard = (
  tokens: MapToken[],
  gameRoot: string | null = context.gameRoot
): Promise<void> => {
  if (!gameRoot) return Promise.resolve();
  return invoke('save_board', { gamePath: gameRoot, tokens });
};

export interface LocalBoardSink {
  place: (token: MapToken) => void;
  move: (tokenId: string, x: number, y: number, dragging: boolean) => void;
  restyle: (
    tokenId: string,
    grayscale: boolean,
    saveIndicator: SaveIndicator | null
  ) => void;
  remove: (tokenId: string) => void;
  tool: (clientId: string, payload: ToolPayload) => void;
}

let localBoard: LocalBoardSink | null = null;

export const setLocalBoardSink = (sink: LocalBoardSink) => {
  localBoard = sink;
};

const boardIsNetworked = () => lan.isOpen();

export const placeToken = (clientId: string, token: MapToken) => {
  if (boardIsNetworked()) {
    lan.sendToken({ type: 'token_place', clientId, token });
    return;
  }
  localBoard?.place(token);
};

export const moveToken = (
  clientId: string,
  tokenId: string,
  x: number,
  y: number,
  dragging: boolean
) => {
  if (boardIsNetworked()) {
    lan.sendToken({ type: 'token_move', clientId, tokenId, x, y, dragging });
    return;
  }
  localBoard?.move(tokenId, x, y, dragging);
};

export const setTokenState = (
  clientId: string,
  tokenId: string,
  grayscale: boolean,
  saveIndicator: SaveIndicator | null
) => {
  if (boardIsNetworked()) {
    lan.sendToken({
      type: 'token_state',
      clientId,
      tokenId,
      grayscale,
      save_indicator: saveIndicator,
    });
    return;
  }
  localBoard?.restyle(tokenId, grayscale, saveIndicator);
};

export const removeToken = (clientId: string, tokenId: string) => {
  if (boardIsNetworked()) {
    lan.sendToken({ type: 'token_remove', clientId, tokenId });
    return;
  }
  localBoard?.remove(tokenId);
};

export const sendToolEvent = (clientId: string, payload: ToolPayload) => {
  localBoard?.tool(clientId, payload);

  if (boardIsNetworked()) {
    lan.sendTool({ type: 'tool', clientId, payload });
  }
};

export const rerollDie = (
  result: RollResult,
  index: number
): Promise<RollResult> =>
  dispatch(
    () => invoke<RollResult>('reroll_die', { result, index }),
    () => lan.request(RpcMethod.rerollDie, { result, index })
  );
