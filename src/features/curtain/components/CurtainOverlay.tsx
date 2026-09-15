import { useEffect, useRef, useState } from 'react';

import type { CurtainState } from '../../session/net/protocol';
import { useCurtainStore } from '../curtainStore';
import { isVideoClip } from '../lib/curtainCatalog';

const TICK_MS = 250;
/** Both ends of the pause get the same two second dissolve. */
const FADE_MS = 2000;

const formatClock = (totalSeconds: number) => {
  const safe = Math.max(0, Math.ceil(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

interface CurtainOverlayProps {
  isGM: boolean;
}

export function CurtainOverlay({ isGM }: CurtainOverlayProps) {
  const curtain = useCurtainStore((state) => state.curtain);
  const lower = useCurtainStore((state) => state.lower);

  const [countdown, setCountdown] = useState<number | null>(null);
  /**
   * The curtain the screen is currently painting. It outlives `curtain` by one
   * fade so the table dissolves back to the map instead of snapping to it.
   */
  const [painted, setPainted] = useState<CurtainState | null>(null);
  const [opaque, setOpaque] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!curtain?.duration) return;

    const endsAt = curtain.started_at + curtain.duration * 1000;
    const tick = () => setCountdown((endsAt - Date.now()) / 1000);

    // Deferred rather than called inline so the first frame is already
    // correct without writing state during the effect itself.
    const immediate = setTimeout(tick, 0);
    const timer = setInterval(tick, TICK_MS);
    return () => {
      clearTimeout(immediate);
      clearInterval(timer);
    };
  }, [curtain]);

  // The GM's window owns the clock, so the whole table comes back together
  // instead of each machine deciding on its own.
  useEffect(() => {
    if (!isGM || !curtain?.duration) return;
    const endsAt = curtain.started_at + curtain.duration * 1000;
    const timer = setTimeout(lower, Math.max(0, endsAt - Date.now()));
    return () => clearTimeout(timer);
  }, [curtain, isGM, lower]);

  // Players start their fade out the moment the clock runs out, even if the
  // host's confirmation is still in flight. Derived from `curtain` and not
  // from `painted` so it stays latched while the dissolve plays.
  const expired =
    !isGM && Boolean(curtain?.duration) && countdown !== null && countdown <= 0;

  // A CSS animation rather than a transition: it plays from its own first
  // keyframe on mount, so the curtain fades in without a two frame dance.
  useEffect(() => {
    if (curtain && !expired) {
      const frame = requestAnimationFrame(() => {
        setPainted(curtain);
        setOpaque(true);
      });
      return () => cancelAnimationFrame(frame);
    }

    const frame = requestAnimationFrame(() => setOpaque(false));
    const timer = setTimeout(() => setPainted(null), FADE_MS);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, [curtain, expired]);

  const clipUrl = painted?.clip_url ?? painted?.gif_url ?? null;
  const isVideo = isVideoClip(clipUrl);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    // Belt and braces for the autoplay policy: the attribute alone is not
    // always enough, and a refused play() must not surface as an error.
    video.muted = true;
    video.defaultMuted = true;
    video.volume = 0;
    void video.play().catch(() => undefined);
  }, [clipUrl, isVideo]);

  if (!painted) return null;

  const remaining = painted.duration ? countdown : null;

  return (
    <div
      aria-hidden={!opaque}
      /*
       * z-[5] puts it above the board and below every panel, so the UI stays
       * usable while the table is paused and only the map is hidden. Pointer
       * events are captured for the whole dissolve, so nothing under a half
       * faded veil can be clicked by accident.
       */
      className={`absolute inset-0 z-[5] select-none overflow-hidden bg-black ${opaque ? 'opacity-100' : 'opacity-0'}`}
      style={{
        animationName: opaque ? 'curtain-fade-in' : 'curtain-fade-out',
        animationDuration: `${FADE_MS}ms`,
        animationTimingFunction: 'ease-in-out',
        animationFillMode: 'forwards',
      }}
    >
      {clipUrl ? (
        isVideo ? (
          <video
            key={clipUrl}
            ref={videoRef}
            src={clipUrl}
            className='absolute inset-0 h-full w-full object-cover'
            autoPlay
            loop
            muted
            playsInline
            preload='auto'
            controls={false}
            disablePictureInPicture
            tabIndex={-1}
          />
        ) : (
          <img
            src={clipUrl}
            alt=''
            className='absolute inset-0 h-full w-full object-cover'
            draggable={false}
          />
        )
      ) : (
        <div className='absolute inset-0 animate-[curtain-breathe_6s_ease-in-out_infinite] bg-[radial-gradient(circle_at_center,#161616_0%,#000_70%)]' />
      )}

      {painted.label && (
        <p className='pointer-events-none absolute inset-x-0 top-20 mx-auto max-w-3xl px-8 text-center font-serif text-2xl tracking-widest text-zinc-200 drop-shadow-[0_2px_12px_rgba(0,0,0,0.95)]'>
          {painted.label}
        </p>
      )}

      {remaining !== null && (
        // Clear of the chat button, which floats over the curtain now.
        <span className='pointer-events-none absolute bottom-6 right-24 font-mono text-5xl font-bold tabular-nums text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.95)]'>
          {formatClock(remaining)}
        </span>
      )}

      {isGM && (
        <button
          onClick={lower}
          className='absolute bottom-8 left-1/2 -translate-x-1/2 rounded-sm border border-zinc-700 bg-black/70 px-5 py-2 text-[10px] font-bold uppercase tracking-widest text-zinc-400 outline-none backdrop-blur-sm transition-colors hover:border-zinc-500 hover:text-white focus:outline-none'
        >
          Continuar (V)
        </button>
      )}
    </div>
  );
}
