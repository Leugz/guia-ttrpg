import { create } from 'zustand';
import { tokenMotion } from '../../map/tokenMotion';
import { lan, type Identity } from './lanConnection';
import { setLocalBoardSink } from './gameClient';
import type { ConnectionStatus, LanPlayer, SheetSummary } from './protocol';
import {
  Handout,
  MapDefinition,
  MapToken,
  SaveIndicator,
} from '../../../shared/types';
import { useSessionStore } from '../sessionStore';

const createToken = (
  source: MapToken,
  overrides?: {
    x?: number;
    y?: number;
    grayscale?: boolean;
    saveIndicator?: SaveIndicator | null;
  }
): MapToken => ({
  id: source.id,
  map_id: source.map_id,
  owner_client_id: source.owner_client_id,
  sheet_id: source.sheet_id ?? null,
  label: source.label,
  color: source.color,
  x: overrides?.x ?? source.x,
  y: overrides?.y ?? source.y,
  grayscale: overrides?.grayscale ?? source.grayscale,
  save_indicator:
    overrides?.saveIndicator !== undefined
      ? overrides.saveIndicator
      : (source.save_indicator ?? null),
});

const createTokens = (tokens: MapToken[]): MapToken[] =>
  tokens.map((token) => createToken(token));

interface LanState {
  status: ConnectionStatus;
  roster: LanPlayer[];
  sheets: SheetSummary[];
  closedReason: string | null;
  handouts: Handout[];
  maps: MapDefinition[];
  tokens: MapToken[];
  pings: { id: string; x: number; y: number; color: string }[];
  rulers: Record<
    string,
    {
      start_x: number;
      start_y: number;
      end_x: number;
      end_y: number;
      color: string;
    }
  >;
  connect: (address: string, identity: Identity) => void;
  updateIdentity: (identity: Identity) => void;
  disconnect: () => void;
  disconnectSocketOnly: () => void;
  claimSheet: (clientId: string, sheetId: string) => void;
  releaseSheet: (clientId: string) => void;
  setSheets: (sheets: SheetSummary[]) => void;
  setHandouts: (handouts: Handout[]) => void;
  setMaps: (maps: MapDefinition[]) => void;
  clearBoard: () => void;
}

let boardLoaded = false;

export const markBoardLoaded = () => {
  boardLoaded = true;
};

export const snapshotBoard = (): MapToken[] | null => {
  if (!boardLoaded) return null;
  return useLanStore.getState().tokens.map((token) => {
    const position = tokenMotion.position(token.id);
    return position
      ? createToken(token, { x: position.x, y: position.y })
      : token;
  });
};

export const useLanStore = create<LanState>()((set) => ({
  status: 'idle',
  roster: [],
  sheets: [],
  handouts: [],
  closedReason: null,
  maps: [],
  tokens: [],
  pings: [],
  rulers: {},
  connect: (address, identity) => {
    set({ closedReason: null });
    lan.connect(address, identity);
  },
  updateIdentity: (identity) => lan.updateIdentity(identity),

  disconnect: () => {
    lan.disconnect();
    tokenMotion.clear();
    set({
      roster: [],
      sheets: [],
      closedReason: null,
      tokens: [],
      maps: [],
      handouts: [],
      pings: [],
      rulers: {},
    });
  },

  disconnectSocketOnly: () => {
    lan.disconnect();
    set({ roster: [], closedReason: null });
  },

  claimSheet: (clientId, sheetId) => lan.claimSheet(clientId, sheetId),
  releaseSheet: (clientId) => lan.releaseSheet(clientId),
  setSheets: (sheets) => set({ sheets }),
  setHandouts: (handouts) => set({ handouts }),
  setMaps: (maps) => set({ maps }),

  clearBoard: () => {
    boardLoaded = false;
    tokenMotion.clear();
    set({ tokens: [] });
  },
}));

