/**
 * The GM's map list, opening beside the toolbar button rather than over the
 * board — picking a map is a glance-and-click, not a modal decision, and the
 * board stays visible behind it.
 */

import { Check, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import type { MapDefinition } from '../../../shared/types';
import * as gameClient from '../../session/net/gameClient';
import { useLanStore } from '../../session/net/lanStore';

export function MapSelector({ onClose }: { onClose: () => void }) {
  const maps = useLanStore((state) => state.maps);
  const setMaps = useLanStore((state) => state.setMaps);
  /** The map being revealed, held until the host confirms the write. */
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reveal = async (map: MapDefinition) => {
    if (map.is_active || pending) return;
    setPending(map.id);
    setError(null);
    try {
      // The host answers with the whole list, so the active flag can never
      // end up set on two maps at once in this window.
      setMaps(await gameClient.setActiveMap(map.id));
      onClose();
    } catch (cause) {
      console.error('Failed to reveal the map:', cause);
      setError('O mapa não pôde ser revelado.');
    } finally {
      setPending(null);
    }
  };

  // Escape closes it, matching every other transient panel in the app.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className='pointer-events-auto w-64 rounded-sm border border-zinc-800 bg-[#0a0a0a]/95 p-1.5 shadow-2xl backdrop-blur-md'>
      <span className='block border-b border-zinc-800 px-2 pb-1.5 pt-1 text-[10px] font-bold uppercase tracking-widest text-zinc-500'>
        Mapas
      </span>

      <div className='mt-1 flex max-h-80 flex-col gap-1 overflow-y-auto'>
        {maps.map((map) => (
          <button
            key={map.id}
            onClick={() => void reveal(map)}
            disabled={Boolean(pending)}
            className={`group flex items-center justify-between gap-2 rounded px-2 py-2 text-left transition-colors ${
              map.is_active
                ? 'bg-zinc-900 text-[var(--theme-color)]'
                : 'text-zinc-400 hover:bg-zinc-900/70 hover:text-white'
            } ${pending ? 'cursor-wait opacity-60' : ''}`}
          >
            <span className='truncate text-sm font-medium'>{map.title}</span>
            {pending === map.id ? (
              <Loader2 size={13} className='shrink-0 animate-spin' />
            ) : map.is_active ? (
              <Check size={13} className='shrink-0' />
            ) : null}
          </button>
        ))}

        {maps.length === 0 && (
          <p className='px-2 py-3 text-xs leading-relaxed text-zinc-600'>
            Nenhum mapa nesta campanha. Adicione arquivos <code>.md</code> na
            pasta <code>maps/</code> do ato.
          </p>
        )}
      </div>

      {error && (
        <p className='mt-1 border-t border-zinc-800 px-2 py-2 text-xs text-red-400'>
          {error}
        </p>
      )}
    </div>
  );
}
