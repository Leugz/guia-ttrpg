import { useState } from 'react';
import { Eye, EyeOff, Film, Timer } from 'lucide-react';

import { useCurtainStore } from '../curtainStore';
import { CURTAIN_CLIPS } from '../lib/curtainCatalog';

const PRESET_MINUTES = [0, 5, 10, 15];

export function CurtainPanel() {
  const raise = useCurtainStore((state) => state.raise);
  const lower = useCurtainStore((state) => state.lower);
  const remember = useCurtainStore((state) => state.remember);
  const lastClipUrl = useCurtainStore((state) => state.lastClipUrl);
  const lastDuration = useCurtainStore((state) => state.lastDuration);
  const isRaised = useCurtainStore((state) => state.curtain !== null);

  const [label, setLabel] = useState('');

  const minutes = lastDuration ? Math.round(lastDuration / 60) : 0;

  const pick = (url: string | null) => remember(url, lastDuration);
  const setMinutes = (value: number) =>
    remember(lastClipUrl, value > 0 ? value * 60 : null);

  return (
    <div className='flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto bg-black/50 p-4 backdrop-blur-lg'>
      <div className='flex flex-col gap-2'>
        <span className='text-[10px] font-bold uppercase tracking-widest text-zinc-500'>
          Cena da Pausa
        </span>
        <div className='flex flex-col gap-1'>
          <button
            onClick={() => pick(null)}
            className={`rounded-sm px-3 py-2 text-left text-xs tracking-wider outline-none transition-colors focus:outline-none ${lastClipUrl === null ? 'bg-zinc-800 text-white' : 'bg-zinc-900/60 text-zinc-400 hover:bg-zinc-800'}`}
          >
            Tela escura (sem imagem)
          </button>
          {CURTAIN_CLIPS.map((clip) => (
            <button
              key={clip.id}
              onClick={() => pick(clip.url)}
              className={`flex items-center gap-2 rounded-sm px-3 py-2 text-left text-xs capitalize tracking-wider outline-none transition-colors focus:outline-none ${lastClipUrl === clip.url ? 'bg-zinc-800 text-white' : 'bg-zinc-900/60 text-zinc-400 hover:bg-zinc-800'}`}
            >
              {clip.kind === 'video' && (
                <Film size={12} className='shrink-0 text-zinc-500' />
              )}
              <span className='truncate'>{clip.title}</span>
            </button>
          ))}
          {CURTAIN_CLIPS.length === 0 && (
            <span className='px-1 py-2 text-[11px] leading-relaxed text-zinc-600'>
              Coloque seus vídeos <code className='text-zinc-500'>.mp4</code>{' '}
              (ou imagens) em{' '}
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

      {/* V opens this panel, so the curtain is raised and lowered from here. */}
      <button
        onClick={() =>
          isRaised ? lower() : raise({ label: label.trim() || null })
        }
        className={`mt-auto flex w-full items-center justify-center gap-2 rounded-sm border px-3 py-3 text-[11px] font-bold uppercase tracking-widest outline-none transition-colors focus:outline-none ${
          isRaised
            ? 'border-emerald-900/50 bg-emerald-950/40 text-emerald-400 hover:bg-emerald-900 hover:text-white'
            : 'border-amber-900/50 bg-amber-950/40 text-amber-400 hover:bg-amber-900 hover:text-white'
        }`}
      >
        {isRaised ? (
          <>
            <Eye size={14} /> Abrir a cortina
          </>
        ) : (
          <>
            <EyeOff size={14} /> Fechar a cortina
          </>
        )}
      </button>
    </div>
  );
}
