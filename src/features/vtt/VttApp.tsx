import React, { useState, useEffect, useRef } from 'react';
import {
  Crosshair,
  Ruler,
  MousePointer2,
  Map as MapIcon,
  FileText,
  Settings,
  MessageSquare,
  Wifi,
  ShieldAlert,
  X,
  ChevronDown,
  Eye,
  EyeOff,
  Copy,
} from 'lucide-react';
import { useChatStore } from '../chat/chatStore';
import {
  useCharacterStore,
  getProfileColor,
  GM_COLOR,
} from '../character-sheet/characterStore';
import { useSessionStore } from '../session/sessionStore';
import { useLanStore, isSheetTaken } from '../session/net/lanStore';
import * as gameClient from '../session/net/gameClient';
import type { LanPlayer, SheetSummary } from '../session/net/protocol';
import { ChatPanel } from '../chat/components/ChatPanel';
import { CharacterSheet } from '../character-sheet/components/CharacterSheet';
import { FreeDiceRoller } from '../dice/components/FreeDiceRoller';
import { GameBoard } from '../map/components/GameBoard';
import { ResourceMathInput } from '../character-sheet/components/ResourceMathInput';

const getInitials = (name: string) => {
  const words = name.trim().split(/\s+/);
  if (words.length === 0 || words[0] === '') return '?';
  if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
};

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

