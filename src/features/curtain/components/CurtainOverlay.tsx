import { useEffect, useState } from 'react';

import { useCurtainStore } from '../curtainStore';

const TICK_MS = 250;

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

  const remaining = curtain?.duration ? countdown : null;

  if (!curtain) return null;
  // Players hide it locally the moment the clock runs out, even if the host's
  // confirmation is still in flight.
  if (remaining !== null && remaining <= 0 && !isGM) return null;

  return (
    <div className='fixed inset-0 z-[200] flex select-none flex-col items-center justify-center overflow-hidden bg-black'>
      {curtain.gif_url ? (
        <img
          src={curtain.gif_url}
          alt=''
          className='absolute inset-0 h-full w-full object-cover'
          draggable={false}
        />
      ) : (
        <div className='absolute inset-0 animate-[curtain-breathe_6s_ease-in-out_infinite] bg-[radial-gradient(circle_at_center,#161616_0%,#000_70%)]' />
      )}

      <div className='relative flex flex-col items-center gap-6 px-8 text-center'>
        {curtain.label && (
          <p className='max-w-2xl font-serif text-2xl tracking-widest text-zinc-200 drop-shadow-[0_2px_12px_rgba(0,0,0,0.95)]'>
            {curtain.label}
          </p>
        )}

        {remaining !== null && (
          <span className='font-mono text-6xl font-bold tabular-nums text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.95)]'>
            {formatClock(remaining)}
          </span>
        )}

        {isGM && (
          <button
            onClick={lower}
            className='rounded-sm border border-zinc-700 bg-black/70 px-5 py-2 text-[10px] font-bold uppercase tracking-widest text-zinc-400 outline-none backdrop-blur-sm transition-colors hover:border-zinc-500 hover:text-white focus:outline-none'
          >
            Continuar (V)
          </button>
        )}
      </div>
    </div>
  );
}
