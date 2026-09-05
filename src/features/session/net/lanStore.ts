/**
 * Presence: who is at the table, what they have claimed, and which characters
 * the host is offering.
 *
 * The socket itself lives in `lanConnection`; this store only reflects it into
 * React. Subscriptions are registered once at module load.
 */

import { create } from 'zustand';

import { tokenMotion } from '../../map/tokenMotion';
import { lan, type Identity } from './lanConnection';
import { setLocalBoardSink } from './gameClient';
import type { ConnectionStatus, LanPlayer, SheetSummary } from './protocol';
import { Handout, MapDefinition, MapToken } from '../../../shared/types';

interface LanState {
  status: ConnectionStatus;
  roster: LanPlayer[];
  sheets: SheetSummary[];
  closedReason: string | null;
  handouts: Handout[];
  forcedOpens: { handoutId: string; target: string | null }[];
  maps: MapDefinition[];
  /**
   * The board's *structure*: which pieces exist and how they look. Their live
   * positions are handled by `tokenMotion` instead, because a drag would
   * otherwise re-render this store on every frame.
   */
  tokens: MapToken[];

  connect: (address: string, identity: Identity) => void;
  updateIdentity: (identity: Identity) => void;
  disconnect: () => void;
  claimSheet: (clientId: string, sheetId: string) => void;
  releaseSheet: (clientId: string) => void;
  setSheets: (sheets: SheetSummary[]) => void;
  setHandouts: (handouts: Handout[]) => void;
  setMaps: (maps: MapDefinition[]) => void;
  clearForcedOpen: (handoutId: string) => void;
}

export const useLanStore = create<LanState>()((set) => ({
  status: 'idle',
  roster: [],
  sheets: [],
  handouts: [],
  closedReason: null,
  forcedOpens: [],
  maps: [],
  tokens: [],

  connect: (address, identity) => {
    set({ closedReason: null });
    lan.connect(address, identity);
  },

  updateIdentity: (identity) => lan.updateIdentity(identity),

  disconnect: () => {
    lan.disconnect();
    tokenMotion.clear();
    set({ roster: [], sheets: [], closedReason: null, tokens: [] });
  },

  claimSheet: (clientId, sheetId) => lan.claimSheet(clientId, sheetId),
  releaseSheet: (clientId) => lan.releaseSheet(clientId),
  setSheets: (sheets) => set({ sheets }),
  setHandouts: (handouts) => set({ handouts }),
  setMaps: (maps) => set({ maps }),
  clearForcedOpen: (handoutId) =>
    set((state) => ({
      forcedOpens: state.forcedOpens.filter((f) => f.handoutId !== handoutId),
    })),
}));

lan.on('status', (status) => useLanStore.setState({ status }));

lan.on('roster', (roster) => useLanStore.setState({ roster }));

lan.on('session', (session) => {
  // The host is authoritative about the board, so a (re)joining client adopts
  // its list wholesale rather than trusting whatever this tab remembered.
  tokenMotion.seed(session.tokens ?? []);
  useLanStore.setState({
    sheets: session.sheets,
    roster: session.players,
    handouts: session.handouts,
    maps: session.maps ?? [],
    tokens: session.tokens ?? [],
    closedReason: null,
  });
});

lan.on('maps', (message) => useLanStore.setState({ maps: message.maps }));

lan.on('tokens', (message) => {
  tokenMotion.seed(message.tokens);
  useLanStore.setState({ tokens: message.tokens });
});

// Movement never touches the store: it goes straight to the Konva node.
lan.on('tokenMoved', (message) =>
  tokenMotion.apply(message.tokenId, message.x, message.y, message.dragging)
);

/**
 * With the LAN closed there is no socket to echo board changes back, so the
 * same operations are applied here directly. `gameClient` owns the decision of
 * which path a call takes; this is just the local end of it.
 */
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
      return { tokens: [...others, token].sort((a, b) => a.id.localeCompare(b.id)) };
    }),
  move: (tokenId, x, y, dragging) => tokenMotion.apply(tokenId, x, y, dragging),
  restyle: (tokenId, grayscale, saveIndicator) =>
    useLanStore.setState((state) => ({
      tokens: state.tokens.map((token) =>
        token.id === tokenId
          ? { ...token, grayscale, save_indicator: saveIndicator }
          : token
      ),
    })),
  remove: (tokenId) =>
    useLanStore.setState((state) => ({
      tokens: state.tokens.filter((token) => token.id !== tokenId),
    })),
});

lan.on('handout', (message) => {
  useLanStore.setState((state) => ({
    handouts: state.handouts.map((h) =>
      h.id === message.handout.id ? message.handout : h
    ),
  }));
});

lan.on('handoutForceOpen', (message) => {
  useLanStore.setState((state) => ({
    forcedOpens: [
      ...state.forcedOpens,
      { handoutId: message.handoutId, target: message.target ?? null },
    ],
  }));
});

lan.on('closed', (reason) => useLanStore.setState({ closedReason: reason }));

/**
 * Only players currently connected appear in the avatar row, matching the
 * previous behaviour. Disconnected entries are kept by the host so a
 * reconnecting player recovers their claim instead of losing their character.
 */
export const selectPresentPlayers = (state: LanState) =>
  state.roster.filter((player) => player.connected);

/** The map the table is currently looking at, if any. */
export const selectActiveMap = (state: LanState) =>
  state.maps.find((map) => map.is_active) ?? null;

/** True when someone else currently holds this sheet. */
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
