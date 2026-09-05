/**
 * Presence: who is at the table, what they have claimed, and which characters
 * the host is offering.
 *
 * The socket itself lives in `lanConnection`; this store only reflects it into
 * React. Subscriptions are registered once at module load.
 */

import { create } from 'zustand';

import { lan, type Identity } from './lanConnection';
import type { ConnectionStatus, LanPlayer, SheetSummary } from './protocol';
import { Handout } from '../../../shared/types';

interface LanState {
  status: ConnectionStatus;
  roster: LanPlayer[];
  sheets: SheetSummary[];
  closedReason: string | null;
  handouts: Handout[];

  connect: (address: string, identity: Identity) => void;
  updateIdentity: (identity: Identity) => void;
  disconnect: () => void;
  claimSheet: (clientId: string, sheetId: string) => void;
  releaseSheet: (clientId: string) => void;
  setSheets: (sheets: SheetSummary[]) => void;
  setHandouts: (handouts: Handout[]) => void;
}

export const useLanStore = create<LanState>()((set) => ({
  status: 'idle',
  roster: [],
  sheets: [],
  handouts: [],
  closedReason: null,

  connect: (address, identity) => {
    set({ closedReason: null });
    lan.connect(address, identity);
  },

  updateIdentity: (identity) => lan.updateIdentity(identity),

  disconnect: () => {
    lan.disconnect();
    set({ roster: [], sheets: [], closedReason: null });
  },

  claimSheet: (clientId, sheetId) => lan.claimSheet(clientId, sheetId),
  releaseSheet: (clientId) => lan.releaseSheet(clientId),
  setSheets: (sheets) => set({ sheets }),
  setHandouts: (handouts) => set({ handouts }),
}));

lan.on('status', (status) => useLanStore.setState({ status }));

lan.on('roster', (roster) => useLanStore.setState({ roster }));

lan.on('session', (session) => {
  useLanStore.setState({
    sheets: session.sheets,
    roster: session.players,
    handouts: session.handouts,
    closedReason: null,
  });
});

lan.on('handout', (message) => {
  useLanStore.setState((state) => ({
    handouts: state.handouts.map((h) =>
      h.id === message.handout.id ? message.handout : h
    ),
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
