import { X } from 'lucide-react';
import {
  getProfileColor,
  GM_COLOR,
} from '../../character-sheet/characterStore';
import type { LanPlayer, SheetSummary } from '../../session/net/protocol';

export interface CharacterSelectionModalProps {
  onClose: () => void;
  onSelect: (sheetId: string) => void;
  onSelectSpecial: (role: string | null) => void;
  sheets: SheetSummary[];
  roster: LanPlayer[];
  clientId: string;
  isOfflineHost: boolean;
  localClaim: string | null;
}

export function CharacterSelectionModal({
  onClose,
  onSelect,
  onSelectSpecial,
  sheets,
  roster,
  clientId,
  isOfflineHost,
  localClaim,
}: CharacterSelectionModalProps) {
  const isGmClaimedByAnyone = isOfflineHost
    ? localClaim === '__GM__'
    : roster.some((p) => p.connected && p.claimed_sheet === '__GM__');
  const isGmClaimedByMe = isOfflineHost
    ? localClaim === '__GM__'
    : roster.find((p) => p.client_id === clientId)?.claimed_sheet === '__GM__';

  return (
    <div
      className='pointer-events-auto fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm'
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className='flex w-[500px] flex-col rounded-sm border border-zinc-800 bg-black/80 shadow-2xl backdrop-blur-md'>
        <div className='flex items-center justify-between border-b border-zinc-900 bg-zinc-950 p-4'>
          <h2 className='font-serif text-xl font-black uppercase tracking-widest text-zinc-200'>
            Selecionar Identidade
          </h2>
          <button
            onClick={onClose}
            className='text-zinc-500 outline-none transition-colors hover:text-white focus:outline-none'
          >
            <X size={20} />
          </button>
        </div>
        <div className='flex flex-col p-4'>
          <p className='mb-2 text-sm font-bold uppercase tracking-wider text-zinc-500'>
            Opções do Sistema
          </p>

          <button
            onClick={() => onSelectSpecial('__GM__')}
            disabled={isGmClaimedByAnyone}
            className={`group relative mb-2 flex items-center justify-between overflow-hidden rounded border p-4 outline-none transition-all focus:outline-none ${isGmClaimedByAnyone ? 'cursor-not-allowed border-zinc-900 bg-black opacity-50' : 'border-zinc-800 bg-zinc-900/50 hover:bg-zinc-900'}`}
          >
            <div
              className='absolute bottom-0 left-0 top-0 w-1 transition-all group-hover:w-2'
              style={{ backgroundColor: GM_COLOR }}
            />
            <div className='ml-2 flex flex-col items-start'>
              <span
                className='font-serif text-lg font-bold tracking-widest'
                style={{
                  color:
                    isGmClaimedByAnyone && !isGmClaimedByMe
                      ? '#71717a'
                      : GM_COLOR,
                }}
              >
                Mestre (GM)
              </span>
              <span className='text-xs font-bold uppercase tracking-wider text-zinc-500'>
                Apenas um mestre por mesa
              </span>
            </div>
            <span
              className={`border px-3 py-1.5 text-xs font-bold uppercase tracking-widest transition-colors ${isGmClaimedByAnyone ? 'border-zinc-800 bg-black text-zinc-600' : 'border-zinc-800 bg-black text-zinc-400 group-hover:border-zinc-600'}`}
            >
              {isGmClaimedByAnyone
                ? isGmClaimedByMe
                  ? 'Sua Ficha'
                  : 'Bloqueado'
                : 'Assumir'}
            </span>
          </button>

          <button
            onClick={() => onSelectSpecial(null)}
            className='group relative mb-6 flex items-center justify-between overflow-hidden rounded border border-zinc-800 bg-zinc-900/50 p-4 outline-none transition-all hover:bg-zinc-900 focus:outline-none'
          >
            <div className='absolute bottom-0 left-0 top-0 w-1 bg-zinc-500 transition-all group-hover:w-2' />
            <div className='ml-2 flex flex-col items-start'>
              <span className='font-serif text-lg font-bold tracking-widest text-zinc-400'>
                Convidado
              </span>
              <span className='text-xs font-bold uppercase tracking-wider text-zinc-500'>
                Participar usando seu Nome de Usuário
              </span>
            </div>
            <span className='border border-zinc-800 bg-black px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-zinc-400 transition-colors group-hover:border-zinc-600'>
              Assumir
            </span>
          </button>

          <p className='mb-2 text-sm font-bold uppercase tracking-wider text-zinc-500'>
            Ato 1: Personagens
          </p>
          <div className='flex flex-col gap-2'>
            {sheets.map((char) => {
              const profileColor = getProfileColor(char.profile);
              const isClaimedByMe = isOfflineHost
                ? localClaim === char.id
                : roster.find((p) => p.client_id === clientId)
                    ?.claimed_sheet === char.id;
              const isClaimedByAnyone = isOfflineHost
                ? localClaim === char.id
                : roster.some(
                    (p) => p.connected && p.claimed_sheet === char.id
                  );

              return (
                <button
                  key={char.id}
                  onClick={() => onSelect(char.id)}
                  disabled={isClaimedByAnyone}
                  className={`group relative flex items-center justify-between overflow-hidden rounded border p-4 outline-none transition-all focus:outline-none ${isClaimedByAnyone ? 'cursor-not-allowed border-zinc-900 bg-black opacity-50' : 'border-zinc-800 bg-zinc-900/50 hover:bg-zinc-900'}`}
                >
                  <div
                    className='absolute bottom-0 left-0 top-0 w-1 transition-all group-hover:w-2'
                    style={{
                      backgroundColor:
                        isClaimedByAnyone && !isClaimedByMe
                          ? '#3f3f46'
                          : profileColor,
                    }}
                  />
                  <div className='ml-2 flex flex-col items-start'>
                    <span
                      className='font-serif text-lg font-bold tracking-widest'
                      style={{
                        color:
                          isClaimedByAnyone && !isClaimedByMe
                            ? '#71717a'
                            : profileColor,
                      }}
                    >
                      {char.name}
                    </span>
                    <span className='text-xs font-bold uppercase tracking-wider text-zinc-500'>
                      {char.profile}
                    </span>
                  </div>
                  <span
                    className={`border px-3 py-1.5 text-xs font-bold uppercase tracking-widest transition-colors ${isClaimedByAnyone ? 'border-zinc-800 bg-black text-zinc-600' : 'border-zinc-800 bg-black text-zinc-400 group-hover:border-zinc-600'}`}
                  >
                    {isClaimedByAnyone
                      ? isClaimedByMe
                        ? 'Sua Ficha'
                        : 'Bloqueado'
                      : 'Assumir'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
