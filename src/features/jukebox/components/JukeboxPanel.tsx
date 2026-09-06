import { Pause, Play, Repeat, Square } from 'lucide-react';
import { useJukeboxProgress } from '../hooks/useJukeboxProgress';
import { JUKEBOX_TRACKS } from '../lib/musicCatalog';
import { useJukeboxStore } from '../jukeboxStore';

const formatTime = (value: number) => {
  if (!Number.isFinite(value) || value < 0) return '0:00';
  const totalSeconds = Math.floor(value);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

export function JukeboxPanel() {
  const {
    currentTrack,
    isPlaying,
    isLooped,
    play,
    pause,
    resume,
    stop,
    seek,
    setLoop,
  } = useJukeboxStore();
  const { currentTime, duration } = useJukeboxProgress();
  const seekMax = duration > 0 ? duration : 1;
  const seekValue = duration > 0 ? Math.min(currentTime, duration) : 0;

  return (
    <div className='flex flex-col gap-2 bg-black/50 p-3 text-zinc-300'>
      <span className='mb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500'>
        Biblioteca de Audio ({JUKEBOX_TRACKS.length} faixas)
      </span>

      <div className='scrollbar-thin scrollbar-thumb-zinc-700 mb-4 flex max-h-40 flex-col gap-1 overflow-y-auto pr-1'>
        {JUKEBOX_TRACKS.length === 0 ? (
          <div className='p-2 text-center text-xs italic text-zinc-500'>
            Adicione m sicas na pasta src/assets/music/
          </div>
        ) : (
          JUKEBOX_TRACKS.map((track) => {
            const isActive = currentTrack === track.url;
            return (
              <button
                key={track.id}
                onClick={() => play(track.url)}
                className={`rounded border px-3 py-2 text-left text-sm transition-colors ${
                  isActive
                    ? 'border-[var(--theme-color)] bg-zinc-900/80 text-white'
                    : 'border-transparent hover:bg-zinc-900 hover:text-white'
                }`}
              >
                {track.title}
                {isActive && isPlaying && (
                  <span className='float-right animate-pulse text-[var(--theme-color)]'>
                    {' '}
                  </span>
                )}
              </button>
            );
          })
        )}
      </div>

      <div className='border-t border-zinc-800 pt-3'>
        <div className='mb-2'>
          <input
            type='range'
            min='0'
            max={seekMax}
            step='0.1'
            value={seekValue}
            onChange={(event) => seek(Number(event.target.value))}
            disabled={!currentTrack || duration <= 0}
            className='w-full accent-[var(--theme-color)] disabled:opacity-50'
            aria-label='Posição da música'
          />
          <div className='mt-1 flex justify-between font-mono text-[10px] text-zinc-500'>
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        <div className='flex items-center justify-between'>
          <button
            onClick={isPlaying ? pause : resume}
            disabled={!currentTrack}
            className='flex flex-1 justify-center rounded py-2 text-zinc-400 hover:bg-zinc-900 hover:text-white disabled:opacity-50'
          >
            {isPlaying ? <Pause size={18} /> : <Play size={18} />}
          </button>
          <button
            onClick={stop}
            disabled={!currentTrack}
            className='flex flex-1 justify-center rounded py-2 text-zinc-400 hover:bg-zinc-900 hover:text-red-400 disabled:opacity-50'
          >
            <Square size={18} />
          </button>
          <button
            onClick={() => currentTrack && setLoop(!isLooped)}
            className={`flex flex-1 justify-center rounded py-2 ${isLooped ? 'text-[var(--theme-color)]' : 'text-zinc-600 hover:bg-zinc-900 hover:text-white'}`}
            title={isLooped ? 'Loop Ativado' : 'Loop Desativado'}
          >
            <Repeat size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
