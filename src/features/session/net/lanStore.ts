import { create } from 'zustand';
import { tokenMotion } from '../../map/tokenMotion';
import { lan, type Identity } from './lanConnection';
import { setLocalBoardSink, getGameContext } from './gameClient';
import type { ConnectionStatus, LanPlayer, SheetSummary } from './protocol';
import { Handout, MapDefinition, MapToken } from '../../../shared/types';
import { useSessionStore } from '../sessionStore';

interface LanState {
  status: ConnectionStatus;
  roster: LanPlayer[];
  sheets: SheetSummary[];
  closedReason: string | null;
  handouts: Handout[];
  forcedOpens: { handoutId: string; target: string | null }[];
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
  clearForcedOpen: (handoutId) =>
    set((state) => ({
      forcedOpens: state.forcedOpens.filter((f) => f.handoutId !== handoutId),
    })),
}));

lan.on('status', (status) => useLanStore.setState({ status }));
lan.on('roster', (roster) => useLanStore.setState({ roster }));

lan.on('session', (session) => {
  const isHost = getGameContext().mode === 'host';

  if (isHost) {
    // A lógica exata que você pediu: Carrega os dados isolados DA MESA ATUAL.
    const activeGameId = useSessionStore.getState().activeGameId;
    const saved = localStorage.getItem(`guia-board-${activeGameId}`);
    const tableData: MapToken[] = saved ? JSON.parse(saved) : [];

    // 1. Limpa a RAM do servidor (destrói tokens de mesas anteriores)
    session.tokens?.forEach((serverToken) => {
      lan.sendToken({
        type: 'token_remove',
        clientId: 'host',
        tokenId: serverToken.id,
      });
    });

    // 2. Faz o upload dos dados corretos desta Mesa para a rede
    tableData.forEach((token) => {
      lan.sendToken({ type: 'token_place', clientId: 'host', token });
    });

    // 3. Aplica os dados da mesa na interface
    tokenMotion.seed(tableData);

    useLanStore.setState({
      sheets: session.sheets,
      roster: session.players,
      handouts: session.handouts,
      maps: session.maps ?? [],
      tokens: tableData,
      closedReason: null,
    });
  } else {
    // Jogadores convidados apenas recebem a mesa pronta que o mestre acabou de injetar
    const nextTokens = session.tokens ?? [];
    tokenMotion.seed(nextTokens);

    useLanStore.setState({
      sheets: session.sheets,
      roster: session.players,
      handouts: session.handouts,
      maps: session.maps ?? [],
      tokens: nextTokens,
      closedReason: null,
    });
  }
});

lan.on('maps', (message) => useLanStore.setState({ maps: message.maps }));
lan.on('tokens', (message) => {
  tokenMotion.seed(message.tokens);
  useLanStore.setState({ tokens: message.tokens });
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
        tokens: [...others, token].sort((a, b) => a.id.localeCompare(b.id)),
      };
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
  tool: processToolEvent,
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
