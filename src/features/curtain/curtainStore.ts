import { create } from 'zustand';
import { lan } from '../session/net/lanConnection';
import type { CurtainState } from '../session/net/protocol';
import { useSessionStore } from '../session/sessionStore';
import { useJukeboxStore } from '../jukebox/jukeboxStore';

const normalize = (curtain: CurtainState | null): CurtainState | null =>
  curtain
    ? { ...curtain, clip_url: curtain.clip_url ?? curtain.gif_url ?? null }
    : null;

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

export interface CurtainStoreState {
  curtain: CurtainState | null;
  lastClipUrl: string | null;
  lastDuration: number | null;
  raise: (options?: {
    clipUrl?: string | null;
    label?: string | null;
    duration?: number | null;
    preserve_timer?: boolean;
  }) => void;
  lower: () => void;
  toggle: () => void;
  remember: (clipUrl: string | null, duration: number | null) => void;
  applyRemote: (curtain: CurtainState | null) => void;
}

export const useCurtainStore = create<CurtainStoreState>()((set, get) => ({
  curtain: null,
  lastClipUrl: null,
  lastDuration: null,
  raise: (options = {}) => {
    const clipUrl =
      options.clipUrl !== undefined ? options.clipUrl : get().lastClipUrl;
    const duration =
      options.duration !== undefined ? options.duration : get().lastDuration;
    const label = options.label ?? null;
    const preserve_timer = options.preserve_timer ?? false;

    const local = broadcast({
      action: 'raise',
      clip_url: clipUrl ?? null,
      label,
      duration: duration && duration > 0 ? duration : null,
      preserve_timer,
    });

    set({ lastClipUrl: clipUrl ?? null, lastDuration: duration ?? null });

    if (local) {
      set((state) => ({
        curtain: {
          clip_url: clipUrl ?? null,
          label,
          started_at:
            preserve_timer && state.curtain
              ? state.curtain.started_at
              : Date.now(),
          duration: duration && duration > 0 ? duration : null,
        },
      }));
    }
  },
  lower: () => {
    if (broadcast({ action: 'lower' })) set({ curtain: null });
    useJukeboxStore.getState().stop();
  },
  toggle: () => {
    if (get().curtain) get().lower();
    else get().raise();
  },
  remember: (clipUrl, duration) =>
    set({ lastClipUrl: clipUrl, lastDuration: duration }),
  applyRemote: (curtain) => set({ curtain: normalize(curtain) }),
}));
