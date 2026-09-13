import { create } from 'zustand';

import { lan } from '../session/net/lanConnection';
import type { CurtainState } from '../session/net/protocol';
import { useSessionStore } from '../session/sessionStore';

interface CurtainStoreState {
  /** Null whenever the table can see the board. */
  curtain: CurtainState | null;
  /** The GM's last choices, reused when V toggles the curtain back on. */
  lastGifUrl: string | null;
  lastDuration: number | null;

  raise: (options?: {
    gifUrl?: string | null;
    label?: string | null;
    duration?: number | null;
  }) => void;
  lower: () => void;
  toggle: () => void;
  remember: (gifUrl: string | null, duration: number | null) => void;
  applyRemote: (curtain: CurtainState | null) => void;
}

/** Host-authoritative when a table is open; local-only when playing offline. */
const broadcast = (
  payload: Parameters<typeof lan.sendCurtain>[0]['payload']
) => {
  const { clientId } = useSessionStore.getState();
  if (lan.isOpen()) {
    lan.sendCurtain({ type: 'curtain', clientId, payload });
    return false;
  }
  return true;
};

export const useCurtainStore = create<CurtainStoreState>()((set, get) => ({
  curtain: null,
  lastGifUrl: null,
  lastDuration: null,

  raise: (options = {}) => {
    const gifUrl =
      options.gifUrl !== undefined ? options.gifUrl : get().lastGifUrl;
    const duration =
      options.duration !== undefined ? options.duration : get().lastDuration;
    const label = options.label ?? null;

    const local = broadcast({
      action: 'raise',
      gif_url: gifUrl ?? null,
      label,
      duration: duration && duration > 0 ? duration : null,
    });

    set({ lastGifUrl: gifUrl ?? null, lastDuration: duration ?? null });

    if (local) {
      set({
        curtain: {
          gif_url: gifUrl ?? null,
          label,
          started_at: Date.now(),
          duration: duration && duration > 0 ? duration : null,
        },
      });
    }
  },

  lower: () => {
    if (broadcast({ action: 'lower' })) set({ curtain: null });
  },

  toggle: () => {
    if (get().curtain) get().lower();
    else get().raise();
  },

  remember: (gifUrl, duration) =>
    set({ lastGifUrl: gifUrl, lastDuration: duration }),

  applyRemote: (curtain) => set({ curtain }),
}));

lan.on('curtain', (message) =>
  useCurtainStore.getState().applyRemote(message.state ?? null)
);

lan.on('session', (session) =>
  useCurtainStore.getState().applyRemote(session.curtain ?? null)
);
