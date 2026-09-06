import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { lan } from '../session/net/lanConnection';
import { useSessionStore } from '../session/sessionStore';

const audioA = new Audio();
const audioB = new Audio();
let activeAudio = audioA;
let inactiveAudio = audioB;

let activeFade = 1;
let inactiveFade = 0;
let fadeInterval: ReturnType<typeof setInterval> | null = null;

const applyVolumes = (localVolume: number) => {
  audioA.volume = Math.max(
    0,
    Math.min(
      1,
      (audioA === activeAudio ? activeFade : inactiveFade) * localVolume
    )
  );
  audioB.volume = Math.max(
    0,
    Math.min(
      1,
      (audioB === activeAudio ? activeFade : inactiveFade) * localVolume
    )
  );
};

const crossfadeTo = (
  newSrc: string | null,
  isLooped: boolean,
  localVolume: number
) => {
  if (fadeInterval) clearInterval(fadeInterval);

  const temp = activeAudio;
  activeAudio = inactiveAudio;
  inactiveAudio = temp;

  inactiveFade = activeFade;
  activeFade = 0;

  if (newSrc) {
    activeAudio.src = newSrc;
    activeAudio.loop = isLooped;
    activeAudio.play().catch(console.error);
  } else {
    activeAudio.pause();
  }

  fadeInterval = setInterval(() => {
    let done = true;

    if (inactiveFade > 0) {
      inactiveFade = Math.max(0, inactiveFade - 0.05);
      done = false;
    } else {
      inactiveAudio.pause();
    }

    if (newSrc && activeFade < 1) {
      activeFade = Math.min(1, activeFade + 0.05);
      done = false;
    }

    applyVolumes(localVolume);

    if (done) clearInterval(fadeInterval as number);
  }, 50);
};

// --- NEW: Helper function to execute playback locally ---
const executeJukeboxCommand = (payload: any) => {
  const store = useJukeboxStore.getState();

  if (payload.action === 'play') {
    useJukeboxStore.setState({
      currentTrack: payload.track_url,
      isPlaying: true,
      isLooped: payload.looped,
    });
    crossfadeTo(payload.track_url, payload.looped, store.localVolume);
  } else if (payload.action === 'pause') {
    useJukeboxStore.setState({ isPlaying: false });
    crossfadeTo(null, false, store.localVolume);
  } else if (payload.action === 'resume') {
    useJukeboxStore.setState({ isPlaying: true });
    crossfadeTo(store.currentTrack, store.isLooped, store.localVolume);
  } else if (payload.action === 'stop') {
    useJukeboxStore.setState({ currentTrack: null, isPlaying: false });
    crossfadeTo(null, false, store.localVolume);
  }
};

interface JukeboxState {
  currentTrack: string | null;
  isPlaying: boolean;
  isLooped: boolean;
  localVolume: number;
  setLocalVolume: (vol: number) => void;
  sendAction: (
    action: 'play' | 'pause' | 'resume' | 'stop',
    trackUrl?: string,
    looped?: boolean
  ) => void;
}

export const useJukeboxStore = create<JukeboxState>()(
  persist(
    (set, get) => ({
      currentTrack: null,
      isPlaying: false,
      isLooped: true,
      localVolume: 0.5,

      setLocalVolume: (vol) => {
        set({ localVolume: vol });
        applyVolumes(vol);
      },

      sendAction: (action, trackUrl, looped) => {
        const { clientId, isLanOpen, isHosting } = useSessionStore.getState();
        const payload = trackUrl
          ? { action, track_url: trackUrl, looped: looped ?? true }
          : { action };

        if (isLanOpen) {
          // If LAN is open, send to server. It will echo back to everyone (including the GM).
          lan.send({
            type: 'jukebox',
            clientId,
            payload,
          });
        } else if (isHosting) {
          // If GM is prepping offline, execute it immediately without the network loop.
          executeJukeboxCommand(payload);
        }
      },
    }),
    {
      name: 'guia-jukebox-settings',
      partialize: (state) => ({ localVolume: state.localVolume }),
    }
  )
);

// Listen to the LAN and execute audio changes locally when receiving the server echo
lan.on('jukeboxSync', (message) => {
  executeJukeboxCommand(message.payload);
});