lan.on('status', (status) => useLanStore.setState({ status }));
lan.on('roster', (roster) => useLanStore.setState({ roster }));

lan.on('session', (session) => {
  const nextTokens = createTokens(session.tokens ?? []);
  tokenMotion.seed(nextTokens);
  markBoardLoaded();

  useLanStore.setState({
    sheets: session.sheets,
    roster: session.players,
    handouts: session.handouts,
    maps: session.maps ?? [],
    tokens: nextTokens,
    closedReason: null,
  });
});

lan.on('maps', (message) => useLanStore.setState({ maps: message.maps }));
lan.on('tokens', (message) => {
  const tokens = createTokens(message.tokens);
  tokenMotion.seed(tokens);
  useLanStore.setState({ tokens });
});
lan.on('tokenMoved', (message) =>
  tokenMotion.apply(message.tokenId, message.x, message.y, message.dragging)
);

const processToolEvent = (clientId: string, payload: any) => {
  if (payload.action === 'ping') {
    const id = Date.now().toString() + Math.random();
    useLanStore.setState((state) => ({
      pings: [
        ...state.pings,
        { id, x: payload.x, y: payload.y, color: payload.color },
      ],
    }));
    setTimeout(() => {
      useLanStore.setState((state) => ({
        pings: state.pings.filter((p) => p.id !== id),
      }));
    }, 1500);
  } else if (payload.action === 'ruler') {
    useLanStore.setState((state) => ({
      rulers: { ...state.rulers, [clientId]: payload },
    }));
  } else if (payload.action === 'ruler_clear') {
    useLanStore.setState((state) => {
      const next = { ...state.rulers };
      delete next[clientId];
      return { rulers: next };
    });
  }
};

lan.on('tool', (message) => {
  if (message.clientId === useSessionStore.getState().clientId) return;
  processToolEvent(message.clientId, message.payload);
});

setLocalBoardSink({
  place: (token) =>
    useLanStore.setState((state) => {
      tokenMotion.set(token.id, token.x, token.y);
      const others = state.tokens.filter(
        (existing) =>
          existing.id !== token.id &&
          !(
            existing.owner_client_id === token.owner_client_id &&
            existing.map_id === token.map_id &&
            existing.sheet_id === token.sheet_id
          )
      );
      return {
        tokens: [...others, createToken(token)].sort((a, b) =>
          a.id.localeCompare(b.id)
        ),
      };
    }),
  move: (tokenId, x, y, dragging) => {
    tokenMotion.apply(tokenId, x, y, dragging);
    if (!dragging) {
      useLanStore.setState((state) => ({
        tokens: state.tokens.map((token) =>
          token.id === tokenId ? createToken(token, { x, y }) : token
        ),
      }));
    }
  },
  restyle: (tokenId, grayscale, saveIndicator) =>
    useLanStore.setState((state) => ({
      tokens: state.tokens.map((token) =>
        token.id === tokenId
          ? createToken(token, { grayscale, saveIndicator })
          : token
      ),
    })),
  remove: (tokenId) =>
    useLanStore.setState((state) => ({
      tokens: state.tokens.filter((token) => token.id !== tokenId),
    })),
  tool: processToolEvent,
});

lan.on('handout', (message) => {
  useLanStore.setState((state) => ({
    handouts: state.handouts.map((h) =>
      h.id === message.handout.id ? message.handout : h
    ),
  }));
});
lan.on('closed', (reason) => useLanStore.setState({ closedReason: reason }));

export const selectPresentPlayers = (state: LanState) =>
  state.roster.filter((player) => player.connected);
export const selectActiveMap = (state: LanState) =>
  state.maps.find((map) => map.is_active) ?? null;
export const isSheetTaken = (
  roster: LanPlayer[],
  sheetId: string,
  selfClientId: string
) =>
  roster.some(
    (player) =>
      player.client_id !== selfClientId &&
      player.connected &&
      player.claimed_sheet === sheetId
  );