// Custom Draggable Window Component
const DraggableWindow = ({
  title,
  onClose,
  children,
  initialX = 100,
  initialY = 100,
  width = 'w-72',
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  initialX?: number;
  initialY?: number;
  width?: string;
}) => {
  const [pos, setPos] = useState({ x: initialX, y: initialY });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0 });

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    dragRef.current = { startX: e.clientX - pos.x, startY: e.clientY - pos.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    setPos({
      x: e.clientX - dragRef.current.startX,
      y: e.clientY - dragRef.current.startY,
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  return (
    <div
      className={`pointer-events-auto absolute z-50 flex ${width} flex-col gap-2 shadow-2xl`}
      style={{ left: pos.x, top: pos.y }}
    >
      <div className='overflow-hidden rounded-sm border border-zinc-700 bg-black/90 backdrop-blur-md'>
        <div
          className='flex cursor-move items-center justify-between border-b border-zinc-800 bg-zinc-900/90 px-3 py-2'
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          <span className='flex select-none items-center gap-2 font-serif text-xs font-bold uppercase tracking-widest text-zinc-300'>
            <FileText size={14} style={{ color: 'var(--theme-color)' }} />{' '}
            {title}
          </span>
          <button
            onClick={onClose}
            className='cursor-pointer text-zinc-500 transition-colors hover:text-white'
            onPointerDown={(e) => e.stopPropagation()}
          >
            <X size={14} />
          </button>
        </div>
        <div className='flex flex-col'>{children}</div>
      </div>
    </div>
  );
};

const CharacterSelectionModal = ({
  onClose,
  onSelect,
  onSelectSpecial,
  sheets,
  roster,
  clientId,
  isOfflineHost,
}: {
  onClose: () => void;
  onSelect: (sheetId: string) => void;
  onSelectSpecial: (role: string | null) => void;
  sheets: SheetSummary[];
  roster: LanPlayer[];
  clientId: string;
  isOfflineHost: boolean;
}) => (
  // Modal implementation remains unchanged
  <div className='pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm'>
    <div className='flex w-[500px] flex-col rounded-sm border border-zinc-800 bg-[#0a0a0a] shadow-2xl'>
      <div className='flex items-center justify-between border-b border-zinc-900 bg-zinc-950 p-4'>
        <h2 className='font-serif text-xl font-black uppercase tracking-widest text-zinc-200'>
          Selecionar Identidade
        </h2>
        <button
          onClick={onClose}
          className='text-zinc-500 transition-colors hover:text-white'
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
          disabled={!isOfflineHost && isSheetTaken(roster, '__GM__', clientId)}
          className={`group relative mb-2 flex items-center justify-between overflow-hidden rounded border p-4 transition-all ${!isOfflineHost && isSheetTaken(roster, '__GM__', clientId) ? 'cursor-not-allowed border-zinc-900 bg-black opacity-50' : 'border-zinc-800 bg-zinc-900/50 hover:bg-zinc-900'}`}
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
                  !isOfflineHost && isSheetTaken(roster, '__GM__', clientId)
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
            className={`border px-3 py-1.5 text-xs font-bold uppercase tracking-widest transition-colors ${!isOfflineHost && isSheetTaken(roster, '__GM__', clientId) ? 'border-zinc-800 bg-black text-zinc-600' : 'border-zinc-800 bg-black text-zinc-400 group-hover:border-zinc-600'}`}
          >
            {!isOfflineHost && isSheetTaken(roster, '__GM__', clientId)
              ? 'Bloqueado'
              : 'Assumir'}
          </span>
        </button>
        <button
          onClick={() => onSelectSpecial(null)}
          className='group relative mb-6 flex items-center justify-between overflow-hidden rounded border border-zinc-800 bg-zinc-900/50 p-4 transition-all hover:bg-zinc-900'
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
            const isClaimedByOther =
              !isOfflineHost && isSheetTaken(roster, char.id, clientId);
            return (
              <button
                key={char.id}
                onClick={() => onSelect(char.id)}
                disabled={isClaimedByOther}
                className={`group relative flex items-center justify-between overflow-hidden rounded border p-4 transition-all ${isClaimedByOther ? 'cursor-not-allowed border-zinc-900 bg-black opacity-50' : 'border-zinc-800 bg-zinc-900/50 hover:bg-zinc-900'}`}
              >
                <div
                  className='absolute bottom-0 left-0 top-0 w-1 transition-all group-hover:w-2'
                  style={{
                    backgroundColor: isClaimedByOther
                      ? '#3f3f46'
                      : profileColor,
                  }}
                />
                <div className='ml-2 flex flex-col items-start'>
                  <span
                    className='font-serif text-lg font-bold tracking-widest'
                    style={{
                      color: isClaimedByOther ? '#71717a' : profileColor,
                    }}
                  >
                    {char.name}
                  </span>
                  <span className='text-xs font-bold uppercase tracking-wider text-zinc-500'>
                    {char.profile}
                  </span>
                </div>
                <span
                  className={`border px-3 py-1.5 text-xs font-bold uppercase tracking-widest transition-colors ${isClaimedByOther ? 'border-zinc-800 bg-black text-zinc-600' : 'border-zinc-800 bg-black text-zinc-400 group-hover:border-zinc-600'}`}
                >
                  {isClaimedByOther ? 'Bloqueado' : 'Assumir'}
                </span>
              </button>
            );
          })}
        </div>
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
  const messages = useChatStore((state) => state.messages);
  const roster = useLanStore((state) => state.roster);
  const sheets = useLanStore((state) => state.sheets);
  const setSheets = useLanStore((state) => state.setSheets);
  const connect = useLanStore((state) => state.connect);
  const updateIdentity = useLanStore((state) => state.updateIdentity);
  const claimSheet = useLanStore((state) => state.claimSheet);
  const connectionStatus = useLanStore((state) => state.status);
  const closedReason = useLanStore((state) => state.closedReason);

  const { character, loadCharacter, applyResourceChange, ajudado } =
    useCharacterStore();

  const {
    leaveGame,
    isHosting,
    isLanOpen,
    openLan,
    closeLan,
    username,
    clientId,
    lanHostAddress,
    localClaim,
    setLocalClaim,
    vpnIp,
    setVpnIp,
  } = useSessionStore();

  useEffect(() => {
    if (closedReason && !isHosting) {
      leaveGame().then(() => {
        useSessionStore.setState({ sessionError: closedReason });
      });
    }
  }, [closedReason, isHosting, leaveGame]);

  const isOfflineHost = isHosting && !isLanOpen;

  const currentPlayer = isOfflineHost
    ? { claimed_sheet: localClaim }
    : roster.find((p) => p.client_id === clientId);

  const claimedSheet = currentPlayer?.claimed_sheet;
  const isTrueGM = claimedSheet === '__GM__';

  const identityColor = character
    ? getProfileColor(character.profile)
    : isTrueGM
      ? GM_COLOR
      : '#71717a';

  const charName = character
    ? character.name
    : isTrueGM
      ? 'Mestre'
      : 'Convidado';

  const displayRoster = isOfflineHost
    ? [
        {
          client_id: clientId,
          username: username || 'Mestre',
          color: identityColor,
          connected: true,
        } as LanPlayer,
      ]
    : roster.filter((player) => player.connected);

  const [isRollerOpen, setIsRollerOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isSelectionModalOpen, setIsSelectionModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const [activeTool, setActiveTool] = useState('select');
  const [isMapTransitioning, setIsMapTransitioning] = useState(false);
  const [toasts, setToasts] = useState<any[]>([]);

  // -------------------------------------------------------------------------
  // Handouts State
  // -------------------------------------------------------------------------
  const [isHandoutListOpen, setIsHandoutListOpen] = useState(false);

  // Mock Handout Data
  const [handouts, setHandouts] = useState([
    {
      id: 'h1',
      title: 'Carta Encontrada',
      type: 'text',
      content:
        'A criatura se alimenta de medo. Não demonstre fraqueza.\n\n- Dr. Veríssimo',
      isPublic: false,
    },
    {
      id: 'h2',
      title: 'Símbolo Misterioso',
      type: 'image',
      content:
        'https://images.unsplash.com/photo-1596720426673-e4e14290f0cc?q=80&w=400&auto=format&fit=crop',
      isPublic: true,
    },
  ]);
  const [openHandoutIds, setOpenHandoutIds] = useState<string[]>([]);

  const visibleHandouts = isTrueGM
    ? handouts
    : handouts.filter((h) => h.isPublic);

  const toggleHandoutPublic = (id: string) => {
    setHandouts((prev) =>
      prev.map((h) => (h.id === id ? { ...h, isPublic: !h.isPublic } : h))
    );
  };
  // -------------------------------------------------------------------------

  const displayIp =
    vpnIp || (lanHostAddress ? lanHostAddress.replace(/:\d+$/, '') : '');

  const handleCopyIp = () => {
    if (displayIp) {
      navigator.clipboard.writeText(displayIp);
      pushToast({
        sender: 'Sistema',
        color: '#3b82f6',
        type: 'text',
        content: 'Endereço IP copiado para a área de transferência!',
      });
    }
  };

  const handleSelectSpecial = (role: string | null) => {
    if (isOfflineHost) {
      setLocalClaim(role);
    } else {
      if (role) claimSheet(clientId, role);
      else useLanStore.getState().releaseSheet(clientId);
    }
    useCharacterStore.getState().clearCharacter();
    setIsSelectionModalOpen(false);
  };

  const handleLoadCharacter = async (sheetId: string) => {
    if (isOfflineHost) {
      setLocalClaim(sheetId);
    } else {
      claimSheet(clientId, sheetId);
    }
    try {
      const document = await gameClient.loadSheet(sheetId);
      loadCharacter(document, sheetId);
      setIsSelectionModalOpen(false);
    } catch (error) {
      console.error(`Failed to load the sheet "${sheetId}":`, error);
      pushToast({
        sender: 'Sistema',
        color: '#ae2c12',
        type: 'text',
        content: 'Não foi possível carregar a ficha. Tente novamente.',
      });
    }
  };

  useEffect(() => {
    if (!isHosting || isLanOpen) {
      const address = isHosting ? '127.0.0.1' : lanHostAddress || '127.0.0.1';
      connect(address, {
        clientId,
        username: username || 'Unknown',
        color: identityColor,
      });
    }
  }, [
    connect,
    isHosting,
    isLanOpen,
    lanHostAddress,
    clientId,
    username,
    identityColor,
  ]);

  useEffect(() => {
    if (isLanOpen && connectionStatus === 'online' && localClaim) {
      claimSheet(clientId, localClaim);
    }
  }, [isLanOpen, connectionStatus, localClaim, clientId, claimSheet]);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        setIsRollerOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  useEffect(() => {
    updateIdentity({
      clientId,
      username: username || 'Unknown',
      color: identityColor,
    });
  }, [identityColor, clientId, username, updateIdentity]);

  useEffect(() => {
    if (!isHosting) return;
    let cancelled = false;

    gameClient
      .listSheets()
      .then((available) => {
        if (!cancelled) setSheets(available);
      })
      .catch((error) => console.error('Failed to list the party:', error));

    return () => {
      cancelled = true;
    };
  }, [isHosting, setSheets]);

  const pushToast = (toast: any) =>
    setToasts((prev) =>
      [...prev, { ...toast, toastId: Date.now() + Math.random() }].slice(-3)
    );

  const prevMsgCount = useRef(messages.length);
  const isChatOpenRef = useRef(isChatOpen);

  useEffect(() => {
    isChatOpenRef.current = isChatOpen;
  }, [isChatOpen]);

  useEffect(() => {
    if (messages.length > prevMsgCount.current) {
      if (!isChatOpenRef.current && prevMsgCount.current > 0) {
        pushToast(messages[messages.length - 1]);
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
  const hasConditions =
    (character && character.active_effects.length > 0) || ajudado;

  return (
    <div
      className='fixed inset-0 select-none overflow-hidden bg-zinc-950 font-sans text-zinc-200'
      style={{ '--theme-color': themeColor } as React.CSSProperties}
    >
      {!isHosting && connectionStatus !== 'online' && (
        <div className='absolute inset-0 z-[100] flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm'>
          <div className='flex flex-col items-center gap-6 rounded border border-zinc-800 bg-zinc-950 p-8 shadow-2xl'>
            {connectionStatus === 'connecting' && (
              <div className='h-10 w-10 animate-spin rounded-full border-4 border-zinc-700 border-t-blue-500'></div>
            )}
            <div className='text-center'>
              <h3 className='font-serif text-xl font-bold tracking-widest text-white'>
                {connectionStatus === 'connecting'
                  ? 'CONECTANDO'
                  : 'CONEXÃO PERDIDA'}
              </h3>
              <p className='mt-2 text-sm text-zinc-500'>
                {connectionStatus === 'connecting'
                  ? `Tentando alcançar ${displayIp}...`
                  : 'Não foi possível se comunicar com o servidor da mesa.'}
              </p>
            </div>
            <button
              onClick={() => leaveGame()}
              className='mt-4 rounded bg-zinc-800 px-6 py-2 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-zinc-700 hover:text-red-400'
            >
              Cancelar / Sair
            </button>
          </div>
        </div>
      )}

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
            {isTrueGM && (
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
              onClick={() => setIsHandoutListOpen(!isHandoutListOpen)}
              className={`rounded-sm p-2 transition-colors ${
                isHandoutListOpen
                  ? 'bg-zinc-900 text-[var(--theme-color)]'
                  : 'text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300'
              } ${!isTrueGM ? 'mt-2' : ''}`}
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
            <div
              onClick={isHosting && isLanOpen ? handleCopyIp : undefined}
              className={`flex items-center gap-2 ${isHosting && isLanOpen ? 'cursor-pointer text-zinc-400 transition-colors hover:text-white' : 'text-zinc-400'}`}
              title={
                isHosting && isLanOpen ? 'Clique para copiar o IP' : undefined
              }
            >
              <Wifi
                size={14}
                style={{
                  color:
                    isLanOpen || !isHosting ? 'var(--theme-color)' : '#71717a',
                }}
              />
              <span className='font-mono text-xs tracking-wider'>
                {!isHosting
                  ? displayIp || 'LAN CLIENT'
                  : isLanOpen
                    ? displayIp || 'LAN HOST'
                    : 'OFFLINE'}
              </span>
            </div>

            <div className='relative ml-2 border-l border-zinc-700 pl-2'>
              <button
                onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                className='text-zinc-500 transition-colors hover:text-white'
              >
                <Settings size={14} />
              </button>
              {isSettingsOpen && (
                <div className='absolute right-0 top-full z-50 mt-3 w-56 rounded border border-zinc-800 bg-[#0a0a0a] py-1 shadow-2xl'>
                  {isHosting && (
                    <div className='border-b border-zinc-800/50 px-4 py-3'>
                      <span className='mb-1 block text-[10px] font-bold uppercase tracking-widest text-zinc-500'>
                        IP da VPN (ZeroTier)
                      </span>
                      <input
                        type='text'
                        value={vpnIp || ''}
                        onChange={(e) => setVpnIp(e.target.value)}
                        placeholder='Automático'
                        className='w-full rounded border border-zinc-700 bg-black px-2 py-1.5 font-mono text-xs text-white outline-none transition-colors focus:border-[var(--theme-color)]'
                      />
                    </div>
                  )}
                  {isHosting && !isLanOpen && (
                    <button
                      onClick={() => {
                        setIsSettingsOpen(false);
                        void openLan();
                      }}
                      className='w-full px-4 py-3 text-left text-xs font-bold uppercase tracking-widest text-blue-400 transition-colors hover:bg-zinc-900 hover:text-blue-300'
                    >
                      Abrir para LAN
                    </button>
                  )}
                  {isHosting && isLanOpen && (
                    <button
                      onClick={() => {
                        setIsSettingsOpen(false);
                        handleCopyIp();
                      }}
                      className='flex w-full items-center justify-between border-b border-zinc-800/50 px-4 py-3 text-left text-xs font-bold uppercase tracking-widest text-zinc-300 transition-colors hover:bg-zinc-900 hover:text-white'
                    >
                      Copiar IP <Copy size={14} />
                    </button>
                  )}
                  {isHosting && isLanOpen && (
                    <button
                      onClick={() => {
                        setIsSettingsOpen(false);
                        void closeLan();
                      }}
                      className='w-full px-4 py-3 text-left text-xs font-bold uppercase tracking-widest text-yellow-500 transition-colors hover:bg-zinc-900 hover:text-yellow-400'
                    >
                      Fechar LAN
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setIsSettingsOpen(false);
                      void leaveGame();
                    }}
                    className={`w-full px-4 py-3 text-left text-xs font-bold uppercase tracking-widest text-red-500 transition-colors hover:bg-zinc-900 hover:text-red-400 ${isHosting ? 'border-t border-zinc-800/50' : ''}`}
                  >
                    Sair para o Menu
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className='flex gap-2'>
            {displayRoster.map((player) => (
              <div
                key={player.client_id}
                className={`flex h-8 w-8 items-center justify-center rounded-sm border bg-zinc-800 text-xs font-bold shadow-lg transition-colors ${player.client_id === clientId ? 'shadow-[0_0_10px_currentColor]' : ''}`}
                style={{ color: player.color, borderColor: player.color }}
                title={`${player.username} ${player.client_id === clientId ? '(Você)' : ''}`}
              >
                {getInitials(player.username)}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* DRAGGABLE HANDOUT LIST */}
      {isHandoutListOpen && (
        <DraggableWindow
          title='Handouts'
          onClose={() => setIsHandoutListOpen(false)}
          initialX={window.innerWidth - 340}
          initialY={80}
          width='w-72'
        >
          <div className='flex max-h-[400px] flex-col overflow-y-auto'>
            {visibleHandouts.map((h) => (
              <div
                key={h.id}
                className='flex flex-col gap-2 border-b border-zinc-800/50 px-3 py-2.5 text-sm text-zinc-400 transition-colors hover:bg-zinc-900/50'
              >
                <div
                  className='flex cursor-pointer items-center gap-2 transition-colors hover:text-white'
                  onClick={() =>
                    !openHandoutIds.includes(h.id) &&
                    setOpenHandoutIds((prev) => [...prev, h.id])
                  }
                >
                  <div
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${h.isPublic ? 'bg-green-500' : 'bg-zinc-600'}`}
                  />
                  <span className='truncate'>{h.title}</span>
                </div>
                {isTrueGM && (
                  <div className='ml-3 flex gap-1'>
                    <button
                      onClick={() => toggleHandoutPublic(h.id)}
                      className={`flex items-center gap-1 rounded px-2 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors ${h.isPublic ? 'bg-green-950/50 text-green-400 hover:bg-green-900' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
                    >
                      {h.isPublic ? <Eye size={10} /> : <EyeOff size={10} />}
                      {h.isPublic ? 'Público' : 'Privado'}
                    </button>
                  </div>
                )}
              </div>
            ))}
            {visibleHandouts.length === 0 && (
              <div className='p-4 text-center text-xs uppercase tracking-widest text-zinc-600'>
                Nenhum handout disponível
              </div>
            )}
          </div>
        </DraggableWindow>
      )}

      {/* DRAGGABLE OPEN HANDOUT CONTENT WINDOWS */}
      {openHandoutIds.map((id, index) => {
        const handout = handouts.find((h) => h.id === id);
        if (!handout) return null;
        if (!isTrueGM && !handout.isPublic) return null; // Fallback safety

        return (
          <DraggableWindow
            key={id}
            title={handout.title}
            onClose={() =>
              setOpenHandoutIds((prev) => prev.filter((i) => i !== id))
            }
            initialX={150 + index * 30}
            initialY={150 + index * 30}
            width='w-96'
          >
            <div className='max-h-[600px] overflow-y-auto bg-zinc-950 p-4 text-sm text-zinc-300'>
              {handout.type === 'text' ? (
                <p className='whitespace-pre-wrap leading-relaxed'>
                  {handout.content}
                </p>
              ) : (
                <img
                  src={handout.content}
                  alt={handout.title}
                  className='w-full rounded border border-zinc-800 object-contain'
                  draggable={false}
                />
              )}
            </div>
          </DraggableWindow>
        );
      })}

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
                    =
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
          {/* UPDATED SHEET SELECTOR BUTTON */}
          <button
            onClick={() => setIsSelectionModalOpen(true)}
            className='flex w-32 cursor-pointer items-center justify-between gap-1 rounded-sm border border-zinc-800 bg-black/80 px-2 py-1.5 text-left transition-colors hover:border-zinc-600'
          >
            <span
              className='truncate font-serif text-xs font-bold uppercase tracking-widest text-zinc-300'
              style={{ color: 'var(--theme-color)' }}
              title={charName}
            >
              {charName}
            </span>
            <ChevronDown size={14} className='shrink-0 text-zinc-600' />
          </button>

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

          {character && (
            <div className='flex flex-col gap-2 rounded-sm border border-zinc-800/80 bg-black/80 p-4 shadow-2xl backdrop-blur-sm'>
              <ResourceBar
                label='PV'
                current={character.resources.hp.current || 0}
                max={character.resources.hp.max || 0}
                colorClass='text-red-500'
                activeColorClass='bg-red-500'
                onUpdate={(delta: number) => applyResourceChange('hp', delta)}
              />
              <ResourceBar
                label='PD'
                current={character.resources.dp.current || 0}
                max={character.resources.dp.max || 0}
                colorClass='text-indigo-500'
                activeColorClass='bg-indigo-500'
                onUpdate={(delta: number) => applyResourceChange('dp', delta)}
              />
            </div>
          )}
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
          onSelectSpecial={handleSelectSpecial}
          sheets={sheets}
          roster={roster}
          clientId={clientId}
          isOfflineHost={isOfflineHost}
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
