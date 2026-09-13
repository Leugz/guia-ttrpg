import { useState } from 'react';
import { EyeOff, Timer } from 'lucide-react';

import { useCurtainStore } from '../curtainStore';
import { CURTAIN_CLIPS } from '../lib/curtainCatalog';

const PRESET_MINUTES = [0, 5, 10, 15];

export function CurtainPanel() {
  const raise = useCurtainStore((state) => state.raise);
  const remember = useCurtainStore((state) => state.remember);
  const lastGifUrl = useCurtainStore((state) => state.lastGifUrl);
  const lastDuration = useCurtainStore((state) => state.lastDuration);

  const [label, setLabel] = useState('');

  const minutes = lastDuration ? Math.round(lastDuration / 60) : 0;

  const pick = (url: string | null) => remember(url, lastDuration);
  const setMinutes = (value: number) =>
    remember(lastGifUrl, value > 0 ? value * 60 : null);

  return (
    <div className='flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto bg-black/50 p-4 backdrop-blur-lg'>
      <div className='flex flex-col gap-2'>
        <span className='text-[10px] font-bold uppercase tracking-widest text-zinc-500'>
          Imagem da Pausa
        </span>
        <div className='flex flex-col gap-1'>
          <button
            onClick={() => pick(null)}
            className={`rounded-sm px-3 py-2 text-left text-xs tracking-wider outline-none transition-colors focus:outline-none ${lastGifUrl === null ? 'bg-zinc-800 text-white' : 'bg-zinc-900/60 text-zinc-400 hover:bg-zinc-800'}`}
          >
            Tela escura (sem imagem)
          </button>
          {CURTAIN_CLIPS.map((clip) => (
            <button
              key={clip.id}
              onClick={() => pick(clip.url)}
              className={`truncate rounded-sm px-3 py-2 text-left text-xs capitalize tracking-wider outline-none transition-colors focus:outline-none ${lastGifUrl === clip.url ? 'bg-zinc-800 text-white' : 'bg-zinc-900/60 text-zinc-400 hover:bg-zinc-800'}`}
            >
              {clip.title}
            </button>
          ))}
          {CURTAIN_CLIPS.length === 0 && (
            <span className='px-1 py-2 text-[11px] leading-relaxed text-zinc-600'>
              Coloque seus GIFs em{' '}
              <code className='text-zinc-500'>campaigns/shared/curtains/</code>{' '}
              e recompile para que apareçam aqui.
            </span>
          )}
        </div>
      </div>

      <div className='flex flex-col gap-2'>
        <span className='flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-zinc-500'>
          <Timer size={12} /> Duração
        </span>
        <div className='flex gap-1'>
          {PRESET_MINUTES.map((value) => (
            <button
              key={value}
              onClick={() => setMinutes(value)}
              className={`flex-1 rounded-sm px-2 py-2 text-[11px] font-bold uppercase tracking-widest outline-none transition-colors focus:outline-none ${minutes === value ? 'bg-zinc-800 text-white' : 'bg-zinc-900/60 text-zinc-500 hover:bg-zinc-800'}`}
            >
              {value === 0 ? 'Livre' : `${value}m`}
            </button>
          ))}
        </div>
        <input
          type='number'
          min='0'
          max='180'
          value={minutes || ''}
          onChange={(event) => setMinutes(Number(event.target.value) || 0)}
          placeholder='Minutos (0 = sem cronômetro)'
          className='w-full rounded border border-zinc-800 bg-black px-2 py-1.5 font-mono text-xs text-white outline-none transition-colors focus:border-[var(--theme-color)]'
        />
      </div>

      <label className='flex flex-col gap-2'>
        <span className='text-[10px] font-bold uppercase tracking-widest text-zinc-500'>
          Recado (opcional)
        </span>
        <input
          type='text'
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder='Ex: Intervalo'
          className='w-full rounded border border-zinc-800 bg-black px-2 py-1.5 text-xs text-white outline-none transition-colors focus:border-[var(--theme-color)]'
        />
      </label>

      <button
        onClick={() => raise({ label: label.trim() || null })}
        className='mt-auto flex w-full items-center justify-center gap-2 rounded-sm border border-amber-900/50 bg-amber-950/40 px-3 py-3 text-[11px] font-bold uppercase tracking-widest text-amber-400 outline-none transition-colors hover:bg-amber-900 hover:text-white focus:outline-none'
      >
        <EyeOff size={14} /> Fechar a cortina (V)
      </button>
    </div>
  );
}
