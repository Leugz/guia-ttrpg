import { useSyncExternalStore } from 'react';
import { jukeboxAudioEngine } from '../lib/jukeboxAudioEngine';

export const useJukeboxProgress = () =>
  useSyncExternalStore(
    jukeboxAudioEngine.subscribe,
    jukeboxAudioEngine.getSnapshot,
    jukeboxAudioEngine.getSnapshot
  );
