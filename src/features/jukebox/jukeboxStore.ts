import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { lan } from '../session/net/lanConnection';
import type { JukeboxPayload } from '../session/net/protocol';
import { useSessionStore } from '../session/sessionStore';
import { jukeboxAudioEngine } from './lib/jukeboxAudioEngine';

const DEFAULT_VOLUME = 0.5;

interface JukeboxState {
  currentTrack: string | null;
  isPlaying: boolean;
  isLooped: boolean;
  localVolume: number;
  setLocalVolume: (volume: number) => void;
  play: (trackUrl: string) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  seek: (position: number) => void;
  setLoop: (looped: boolean) => void;
}

const executeJukeboxCommand = (payload: JukeboxPayload) => {
  const store = useJukeboxStore.getState();

  switch (payload.action) {
    case 'play':
      useJukeboxStore.setState({
        currentTrack: payload.track_url,
        isPlaying: true,
        isLooped: payload.looped,
      });
      jukeboxAudioEngine.play(payload.track_url, payload.looped);
      return;
    case 'pause':
      if (!store.currentTrack) return;
      useJukeboxStore.setState({ isPlaying: false });
      jukeboxAudioEngine.pause();
      return;
    case 'resume':
      if (!store.currentTrack) return;
      useJukeboxStore.setState({ isPlaying: true });
      jukeboxAudioEngine.resume();
      return;
    case 'stop':
      useJukeboxStore.setState({ currentTrack: null, isPlaying: false });
      jukeboxAudioEngine.stop();
      return;
    case 'seek':
      if (!store.currentTrack) return;
      jukeboxAudioEngine.seek(payload.position);
      return;
    case 'set_loop':
      useJukeboxStore.setState({ isLooped: payload.looped });
      jukeboxAudioEngine.setLoop(payload.looped);
  }
};

const dispatchJukeboxCommand = (payload: JukeboxPayload) => {
  const { clientId, isLanOpen, isHosting } = useSessionStore.getState();

  if (isLanOpen) {
    lan.send({
      type: 'jukebox',
      clientId,
      payload,
    });
    return;
  }

  if (isHosting) executeJukeboxCommand(payload);
};

export const useJukeboxStore = create<JukeboxState>()(
  persist(
    (set, get) => ({
      currentTrack: null,
      isPlaying: false,
      isLooped: true,
      localVolume: DEFAULT_VOLUME,

      setLocalVolume: (volume) => {
        const nextVolume = Number.isFinite(volume)
          ? Math.min(1, Math.max(0, volume))
          : DEFAULT_VOLUME;
        set({ localVolume: nextVolume });
        jukeboxAudioEngine.setVolume(nextVolume);
      },

      play: (trackUrl) => {
        dispatchJukeboxCommand({
          action: 'play',
          track_url: trackUrl,
          looped: get().isLooped,
        });
      },

      pause: () => dispatchJukeboxCommand({ action: 'pause' }),
      resume: () => dispatchJukeboxCommand({ action: 'resume' }),
      stop: () => dispatchJukeboxCommand({ action: 'stop' }),
      seek: (position) => dispatchJukeboxCommand({ action: 'seek', position }),
      setLoop: (looped) => {
        set({ isLooped: looped });
        dispatchJukeboxCommand({ action: 'set_loop', looped });
      },
    }),
    {
      name: 'guia-jukebox-settings',
      partialize: (state) => ({ localVolume: state.localVolume }),
      onRehydrateStorage: () => (state) => {
        if (state) state.setLocalVolume(state.localVolume);
      },
    }
  )
);

jukeboxAudioEngine.onEnded(() => {
  useJukeboxStore.setState({ isPlaying: false });
});

lan.on('jukeboxSync', (message) => {
  executeJukeboxCommand(message.payload);
});

lan.on('session', (session) => {
  if (session.jukebox) {
    const { track_url, looped, playing, position, timestamp } = session.jukebox;
    let currentPos = position;
    if (playing) {
      currentPos += (Date.now() - timestamp) / 1000;
    }
    useJukeboxStore.setState({
      currentTrack: track_url,
      isPlaying: playing,
      isLooped: looped,
    });
    jukeboxAudioEngine.play(track_url, looped);
    jukeboxAudioEngine.seek(currentPos);
    if (!playing) {
      jukeboxAudioEngine.pause();
    }
  } else {
    useJukeboxStore.setState({ currentTrack: null, isPlaying: false });
    jukeboxAudioEngine.stop();
  }
});
