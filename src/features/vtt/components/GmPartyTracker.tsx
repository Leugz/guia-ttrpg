import { useCallback, useEffect, useState } from 'react';
import { ShieldAlert } from 'lucide-react';

import { getProfileColor } from '../../character-sheet/characterStore';
import * as gameClient from '../../session/net/gameClient';
import { lan } from '../../session/net/lanConnection';
import type { LanPlayer } from '../../session/net/protocol';
import type {
  ActiveEffect,
  CharacterSheet as CharacterSheetData,
} from '../../../shared/types';
import { getInitials } from '../../../shared/lib/initials';
import { TrackerResourceBar } from './TrackerResourceBar';

export interface GmPartyTrackerProps {
  /** Only the true GM tracks the party; anyone else renders nothing. */
  isGM: boolean;
  roster: LanPlayer[];
}

/**
 * The GM's live view of every claimed sheet at the table.
 *
 * Owns the sheets it displays and the selection on top of them, so a player
 * editing their PV no longer re-renders the whole table shell — the toolbar,
 * the board, the chat drawer and the handout windows all used to reconcile
 * because `partySheets` lived in `VttApp`'s state.
 */
export function GmPartyTracker({ isGM, roster }: GmPartyTrackerProps) {
  const [partySheets, setPartySheets] = useState<
    Record<string, CharacterSheetData>
  >({});
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Mestre carrega as fichas de todos que escolheram um personagem.
  //
  // Keyed off a joined string rather than the roster array: the host re-sends
  // the roster on every connect, disconnect and claim, and each of those
  // produced a brand-new array that re-ran this effect. `partySheets` is read
  // through the setter instead of the dependency list for the same reason —
  // listing it made the effect re-run on its own result.
  const claimedKey = roster
    .filter(
      (p) => p.connected && p.claimed_sheet && p.claimed_sheet !== '__GM__'
    )
    .map((p) => p.claimed_sheet)
    .sort()
    .join(',');

  useEffect(() => {
    if (!isGM || claimedKey === '') return;
    let cancelled = false;

    for (const id of claimedKey.split(',')) {
      gameClient
        .loadSheet(id)
        .then((doc) => {
          if (cancelled) return;
          setPartySheets((prev) =>
            prev[id] ? prev : { ...prev, [id]: doc.data }
          );
        })
        .catch(() => {});
    }

    return () => {
      cancelled = true;
    };
  }, [isGM, claimedKey]);

  // Mestre ouve as edições ao vivo
  useEffect(() => {
    if (!isGM) return;
    return lan.on('sheet', (message) => {
      setPartySheets((prev) =>
        // Só redesenha se a ficha alterada já estiver sendo acompanhada.
        prev[message.sheetId]
          ? { ...prev, [message.sheetId]: message.sheet }
          : prev
      );
    });
  }, [isGM]);

  const applyChange = useCallback(
    (sheetId: string, resource: 'hp' | 'dp', delta: number) => {
      gameClient
        .applyResourceChange(sheetId, resource, delta)
        .then((outcome) => {
          setPartySheets((prev) => ({ ...prev, [sheetId]: outcome.character }));
        })
        .catch((error) => console.error(error));
    },
    []
  );

  if (!isGM) return null;

  const entries = Object.entries(partySheets);
  if (entries.length === 0) return null;

  const selected = selectedId ? partySheets[selectedId] : null;

  return (
    <div className='flex gap-4'>
      <div className='mb-2 grid grid-cols-2 content-end gap-2'>
        {entries.map(([id, sheet]) => {
          const color = getProfileColor(sheet.profile);
          const isSelected = selectedId === id;
          return (
            <button
              key={id}
              onClick={() => setSelectedId(isSelected ? null : id)}
              className={`flex h-12 w-12 items-center justify-center rounded-sm border-2 bg-zinc-900 outline-none transition-all focus:outline-none ${isSelected ? 'scale-110 shadow-[0_0_15px_currentColor]' : 'opacity-70 hover:opacity-100'}`}
              style={{ borderColor: color, color: color }}
              title={sheet.name}
            >
              <span className='font-serif text-sm font-bold tracking-widest text-white'>
                {getInitials(sheet.name)}
              </span>
            </button>
          );
        })}
      </div>

      {selectedId && selected && (
        <div className='flex flex-col gap-2'>
          {selected.active_effects.length > 0 && (
            <div className='flex w-fit items-center gap-2 rounded-sm border border-zinc-800 bg-black/50 px-3 py-1.5 shadow-md backdrop-blur-md'>
              <ShieldAlert size={16} className='text-yellow-500' />
              <div className='ml-1 flex gap-1'>
                {selected.active_effects.map((effect: ActiveEffect) => (
                  <span
                    key={effect.id}
                    className='cursor-help rounded bg-zinc-900 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-zinc-300 transition-colors hover:bg-zinc-800'
                  >
                    {effect.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className='flex flex-col gap-2 rounded-sm border border-zinc-800/80 bg-black/50 p-4 shadow-2xl backdrop-blur-md'>
            <TrackerResourceBar
              label='PV'
              current={selected.resources.hp.current || 0}
              max={selected.resources.hp.max || 0}
              colorClass='text-red-500'
              activeColorClass='bg-red-500'
              onUpdate={(delta) => applyChange(selectedId, 'hp', delta)}
            />
            <TrackerResourceBar
              label='PD'
              current={selected.resources.dp.current || 0}
              max={selected.resources.dp.max || 0}
              colorClass='text-indigo-500'
              activeColorClass='bg-indigo-500'
              onUpdate={(delta) => applyChange(selectedId, 'dp', delta)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
