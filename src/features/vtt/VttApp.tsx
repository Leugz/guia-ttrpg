import React, { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  Crosshair,
  Ruler,
  MousePointer2,
  Map as MapIcon,
  FileText,
  Settings,
  MessageSquare,
  UserCircle,
  Wifi,
  ShieldAlert,
  X,
  Dices,
  ChevronDown,
} from 'lucide-react';
import { useChatStore } from '../chat/chatStore';
import {
  useCharacterStore,
  getProfileColor,
} from '../character-sheet/characterStore';
import { useSessionStore } from '../session/sessionStore';
import { ParsedDocument } from '../../shared/types';

import { ChatPanel } from '../chat/components/ChatPanel';
import { CharacterSheet } from '../character-sheet/components/CharacterSheet';
import { FreeDiceRoller } from '../dice/components/FreeDiceRoller';
import { GameBoard } from '../map/components/GameBoard';
import { ResourceMathInput } from '../character-sheet/components/ResourceMathInput';

const AVAILABLE_CHARACTERS = [
  { id: 'alan', name: 'ALAN', profile: 'EXECUTOR', file: 'alan.md' },
  { id: 'edgar', name: 'EDGAR', profile: 'EXECUTOR', file: 'edgar.md' },
  { id: 'eloisa', name: 'ELOÍSA', profile: 'ANALISTA', file: 'eloisa.md' },
  { id: 'kenia', name: 'KÊNIA', profile: 'ANALISTA', file: 'kenia.md' },
  { id: 'victor', name: 'VICTOR', profile: 'VIGILANTE', file: 'victor.md' },
];

const getConditionDesc = (id: string) => {
  switch (id) {
    case 'machucado':
      return 'Seu Físico diminui em um passo até o fim da cena.';
    case 'desatencao':
      return 'Sua Mente diminui em um passo até o fim da cena.';
    case 'irritacao':
      return 'Sua Emoção diminui em um passo até o fim da cena.';
    case 'ajudado':
      return 'Você foi ajudado. Se o auxílio foi com uma perícia 6/8, receba +1 Passo. Se foi com uma perícia 10/12, receba +2 Passos.';
    default:
      return '';
  }
};

const CharacterSelectionModal = ({
  onClose,
  onSelect,
}: {
  onClose: () => void;
  onSelect: (fileName: string) => void;
}) => (
  <div className='pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm'>
    <div className='flex w-[500px] flex-col rounded-sm border border-zinc-800 bg-[#0a0a0a] shadow-2xl'>
      <div className='flex items-center justify-between border-b border-zinc-900 bg-zinc-950 p-4'>
        <h2 className='font-serif text-xl font-black uppercase tracking-widest text-zinc-200'>
          Selecionar Ficha
        </h2>
        <button
          onClick={onClose}
          className='text-zinc-500 transition-colors hover:text-white'
        >
          <X size={20} />
        </button>
      </div>
      <div className='flex flex-col gap-2 p-4'>
        <p className='mb-2 text-sm font-bold uppercase tracking-wider text-zinc-500'>
          Ato 1: Disponíveis
        </p>
        {AVAILABLE_CHARACTERS.map((char) => {
          const profileColor = getProfileColor(char.profile);
          return (
            <button
              key={char.id}
              onClick={() => onSelect(char.file)}
              className='group relative flex items-center justify-between overflow-hidden rounded border border-zinc-800 bg-zinc-900/50 p-4 transition-all hover:bg-zinc-900'
            >
              <div
                className='absolute bottom-0 left-0 top-0 w-1 transition-all group-hover:w-2'
                style={{ backgroundColor: profileColor }}
              />
              <div className='ml-2 flex flex-col items-start'>
                <span
                  className='font-serif text-lg font-bold tracking-widest'
                  style={{ color: profileColor }}
                >
                  {char.name}
                </span>
                <span className='text-xs font-bold uppercase tracking-wider text-zinc-500'>
                  {char.profile}
                </span>
              </div>
              <span className='border border-zinc-800 bg-black px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-zinc-400 transition-colors group-hover:border-zinc-600'>
                Assumir
              </span>
            </button>
          );
        })}
      </div>
    </div>
  </div>
);

