import { Play, Pause, Square, Repeat } from 'lucide-react';
import { useJukeboxStore } from '../jukeboxStore';

// Automatically discover all audio files in the src/assets/music folder
const audioFiles = import.meta.glob(
  '../../../../campaigns/act_1/templates/assets/music/*.{mp3,wav,ogg}',
  {
    eager: true,
    query: '?url',
    import: 'default',
  }
);

// Convert the discovered files into a clean array of track objects
const TRACKS = Object.entries(audioFiles).map(([path, url]) => {
  // Extract filename without extension (e.g., "Boss_Battle.mp3" -> "Boss Battle")
  const fileName = path.split('/').pop() || 'Unknown Track';
  const title = fileName.replace(/\.[^/.]+$/, '').replace(/_/g, ' ');

  return {
    id: fileName,
    title,
    url: url as string,
  };
});

export function JukeboxPanel() {
  const { currentTrack, isPlaying, isLooped, sendAction } = useJukeboxStore();

  return (
    <div className='flex flex-col gap-2 bg-black/50 p-3 text-zinc-300'>
      <span className='mb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500'>
        Biblioteca de udio ({TRACKS.length} faixas)
      </span>

      <div className='scrollbar-thin scrollbar-thumb-zinc-700 mb-4 flex max-h-40 flex-col gap-1 overflow-y-auto pr-1'>
        {TRACKS.length === 0 ? (
          <div className='p-2 text-center text-xs italic text-zinc-500'>
            Adicione m sicas na pasta src/assets/music/
          </div>
        ) : (
          TRACKS.map((track) => {
            const isActive = currentTrack === track.url;
            return (
              <button
                key={track.id}
                onClick={() => sendAction('play', track.url, isLooped)}
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

      <div className='flex items-center justify-between border-t border-zinc-800 pt-3'>
        <button
          onClick={() => sendAction(isPlaying ? 'pause' : 'resume')}
          disabled={!currentTrack}
          className='flex flex-1 justify-center rounded py-2 text-zinc-400 hover:bg-zinc-900 hover:text-white disabled:opacity-50'
        >
          {isPlaying ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <button
          onClick={() => sendAction('stop')}
          disabled={!currentTrack}
          className='flex flex-1 justify-center rounded py-2 text-zinc-400 hover:bg-zinc-900 hover:text-red-400 disabled:opacity-50'
        >
          <Square size={18} />
        </button>
        <button
          onClick={() =>
            currentTrack && sendAction('play', currentTrack, !isLooped)
          }
          className={`flex flex-1 justify-center rounded py-2 ${isLooped ? 'text-[var(--theme-color)]' : 'text-zinc-600 hover:bg-zinc-900 hover:text-white'}`}
          title={isLooped ? 'Loop Ativado' : 'Loop Desativado'}
        >
          <Repeat size={18} />
        </button>
      </div>
    </div>
  );
}
