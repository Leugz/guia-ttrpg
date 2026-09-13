export interface JukeboxProgress {
  currentTime: number;
  duration: number;
}

const DEFAULT_VOLUME = 0.5;
const FADE_INTERVAL_MS = 50;
const FADE_STEP = 0.05;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const moveTowards = (value: number, target: number) => {
  if (value < target) return Math.min(target, value + FADE_STEP);
  if (value > target) return Math.max(target, value - FADE_STEP);
  return value;
};

const MIME_BY_EXTENSION: Record<string, string> = {
  mp3: 'audio/mpeg',
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  wav: 'audio/wav',
  flac: 'audio/flac',
  m4a: 'audio/mp4',
};

const mimeForSource = (src: string) => {
  const extension = src.split(/[?#]/)[0].split('.').pop()?.toLowerCase() ?? '';
  return MIME_BY_EXTENSION[extension] ?? 'audio/mpeg';
};

const blobUrlCache = new Map<string, string>();
const inFlightLoads = new Map<string, Promise<string>>();

const resolveAudioSource = (src: string): Promise<string> => {
  const cached = blobUrlCache.get(src);
  if (cached) return Promise.resolve(cached);

  const pending = inFlightLoads.get(src);
  if (pending) return pending;

  const request = fetch(src)
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} while loading ${src}`);
      }

      const blob = await response.blob();
      const typedBlob = new Blob([blob], { type: mimeForSource(src) });

      // Convert to a base64 data URI to sever the IPC connection
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(typedBlob);
      });
    })
    .then((dataUrl) => {
      blobUrlCache.set(src, dataUrl);
      return dataUrl;
    })
    .finally(() => {
      inFlightLoads.delete(src);
    });

  inFlightLoads.set(src, request);
  return request;
};

class JukeboxAudioEngine {
  private readonly audioA = new Audio();
  private readonly audioB = new Audio();
  private activeAudio = this.audioA;
  private inactiveAudio = this.audioB;
  private activeFade = 1;
  private inactiveFade = 0;
  private localVolume = DEFAULT_VOLUME;
  private fadeInterval: ReturnType<typeof setInterval> | null = null;
  private progress: JukeboxProgress = { currentTime: 0, duration: 0 };
  private readonly progressListeners = new Set<() => void>();
  private readonly endedListeners = new Set<() => void>();

  private currentSrc: string | null = null;
  private desiredPlaying = false;
  private looped = true;
  private pendingSeek: number | null = null;
  private loadToken = 0;

  constructor() {
    this.bindAudio(this.audioA);
    this.bindAudio(this.audioB);
    this.applyVolumes();
  }

  readonly subscribe = (listener: () => void) => {
    this.progressListeners.add(listener);
    return () => this.progressListeners.delete(listener);
  };

  readonly getSnapshot = () => this.progress;

  onEnded(listener: () => void) {
    this.endedListeners.add(listener);
    return () => this.endedListeners.delete(listener);
  }

  preload(src: string) {
    void resolveAudioSource(src).catch(() => undefined);
  }

  setVolume(volume: number) {
    this.localVolume = clamp(
      Number.isFinite(volume) ? volume : DEFAULT_VOLUME,
      0,
      1
    );
    this.applyVolumes();
  }

  play(src: string, looped: boolean) {
    const token = ++this.loadToken;
    this.cancelFade();

    const previousAudio = this.activeAudio;
    const nextAudio = this.inactiveAudio;
    const previousFade = previousAudio.paused ? 0 : this.activeFade;

    this.activeAudio = nextAudio;
    this.inactiveAudio = previousAudio;
    this.activeFade = 0;
    this.inactiveFade = previousFade;

    this.currentSrc = src;
    this.desiredPlaying = true;
    this.looped = looped;
    this.pendingSeek = null;

    nextAudio.pause();
    nextAudio.removeAttribute('src');
    nextAudio.load();
    nextAudio.loop = looped;
    this.applyVolumes();
    this.updateProgress(true);

    void resolveAudioSource(src)
      .then((resolvedUrl) => {
        if (token !== this.loadToken) return;

        nextAudio.src = resolvedUrl;
        nextAudio.loop = this.looped;
        nextAudio.load();

        if (!this.desiredPlaying) return;
        return nextAudio.play();
      })
      .catch((error) => {
        console.error('Failed to play jukebox audio', src, error);
      });

    this.fadeTo(1, 0, () => {
      this.inactiveAudio.pause();
      this.inactiveAudio.currentTime = 0;
    });
  }

  pause() {
    this.desiredPlaying = false;
    this.cancelFade();
    this.activeAudio.pause();
    this.inactiveAudio.pause();
    this.activeFade = 1;
    this.inactiveFade = 0;
    this.applyVolumes();
    this.updateProgress(true);
  }

  resume() {
    if (!this.currentSrc) return;

    this.desiredPlaying = true;
    this.cancelFade();
    this.inactiveAudio.pause();
    this.activeFade = 1;
    this.inactiveFade = 0;
    this.applyVolumes();

    if (!this.activeAudio.src) return;

    void this.activeAudio.play().catch((error) => {
      console.error('Failed to resume jukebox audio', error);
    });
  }

  stop() {
    this.loadToken += 1;
    this.currentSrc = null;
    this.desiredPlaying = false;
    this.pendingSeek = null;
    this.cancelFade();

    this.fadeTo(0, 0, () => {
      this.audioA.pause();
      this.audioB.pause();
      this.audioA.currentTime = 0;
      this.audioB.currentTime = 0;
      this.activeFade = 1;
      this.inactiveFade = 0;
      this.applyVolumes();
      this.updateProgress(true);
    });
  }

  seek(position: number) {
    if (!this.currentSrc || !Number.isFinite(position)) return;

    const audio = this.activeAudio;

    if (!audio.src || audio.readyState < 1) {
      this.pendingSeek = Math.max(0, position);
      return;
    }

    const duration = this.getDuration(audio);
    const nextPosition = clamp(position, 0, duration > 0 ? duration : position);

    try {
      audio.currentTime = nextPosition;
      this.updateProgress(true);
    } catch (error) {
      console.error('Failed to seek jukebox audio', error);
    }
  }

  setLoop(looped: boolean) {
    this.looped = looped;
    this.activeAudio.loop = looped;
  }

  private bindAudio(audio: HTMLAudioElement) {
    const update = () => {
      if (audio === this.activeAudio) this.updateProgress();
    };

    audio.addEventListener('loadedmetadata', () => {
      if (audio === this.activeAudio && this.pendingSeek !== null) {
        const target = this.pendingSeek;
        this.pendingSeek = null;
        const duration = this.getDuration(audio);

        try {
          audio.currentTime = clamp(
            duration > 0 && audio.loop ? target % duration : target,
            0,
            duration > 0 ? duration : target
          );
        } catch (error) {
          console.error('Failed to apply pending jukebox seek', error);
        }
      }

      if (
        audio.loop &&
        audio.duration > 0 &&
        audio.currentTime > audio.duration
      ) {
        audio.currentTime = audio.currentTime % audio.duration;
      }
      update();
    });
    audio.addEventListener('durationchange', update);
    audio.addEventListener('timeupdate', update);
    audio.addEventListener('seeking', update);
    audio.addEventListener('seeked', update);
    audio.addEventListener('error', () => {
      if (!audio.src) return;
      console.error(
        'Jukebox audio element error',
        audio.error?.code,
        audio.error?.message
      );
    });
    audio.addEventListener('ended', () => {
      if (audio !== this.activeAudio || audio.loop) return;
      this.desiredPlaying = false;
      this.updateProgress(true);
      this.endedListeners.forEach((listener) => listener());
    });
  }

  private getDuration(audio: HTMLAudioElement) {
    return Number.isFinite(audio.duration) && audio.duration > 0
      ? audio.duration
      : 0;
  }

  private updateProgress(force = false) {
    const currentTime = Number.isFinite(this.activeAudio.currentTime)
      ? Math.max(0, this.activeAudio.currentTime)
      : 0;
    const duration = this.getDuration(this.activeAudio);

    if (
      !force &&
      currentTime === this.progress.currentTime &&
      duration === this.progress.duration
    ) {
      return;
    }

    this.progress = { currentTime, duration };
    this.progressListeners.forEach((listener) => listener());
  }

  private fadeTo(
    activeTarget: number,
    inactiveTarget: number,
    onDone: () => void
  ) {
    const tick = () => {
      this.activeFade = moveTowards(this.activeFade, activeTarget);
      this.inactiveFade = moveTowards(this.inactiveFade, inactiveTarget);
      this.applyVolumes();

      if (
        this.activeFade === activeTarget &&
        this.inactiveFade === inactiveTarget
      ) {
        this.cancelFade();
        onDone();
      }
    };

    tick();

    if (
      this.activeFade !== activeTarget ||
      this.inactiveFade !== inactiveTarget
    ) {
      this.fadeInterval = setInterval(tick, FADE_INTERVAL_MS);
    }
  }

  private cancelFade() {
    if (!this.fadeInterval) return;
    clearInterval(this.fadeInterval);
    this.fadeInterval = null;
  }

  private applyVolumes() {
    this.audioA.volume = clamp(
      (this.audioA === this.activeAudio ? this.activeFade : this.inactiveFade) *
        this.localVolume,
      0,
      1
    );
    this.audioB.volume = clamp(
      (this.audioB === this.activeAudio ? this.activeFade : this.inactiveFade) *
        this.localVolume,
      0,
      1
    );
  }
}

export const jukeboxAudioEngine = new JukeboxAudioEngine();