const ResourceBar = ({
  label,
  current,
  max,
  colorClass,
  activeColorClass,
  onUpdate,
}: any) => {
  const VISUAL_BLOCKS = 10;
  const percentage = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0;
  const activeCount = Math.round(percentage * VISUAL_BLOCKS);
  const blocks = Array.from(
    { length: VISUAL_BLOCKS },
    (_, i) => i < activeCount
  );

  return (
    <div className='flex items-center gap-1'>
      <div className={`w-8 font-serif text-lg font-bold ${colorClass}`}>
        {label}
      </div>
      <ResourceMathInput current={current} max={max} onUpdate={onUpdate} />
      <div className='ml-2 flex flex-nowrap gap-1'>
        {blocks.map((isActive, i) => (
          <div
            key={i}
            className={`h-4 w-3.5 -skew-x-12 border border-black/50 shadow-sm transition-colors ${isActive ? activeColorClass : 'bg-zinc-800/80'}`}
          />
        ))}
      </div>
    </div>
  );
};

export function VttApp() {
  const { connect, messages } = useChatStore();
  const { character, loadCharacter, applyResourceChange, ajudado } =
    useCharacterStore();

  // INJECT SESSION STATE FOR PATH ISOLATION AND LAN IDENTITY
  const { leaveGame, activeGamePath, isHosting, username } = useSessionStore();

  const [isRollerOpen, setIsRollerOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isSelectionModalOpen, setIsSelectionModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const [activeTool, setActiveTool] = useState('select');
  const [isGM, setIsGM] = useState(true);
  const [isHandoutOpen, setIsHandoutOpen] = useState(false);
  const [isMapTransitioning, setIsMapTransitioning] = useState(false);

  const [toasts, setToasts] = useState<any[]>([]);

  const handleLoadCharacter = async (fileName: string) => {
    // LAN PREP: If we are just a connected client, we don't have the files locally!
    if (!isHosting) {
      console.log(
        'Joined as LAN Client. Need to fetch character from Host via WebSocket...'
      );
      setIsSelectionModalOpen(false);
      return;
    }

    // HOST/LOCAL: Target the isolated active game path!
    const fullPath = `${activeGamePath}/${fileName}`;
    try {
      const result = await invoke<ParsedDocument>('load_character_sheet', {
        path: fullPath,
      });
      loadCharacter(result, fullPath);
      setIsSelectionModalOpen(false);
    } catch (error) {
      console.warn(
        `Isolated path ${fullPath} not found. Falling back to template for testing until Rust copy logic is implemented.`
      );

      const fallbackPath = `/home/leugz_/Projects/personal/guia/campaigns/act_1/templates/${fileName}`;
      try {
        const fallbackResult = await invoke<ParsedDocument>(
          'load_character_sheet',
          { path: fallbackPath }
        );
        loadCharacter(fallbackResult, fallbackPath);
        setIsSelectionModalOpen(false);
      } catch (fallbackError) {
        console.error('Failed to load character:', fallbackError);
      }
    }
  };

  useEffect(() => {
    let hostIp = window.location.hostname;
    if (hostIp === 'tauri.localhost' || hostIp === '' || hostIp === 'localhost')
      hostIp = 'localhost';
    connect(hostIp);

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        setIsRollerOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [connect]);

  const prevMsgCount = useRef(messages.length);
  const isChatOpenRef = useRef(isChatOpen);

  useEffect(() => {
    isChatOpenRef.current = isChatOpen;
  }, [isChatOpen]);

  useEffect(() => {
    if (messages.length > prevMsgCount.current) {
      if (!isChatOpenRef.current) {
        const latest = messages[messages.length - 1];
        setToasts((prev) =>
          [...prev, { ...latest, toastId: Date.now() }].slice(-3)
        );
      }
    }
    prevMsgCount.current = messages.length;
  }, [messages]);

  useEffect(() => {
    if (toasts.length > 0) {
      const timer = setTimeout(() => setToasts((prev) => prev.slice(1)), 4000);
      return () => clearTimeout(timer);
    }
  }, [toasts]);

  const themeColor = getProfileColor(character?.profile);
  const charName = character?.name || 'SELECIONAR FICHA';
  const hasConditions =
    (character && character.active_effects.length > 0) || ajudado;

  return (
    <div
      className='fixed inset-0 select-none overflow-hidden bg-zinc-950 font-sans text-zinc-200'
      style={{ '--theme-color': themeColor } as React.CSSProperties}
    >
      <div
        className={`absolute inset-0 z-0 transition-opacity duration-1000 ${isMapTransitioning ? 'opacity-0' : 'opacity-100'}`}
      >
        <GameBoard />
      </div>

      <div className='pointer-events-none absolute left-0 top-0 z-10 flex w-full items-start justify-between p-4'>
        <div className='pointer-events-auto flex gap-2'>
          <div className='flex w-fit flex-col gap-1 rounded-sm border border-zinc-900 bg-[#0a0a0a] p-1.5 shadow-xl'>
            <button
              onClick={() => setActiveTool('select')}
              className={`rounded-sm p-2 transition-colors ${activeTool === 'select' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300'}`}
            >
              <MousePointer2 size={18} />
            </button>
            <button
              onClick={() => setActiveTool('ping')}
              className={`rounded-sm p-2 transition-colors ${activeTool === 'ping' ? 'bg-zinc-900 text-[var(--theme-color)]' : 'text-zinc-500 hover:bg-zinc-900 hover:text-[var(--theme-color)]'}`}
            >
              <Crosshair size={18} />
            </button>
            <button
              onClick={() => setActiveTool('ruler')}
              className={`rounded-sm p-2 transition-colors ${activeTool === 'ruler' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300'}`}
            >
              <Ruler size={18} />
            </button>

            {isGM && (
              <button
                onClick={() => {
                  if (!isMapTransitioning) {
                    setIsMapTransitioning(true);
                    setTimeout(() => setIsMapTransitioning(false), 1000);
                  }
                }}
                className='mt-2 rounded-sm p-2 text-zinc-500 transition-colors hover:bg-zinc-900 hover:text-zinc-300'
                title='Mudar Mapa'
              >
                <MapIcon size={18} />
              </button>
            )}
            <button
              onClick={() => setIsHandoutOpen(!isHandoutOpen)}
              className={`rounded-sm p-2 transition-colors hover:bg-zinc-900 ${!isGM ? 'mt-2' : ''}`}
              style={{
                color: isHandoutOpen ? 'var(--theme-color)' : '#71717a',
              }}
              title='Documentos'
            >
              <FileText size={18} />
            </button>
          </div>
        </div>

        <div className='pointer-events-auto flex flex-col items-end gap-2'>
          <div
            className='flex items-center gap-2 rounded-sm border border-zinc-800 bg-black/80 px-3 py-1.5 shadow-xl backdrop-blur-sm'
            style={{ borderColor: 'var(--theme-color)' }}
          >
            <Wifi size={14} style={{ color: 'var(--theme-color)' }} />
            <span className='font-mono text-xs tracking-wider text-zinc-400'>
              LAN HOST
            </span>
            <div className='relative'>
              <button
                onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                className='ml-2 text-zinc-500 transition-colors hover:text-white'
              >
                <Settings size={14} />
              </button>
              {isSettingsOpen && (
                <div className='absolute right-0 top-full z-50 mt-3 w-48 rounded border border-zinc-800 bg-[#0a0a0a] py-1 shadow-2xl'>
                  <button
                    onClick={() => {
                      setIsSettingsOpen(false);
                      leaveGame();
                    }}
                    className='w-full px-4 py-3 text-left text-xs font-bold uppercase tracking-widest text-red-500 transition-colors hover:bg-zinc-900 hover:text-red-400'
                  >
                    Desconectar / Sair
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className='flex gap-2'>
            <div
              className='flex h-8 w-8 cursor-pointer items-center justify-center rounded-sm border border-zinc-700 bg-zinc-800 text-xs font-bold shadow-lg'
              style={{
                color: 'var(--theme-color)',
                borderColor: 'var(--theme-color)',
              }}
              title={`${username} (Você)`}
            >
              {username ? username.substring(0, 2).toUpperCase() : 'P1'}
            </div>

            {isHosting && (
              <div
                className='flex h-8 w-8 cursor-not-allowed items-center justify-center rounded-sm border border-dashed border-zinc-800 bg-zinc-900/50 text-xs font-bold text-zinc-700 shadow-lg'
                title='Aguardando Jogadores...'
              >
                ...
              </div>
            )}
          </div>
        </div>
      </div>

      {isHandoutOpen && (
        <div className='pointer-events-auto absolute right-20 top-24 z-20 flex w-72 flex-col gap-2 shadow-2xl'>
          <div className='overflow-hidden rounded-sm border border-zinc-700 bg-black/90 backdrop-blur-md'>
            <div className='flex cursor-move items-center justify-between border-b border-zinc-800 bg-zinc-900/90 px-3 py-2'>
              <span className='flex items-center gap-2 font-serif text-xs font-bold uppercase tracking-widest text-zinc-300'>
                <FileText size={14} style={{ color: 'var(--theme-color)' }} />{' '}
                Handouts
              </span>
            </div>
            <div className='flex max-h-[300px] flex-col overflow-y-auto'>
              <div className='flex flex-col gap-2 border-b border-zinc-800/50 px-3 py-2.5 text-sm text-zinc-400'>
                <div className='flex items-center gap-2'>
                  <div className='h-1.5 w-1.5 rounded-full bg-zinc-600' />
                  <span className='truncate'>Anotações do Paciente 42</span>
                </div>
                {isGM && (
                  <div className='ml-3 flex gap-1'>
                    <button className='rounded bg-zinc-800 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-300 hover:bg-zinc-700'>
                      Público
                    </button>
                    <button className='rounded bg-zinc-800 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-300 hover:bg-zinc-700'>
                      Único
                    </button>
                    <button className='ml-auto rounded bg-red-950/50 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-red-300 hover:bg-red-900'>
                      Ocultar
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FLOATING TOASTS */}
      <div className='pointer-events-none absolute bottom-28 right-6 z-[60] flex flex-col gap-2'>
        {toasts.map((toast) => (
          <div
            key={toast.toastId}
            className='animate-float-up-fade w-72 rounded-sm border border-zinc-700 bg-black/90 p-3 text-sm shadow-2xl backdrop-blur-sm'
          >
            <span
              className='font-serif font-bold tracking-wider'
              style={{ color: toast.color }}
            >
              {toast.sender}:{' '}
            </span>
            <span className='text-zinc-200'>
              {toast.type === 'text' ? (
                toast.content
              ) : (
                <span className='ml-1 inline-flex items-center gap-1.5'>
                  {toast.rollResult?.dice
                    ?.filter((d: any) => d.counted)
                    .map((d: any) => `d${d.sides}[${d.value}]`)
                    .join(' + ')}
                  <span className='mx-1' style={{ color: toast.color }}>
                    ➔
                  </span>
                  <span className='text-lg font-black text-white'>
                    {toast.rollResult?.total_sum}
                  </span>
                </span>
              )}
            </span>
          </div>
        ))}
      </div>

      <div className='pointer-events-auto absolute bottom-6 left-6 z-10 flex items-end gap-4'>
        <div className='flex flex-col gap-2'>
          {character && (
            <button
              onClick={() => setIsSelectionModalOpen(true)}
              className='flex w-fit cursor-pointer items-center gap-2 rounded-sm border border-zinc-800 bg-black/80 px-3 py-1.5 text-left transition-colors hover:border-zinc-600'
            >
              <UserCircle size={16} style={{ color: 'var(--theme-color)' }} />
              <span className='font-serif text-sm font-bold uppercase tracking-widest text-zinc-300'>
                {charName}
              </span>
              <ChevronDown size={14} className='text-zinc-600' />
            </button>
          )}

          <div
            onClick={() =>
              character ? setIsSheetOpen(true) : setIsSelectionModalOpen(true)
            }
            className='group relative h-32 w-32 cursor-pointer overflow-hidden rounded-sm border-2 border-zinc-800 bg-zinc-900 shadow-2xl'
          >
            <div className='absolute inset-0 bg-gradient-to-tr from-zinc-900 to-zinc-800 opacity-50' />
            <div className='absolute inset-x-2 bottom-0 h-3/4 rounded-t-[40%] border-x border-t border-zinc-700/50 bg-zinc-800/30' />
            <div className='absolute inset-0 flex flex-col items-center justify-center bg-black/60 p-2 text-center opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100'>
              <span className='mb-2 font-serif text-xs font-bold tracking-widest text-white'>
                {character ? 'ABRIR FICHA' : 'SELECIONAR FICHA'}
              </span>
            </div>
          </div>
        </div>

        <div className='flex flex-col gap-2'>
          {hasConditions && (
            <div className='flex w-fit items-center gap-2 rounded-sm border border-zinc-800 bg-black/80 px-3 py-1.5 shadow-md'>
              <ShieldAlert size={16} className='text-yellow-500' />
              <div className='ml-1 flex gap-1'>
                {character?.active_effects.map((effect) => (
                  <div key={effect.id} className='group relative'>
                    <span className='cursor-help rounded bg-zinc-900 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-zinc-300 transition-colors hover:bg-zinc-800'>
                      {effect.name}
                    </span>
                    <div className='pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-48 -translate-x-1/2 rounded border border-zinc-700 bg-[#0a0a0a] p-2 text-center text-xs text-zinc-300 opacity-0 shadow-2xl transition-opacity group-hover:opacity-100'>
                      {getConditionDesc(effect.id)}
                    </div>
                  </div>
                ))}
                {ajudado && (
                  <div className='group relative'>
                    <span className='cursor-help rounded bg-zinc-900 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-zinc-300 transition-colors hover:bg-zinc-800'>
                      Ajudado
                    </span>
                    <div className='pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-48 -translate-x-1/2 rounded border border-zinc-700 bg-[#0a0a0a] p-2 text-center text-xs text-zinc-300 opacity-0 shadow-2xl transition-opacity group-hover:opacity-100'>
                      {getConditionDesc('ajudado')}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className='flex flex-col gap-2 rounded-sm border border-zinc-800/80 bg-black/80 p-4 shadow-2xl backdrop-blur-sm'>
            <ResourceBar
              label='PV'
              current={character?.resources.hp.current || 0}
              max={character?.resources.hp.max || 0}
              colorClass='text-red-400'
              activeColorClass='bg-red-400'
              onUpdate={(delta: number) => applyResourceChange('hp', delta)}
            />
            <ResourceBar
              label='PD'
              current={character?.resources.dp.current || 0}
              max={character?.resources.dp.max || 0}
              colorClass='text-indigo-500'
              activeColorClass='bg-indigo-500'
              onUpdate={(delta: number) => applyResourceChange('dp', delta)}
            />
          </div>
        </div>
      </div>

      {!isChatOpen && (
        <div className='pointer-events-auto absolute bottom-6 right-6 z-40 flex gap-3'>
          <button
            onClick={() => setIsChatOpen(true)}
            className='group relative flex h-14 w-14 flex-col items-center justify-center gap-1 rounded-sm border border-zinc-800 bg-black/80 text-zinc-500 shadow-xl backdrop-blur-sm transition-all hover:-translate-y-1 hover:border-zinc-500'
          >
            <MessageSquare
              size={20}
              className='transition-transform group-hover:scale-110'
            />
            <span className='text-[9px] font-bold uppercase tracking-widest'>
              Chat
            </span>
          </button>
        </div>
      )}

      {isSelectionModalOpen && (
        <CharacterSelectionModal
          onClose={() => setIsSelectionModalOpen(false)}
          onSelect={handleLoadCharacter}
        />
      )}

      <ChatPanel
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        onOpenRoller={() => setIsRollerOpen(true)}
      />
      {isSheetOpen && character && (
        <CharacterSheet onClose={() => setIsSheetOpen(false)} />
      )}
      <FreeDiceRoller
        isOpen={isRollerOpen}
        onClose={() => setIsRollerOpen(false)}
      />
    </div>
  );
}
