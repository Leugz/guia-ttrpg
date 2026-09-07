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

  setVolume(volume: number) {
    this.localVolume = clamp(
      Number.isFinite(volume) ? volume : DEFAULT_VOLUME,
      0,
      1
    );
    this.applyVolumes();
  }

  play(src: string, looped: boolean) {
    this.cancelFade();

    const previousAudio = this.activeAudio;
    const nextAudio = this.inactiveAudio;
    const previousFade = previousAudio.paused ? 0 : this.activeFade;

    this.activeAudio = nextAudio;
    this.inactiveAudio = previousAudio;
    this.activeFade = 0;
    this.inactiveFade = previousFade;

    nextAudio.pause();
    nextAudio.src = src;
    nextAudio.loop = looped;
    nextAudio.currentTime = 0;
    this.applyVolumes();
    this.updateProgress(true);

    void nextAudio.play().catch((error) => {
      console.error('Failed to play jukebox audio', error);
    });

    this.fadeTo(1, 0, () => {
      this.inactiveAudio.pause();
      this.inactiveAudio.currentTime = 0;
    });
  }

  pause() {
    this.cancelFade();
    this.activeAudio.pause();
    this.inactiveAudio.pause();
    this.activeFade = 1;
    this.inactiveFade = 0;
    this.applyVolumes();
    this.updateProgress(true);
  }

  resume() {
    if (!this.activeAudio.src) return;

    this.cancelFade();
    this.inactiveAudio.pause();
    this.activeFade = 1;
    this.inactiveFade = 0;
    this.applyVolumes();

    void this.activeAudio.play().catch((error) => {
      console.error('Failed to resume jukebox audio', error);
    });
  }

  stop() {
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
    if (!this.activeAudio.src || !Number.isFinite(position)) return;

    const duration = this.getDuration(this.activeAudio);
    const nextPosition = clamp(position, 0, duration > 0 ? duration : position);

    try {
      this.activeAudio.currentTime = nextPosition;
      this.updateProgress(true);
    } catch (error) {
      console.error('Failed to seek jukebox audio', error);
    }
  }

  setLoop(looped: boolean) {
    this.activeAudio.loop = looped;
  }

  private bindAudio(audio: HTMLAudioElement) {
    const update = () => {
      if (audio === this.activeAudio) this.updateProgress();
    };

    audio.addEventListener('loadedmetadata', () => {
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
    audio.addEventListener('ended', () => {
      if (audio !== this.activeAudio || audio.loop) return;
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
