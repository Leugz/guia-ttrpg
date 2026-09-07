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

/**
 * The one place a `MapToken` is built.
 *
 * Same reasoning as `createChatMessage` in `chatStore`, but it bites harder
 * here: `tokens` is re-read by `GameBoard` on every structural change and each
 * entry is destructured by `TokenNode`. Tokens used to arrive from three
 * sources with three different key orders — `JSON.parse` off the socket,
 * `{ ...token, x, y }` after a local drag, and `{ ...token, grayscale }` after
 * a restyle — so the array held a fresh hidden class per mutation path.
 *
 * Every field is listed in the order `MapToken` declares them, optionals
 * included, so the shape is identical no matter which path produced it.
 */
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

/** Normalize a whole board straight off the wire. */
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

/**
 * Whether this window has an authoritative view of the current game's board:
 * it has either read the file or been handed the board by the host.
 *
 * An empty board is a perfectly legitimate thing to save — the GM is allowed
 * to clear the table — but only once we know the table really is empty. Saving
 * before the read comes back would overwrite the very file we are reading.
 */
let boardLoaded = false;

export const markBoardLoaded = () => {
  boardLoaded = true;
};

/**
 * The board as it stands right now, with live drag positions folded back in,
 * or `null` when this window has not read the current game's board yet.
 *
 * Positions during a drag live in `tokenMotion` rather than in the store, so
 * reading `tokens` alone would save every piece at its last structural
 * position instead of where it actually sits.
 */
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

  // DESCONEXÃO TOTAL: Apaga tudo. Usado apenas quando você volta pro Menu Principal.
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

  // DESCONEXÃO PARCIAL: Apenas desliga a rede. Mapas, Fichas e Miniaturas continuam na mesa.
  disconnectSocketOnly: () => {
    lan.disconnect();
    set({ roster: [], closedReason: null });
  },

  claimSheet: (clientId, sheetId) => lan.claimSheet(clientId, sheetId),
  releaseSheet: (clientId) => lan.releaseSheet(clientId),
  setSheets: (sheets) => set({ sheets }),
  setHandouts: (handouts) => set({ handouts }),
  setMaps: (maps) => set({ maps }),

  // Leaving one table must not carry its pieces into the next one.
  clearBoard: () => {
    boardLoaded = false;
    tokenMotion.clear();
    set({ tokens: [] });
  },
}));

lan.on('status', (status) => useLanStore.setState({ status }));
lan.on('roster', (roster) => useLanStore.setState({ roster }));

lan.on('session', (session) => {
  // The host is authoritative about the board as it is about everything else.
  // It loads this game's `board.json` as it binds the port, so both the GM's
  // own window and a joining player take the same list from the same message.
  //
  // This used to be two branches, with the host wiping the server's board and
  // re-uploading a copy it kept in browser storage. That is what let one
  // table's pieces turn up on another and what made a reconnect stamp on
  // whatever the players had moved in the meantime.
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
  // Ignora o eco do servidor se a ferramenta for sua (pois já foi processada sem lag na sua tela)
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
    // Offline there is no host to echo the final position back, so record it
    // here when the pointer lifts. Without this the saved board has every
    // piece at the spot it was first dropped on.
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
// `handoutForceOpen` is deliberately *not* mirrored into the store. It is an
// instruction, not state: the only correct response is to open a window once,
// and parking it in an array meant whoever consumed it also had to remember to
// drain the queue afterwards. `HandoutWindowManager` subscribes to the event
// directly instead.
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
