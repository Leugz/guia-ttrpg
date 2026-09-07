import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Copy,
  Music,
  Volume2,
} from 'lucide-react';
import { useChatStore } from '../chat/chatStore';
import {
  useCharacterStore,
  getProfileColor,
  GM_COLOR,
} from '../character-sheet/characterStore';
import { useSessionStore } from '../session/sessionStore';
import {
  markBoardLoaded,
  snapshotBoard,
  useLanStore,
} from '../session/net/lanStore';
import * as gameClient from '../session/net/gameClient';
import type { LanPlayer, SheetSummary } from '../session/net/protocol';
import { ChatPanel } from '../chat/components/ChatPanel';
import { CharacterSheet } from '../character-sheet/components/CharacterSheet';
import { FreeDiceRoller } from '../dice/components/FreeDiceRoller';
import {
  GameBoard,
  TOKEN_DRAG_MIME,
  type TokenDragPayload,
} from '../map/components/GameBoard';
import { MapSelector } from '../map/components/MapSelector';
import { DieShape } from '../../shared/components/DieShape';
import { tokenMotion } from '../map/tokenMotion';
import { JukeboxPanel } from '../jukebox/components/JukeboxPanel';
import { useJukeboxStore } from '../jukebox/jukeboxStore';
import { DraggableWindow } from './components/DraggableWindow';
import { GmPartyTracker } from './components/GmPartyTracker';
import { HandoutWindowManager } from './components/HandoutWindowManager';
import { TrackerResourceBar } from './components/TrackerResourceBar';
import { useGlobalShortcuts } from './hooks/useGlobalShortcuts';
import { getInitials } from '../../shared/lib/initials';

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
  onSelectSpecial,
  sheets,
  roster,
  clientId,
  isOfflineHost,
  localClaim,
}: {
  onClose: () => void;
  onSelect: (sheetId: string) => void;
  onSelectSpecial: (role: string | null) => void;
  sheets: SheetSummary[];
  roster: LanPlayer[];
  clientId: string;
  isOfflineHost: boolean;
  localClaim: string | null;
}) => {
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
};

export function VttApp() {
  const [isJukeboxOpen, setIsJukeboxOpen] = useState(false);
  const localVolume = useJukeboxStore((state) => state.localVolume);
  const setLocalVolume = useJukeboxStore((state) => state.setLocalVolume);
  const messages = useChatStore((state) => state.messages);
  const roster = useLanStore((state) => state.roster);
  const sheets = useLanStore((state) => state.sheets);
  const setSheets = useLanStore((state) => state.setSheets);

  const setHandouts = useLanStore((state) => state.setHandouts);
  const setMaps = useLanStore((state) => state.setMaps);

  const connect = useLanStore((state) => state.connect);
  const disconnect = useLanStore((state) => state.disconnect);
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
    activeGameId,
    activeGamePath,
  } = useSessionStore();

  // --- MESA SALVA: cada mesa guarda o próprio tabuleiro em board.json ---
  //
  // Both effects below only run while the LAN is closed. Once a table is open
  // the Rust host owns the file: it loaded the board as it bound the port and
  // it has every player's positions, not just this window's.
  const tokens = useLanStore((state) => state.tokens);

  useEffect(() => {
    if (!isHosting || isLanOpen || !activeGameId) return;

    let cancelled = false;

    gameClient
      .loadBoard()
      .then((saved) => {
        if (cancelled) return;
        // Never clobber a board that is already live on screen.
        if (saved.length > 0 && useLanStore.getState().tokens.length === 0) {
          tokenMotion.seed(saved);
          useLanStore.setState({ tokens: saved });
        }
        // Only now may this window save: until the read came back it had no
        // idea what was on the table.
        markBoardLoaded();
      })
      .catch((error) => {
        console.error('Falha ao carregar o tabuleiro:', error);
      });

    return () => {
      cancelled = true;
    };
  }, [isHosting, isLanOpen, activeGameId]);

  useEffect(() => {
    if (!isHosting || isLanOpen || !activeGameId) return;

    // Captured, so a save in flight while the table closes still names the
    // game it belongs to.
    const gameRoot = activeGamePath;
    const save = () => {
      const board = snapshotBoard();
      if (!board) return;
      gameClient.saveBoard(board, gameRoot).catch((error) => {
        console.error('Falha ao salvar o tabuleiro:', error);
      });
    };

    save(); // Toda vez que uma miniatura for colocada, movida ou removida
    const interval = setInterval(save, 120000); // Rede de segurança
    window.addEventListener('beforeunload', save);
    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', save);
    };
  }, [tokens, isHosting, isLanOpen, activeGameId, activeGamePath]);

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
  const [isMapSelectorOpen, setIsMapSelectorOpen] = useState(false);
  const [toasts, setToasts] = useState<any[]>([]);

  const [isHandoutListOpen, setIsHandoutListOpen] = useState(false);

  // -------------------------------------------------------------------------
  // Click-Away Listeners
  // -------------------------------------------------------------------------
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const path = event.composedPath();

      const isMapBtn = path.some(
        (el) => (el as HTMLElement).id === 'map-selector-btn'
      );
      const isMapMenu = path.some(
        (el) => (el as HTMLElement).id === 'map-selector-menu'
      );
      if (isMapSelectorOpen && !isMapBtn && !isMapMenu) {
        setIsMapSelectorOpen(false);
      }

      const isSetBtn = path.some(
        (el) => (el as HTMLElement).id === 'settings-btn'
      );
      const isSetMenu = path.some(
        (el) => (el as HTMLElement).id === 'settings-menu'
      );
      if (isSettingsOpen && !isSetBtn && !isSetMenu) {
        setIsSettingsOpen(false);
      }

      const isChatBtn = path.some(
        (el) => (el as HTMLElement).id === 'chat-open-btn'
      );
      const isChatPanel = path.some(
        (el) => (el as HTMLElement).id === 'chat-panel'
      );
      if (isChatOpen && !isChatBtn && !isChatPanel) {
        setIsChatOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMapSelectorOpen, isSettingsOpen, isChatOpen]);

  // -------------------------------------------------------------------------
  // Core Connections
  // -------------------------------------------------------------------------

  const activeSheetId = useCharacterStore((state) => state.activeSheetId);

  const [resolvedPortrait, setResolvedPortrait] = useState<{
    sheetId: string;
    url: string;
  } | null>(null);

  useEffect(() => {
    if (!activeSheetId && !isTrueGM) return;
    let cancelled = false;
    const requestTarget = isTrueGM ? '__GM__' : activeSheetId!;

    gameClient
      .getPortraitUrl(requestTarget)
      .then((url) => {
        if (!cancelled) setResolvedPortrait({ sheetId: requestTarget, url });
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [activeSheetId, isTrueGM]);

  const portraitUrl =
    resolvedPortrait &&
    resolvedPortrait.sheetId === (isTrueGM ? '__GM__' : activeSheetId)
      ? resolvedPortrait.url
      : null;

  const myTokenId =
    isTrueGM || activeSheetId
      ? `token:${clientId}:${isTrueGM ? '__GM__' : activeSheetId}`
      : null;

  useEffect(() => {
    if (!myTokenId || (!character && !isTrueGM)) return;
    const hpDown = character
      ? (character.resources.hp.current || 0) <= 0
      : false;
    const dpDown = character
      ? (character.resources.dp.current || 0) <= 0
      : false;
    const hpFailed = character
      ? Boolean(character.death_saves?.hp?.failed)
      : false;
    const dpFailed = character
      ? Boolean(character.death_saves?.dp?.failed)
      : false;

    const grayscale = hpFailed || dpFailed;
    const owesHp = hpDown && !hpFailed;
    const owesDp = dpDown && !dpFailed;
    const saveIndicator = grayscale
      ? null
      : owesHp && owesDp
        ? 'both'
        : owesHp
          ? 'hp'
          : owesDp
            ? 'dp'
            : null;
    gameClient.setTokenState(clientId, myTokenId, grayscale, saveIndicator);
  }, [myTokenId, clientId, character, isTrueGM]);

  const handleTokenDragStart = (event: React.DragEvent<HTMLDivElement>) => {
    if (isTrueGM || !character || !activeSheetId) return;

    const payload: TokenDragPayload = {
      sheetId: activeSheetId,
      label: character.name,
      color: identityColor,
    };
    event.dataTransfer.setData(TOKEN_DRAG_MIME, JSON.stringify(payload));
    event.dataTransfer.effectAllowed = 'copy';
  };

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
    if (isHosting) {
      if (isLanOpen) {
        connect('127.0.0.1', {
          clientId,
          username: username || 'Unknown',
          color: identityColor,
        });
      } else {
        // CORREÇÃO: O mestre mantém o estado da tela, apenas a porta de rede é fechada!
        useLanStore.getState().disconnectSocketOnly();
      }
    } else {
      if (lanHostAddress) {
        connect(lanHostAddress, {
          clientId,
          username: username || 'Unknown',
          color: identityColor,
        });
      } else {
        disconnect(); // Saiu de vez
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHosting, isLanOpen, lanHostAddress]);

  useEffect(() => {
    if (isLanOpen && connectionStatus === 'online' && localClaim) {
      claimSheet(clientId, localClaim);
    }
  }, [isLanOpen, connectionStatus, localClaim, clientId, claimSheet]);

  const toggleRoller = useCallback(() => setIsRollerOpen((open) => !open), []);
  const toggleChat = useCallback(() => setIsChatOpen((open) => !open), []);
  const toggleSheet = useCallback(() => setIsSheetOpen((open) => !open), []);

  useGlobalShortcuts({
    onToggleRoller: toggleRoller,
    onToggleChat: toggleChat,
    onToggleSheet: toggleSheet,
    canOpenSheet: Boolean(character),
  });

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
      .catch((error) => console.error(error));
    gameClient
      .listHandouts()
      .then((available) => {
        if (!cancelled) setHandouts(available);
      })
      .catch((error) => console.error(error));
    gameClient
      .listMaps()
      .then((available) => {
        if (!cancelled) setMaps(available);
      })
      .catch((error) => console.error(error));

    return () => {
      cancelled = true;
    };
  }, [isHosting, setSheets, setHandouts, setMaps]);

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
        const newMessages = messages.slice(prevMsgCount.current);
        newMessages.forEach((msg) => pushToast(msg));
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
              className='mt-4 rounded bg-zinc-800 px-6 py-2 text-xs font-bold uppercase tracking-widest text-white outline-none transition-colors hover:bg-zinc-700 hover:text-red-400 focus:outline-none'
            >
              Cancelar / Sair
            </button>
          </div>
        </div>
      )}

      <div className='absolute inset-0 z-0'>
        <GameBoard
          clientId={clientId}
          isGM={isTrueGM}
          activeTool={activeTool}
          identityColor={identityColor}
        />
      </div>

      <div className='pointer-events-none absolute left-0 top-0 z-40 flex w-full items-start justify-between p-4'>
        <div className='pointer-events-auto flex gap-2'>
          <div className='flex w-fit flex-col gap-1 rounded-sm border border-zinc-900 bg-black/50 p-1.5 shadow-xl backdrop-blur-md'>
            <button
              onClick={() => setActiveTool('select')}
              className={`rounded-sm p-2 outline-none transition-colors focus:outline-none ${activeTool === 'select' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300'}`}
            >
              <MousePointer2 size={18} />
            </button>
            <button
              onClick={() => setActiveTool('ping')}
              className={`rounded-sm p-2 outline-none transition-colors focus:outline-none ${activeTool === 'ping' ? 'bg-zinc-900 text-[var(--theme-color)]' : 'text-zinc-500 hover:bg-zinc-900 hover:text-[var(--theme-color)]'}`}
            >
              <Crosshair size={18} />
            </button>
            <button
              onClick={() => setActiveTool('ruler')}
              className={`rounded-sm p-2 outline-none transition-colors focus:outline-none ${activeTool === 'ruler' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300'}`}
            >
              <Ruler size={18} />
            </button>
            {isTrueGM && (
              <>
                <button
                  id='map-selector-btn'
                  onClick={() => setIsMapSelectorOpen((open) => !open)}
                  className={`mt-2 rounded-sm p-2 outline-none transition-colors focus:outline-none ${isMapSelectorOpen ? 'bg-zinc-900 text-[var(--theme-color)]' : 'text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300'}`}
                >
                  <MapIcon size={18} />
                </button>
                <button
                  onClick={() => setIsJukeboxOpen(!isJukeboxOpen)}
                  className={`rounded-sm p-2 outline-none transition-colors focus:outline-none ${isJukeboxOpen ? 'bg-zinc-900 text-[var(--theme-color)]' : 'text-zinc-500 hover:bg-zinc-900 hover:text-[var(--theme-color)]'}`}
                  title='Jukebox'
                >
                  <Music size={18} />
                </button>
              </>
            )}
            <button
              onClick={() => setIsHandoutListOpen(!isHandoutListOpen)}
              className={`rounded-sm p-2 outline-none transition-colors focus:outline-none ${isHandoutListOpen ? 'bg-zinc-900 text-[var(--theme-color)]' : 'text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300'} ${!isTrueGM ? 'mt-2' : ''}`}
            >
              <FileText size={18} />
            </button>
          </div>

          {isTrueGM && isMapSelectorOpen && (
            <div id='map-selector-menu'>
              <MapSelector onClose={() => setIsMapSelectorOpen(false)} />
            </div>
          )}
        </div>

        <div className='pointer-events-auto flex flex-col items-end gap-2'>
          <div
            className='flex items-center gap-2 rounded-sm border border-zinc-800 bg-black/50 px-3 py-1.5 shadow-xl backdrop-blur-md'
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
                id='settings-btn'
                onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                className='text-zinc-500 outline-none transition-colors hover:text-white focus:outline-none'
              >
                <Settings size={14} />
              </button>
              {isSettingsOpen && (
                <div
                  id='settings-menu'
                  className='absolute right-0 top-full z-50 mt-3 w-56 rounded border border-zinc-800 bg-zinc-950/80 py-1 shadow-2xl backdrop-blur-md'
                >
                  <div className='border-b border-zinc-800/50 px-4 py-3'>
                    <div className='mb-2 flex items-center justify-between'>
                      <span className='flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-zinc-500'>
                        <Volume2 size={12} /> Volume da M sica
                      </span>
                      <span className='font-mono text-[10px] text-zinc-400'>
                        {Math.round(localVolume * 100)}%
                      </span>
                    </div>
                    <input
                      type='range'
                      min='0'
                      max='1'
                      step='0.01'
                      value={localVolume}
                      onChange={(e) =>
                        setLocalVolume(parseFloat(e.target.value))
                      }
                      className='w-full accent-[var(--theme-color)]'
                    />
                  </div>

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
                      className='w-full px-4 py-3 text-left text-xs font-bold uppercase tracking-widest text-blue-400 outline-none transition-colors hover:bg-zinc-900 hover:text-blue-300 focus:outline-none'
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
                      className='flex w-full items-center justify-between border-b border-zinc-800/50 px-4 py-3 text-left text-xs font-bold uppercase tracking-widest text-zinc-300 outline-none transition-colors hover:bg-zinc-900 hover:text-white focus:outline-none'
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
                      className='w-full px-4 py-3 text-left text-xs font-bold uppercase tracking-widest text-yellow-500 outline-none transition-colors hover:bg-zinc-900 hover:text-yellow-400 focus:outline-none'
                    >
                      Fechar LAN
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setIsSettingsOpen(false);
                      void leaveGame();
                    }}
                    className={`w-full px-4 py-3 text-left text-xs font-bold uppercase tracking-widest text-red-500 outline-none transition-colors hover:bg-zinc-900 hover:text-red-400 focus:outline-none ${isHosting ? 'border-t border-zinc-800/50' : ''}`}
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

      <HandoutWindowManager
        isGM={isTrueGM}
        clientId={clientId}
        roster={roster}
        isListOpen={isHandoutListOpen}
        onCloseList={() => setIsHandoutListOpen(false)}
      />

      {isJukeboxOpen && isTrueGM && (
        <DraggableWindow
          title='Jukebox'
          onClose={() => setIsJukeboxOpen(false)}
          initialX={84}
          initialY={140} // Positioned nicely below the toolbars
          initialWidth={300}
          initialHeight={355}
        >
          <JukeboxPanel />
        </DraggableWindow>
      )}

      <div className='pointer-events-none absolute bottom-28 right-6 z-[60] flex flex-col items-end gap-3'>
        {toasts.map((toast) => {
          // Lógica para destacar dados de Crítico na notificação
          const critValues = new Set<number>();
          if (toast.type === 'roll' && toast.rollResult?.is_critical_success) {
            const counts: Record<number, number> = {};
            toast.rollResult.dice.forEach((d: any) => {
              counts[d.value] = (counts[d.value] || 0) + 1;
            });
            Object.entries(counts).forEach(([val, count]) => {
              if (Number(val) >= 6 && count >= 2) {
                critValues.add(Number(val));
              }
            });
          }

          return (
            <div
              key={toast.toastId}
              className='animate-float-up-fade w-fit min-w-[340px] max-w-md rounded-sm border border-zinc-700 bg-black/80 px-4 py-3 shadow-2xl backdrop-blur-md'
            >
              {toast.type === 'text' ? (
                <div className='text-sm leading-relaxed'>
                  <span
                    className='font-serif font-bold tracking-wider'
                    style={{ color: toast.color }}
                  >
                    {toast.sender}:{' '}
                  </span>
                  <span className='text-zinc-200'>{toast.content}</span>
                </div>
              ) : (
                <div className='flex flex-col gap-3'>
                  <div className='text-sm leading-none'>
                    <span
                      className='font-serif font-bold tracking-wider'
                      style={{ color: toast.color }}
                    >
                      {toast.sender}:{' '}
                    </span>
                    <span className='font-bold tracking-wide text-white'>
                      {toast.rollLabel || 'Rolagem'}
                    </span>
                  </div>

                  {toast.rollResult && (
                    <div className='flex items-center justify-between'>
                      <div className='flex flex-wrap items-center gap-2 py-1'>
                        {toast.rollResult.dice.map((d: any, i: number) => (
                          <DieShape
                            key={i}
                            sides={d.sides}
                            value={d.value}
                            className='h-10 w-10 text-lg'
                            colorClass={
                              toast.rollResult.is_critical_success &&
                              critValues.has(d.value)
                                ? 'text-indigo-400'
                                : toast.rollResult.is_critical_failure
                                  ? 'text-red-500'
                                  : !d.counted
                                    ? 'text-zinc-500'
                                    : 'text-white'
                            }
                            isDropped={!d.counted}
                          />
                        ))}
                      </div>

                      <div className='ml-4 flex min-w-[70px] shrink-0 flex-col items-center justify-center border-l border-zinc-700/60 pl-4'>
                        <span className='mb-1 text-[10px] font-bold uppercase tracking-widest text-zinc-500'>
                          Total
                        </span>
                        <span
                          className={`font-serif text-3xl font-black leading-none ${
                            toast.rollResult.is_critical_success
                              ? 'text-indigo-400 drop-shadow-[0_0_8px_rgba(129,140,248,0.5)]'
                              : toast.rollResult.is_critical_failure
                                ? 'text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]'
                                : 'text-white'
                          }`}
                        >
                          {toast.rollResult.total_sum}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className='pointer-events-auto absolute bottom-6 left-6 z-10 flex items-end gap-4'>
        <div className='flex flex-col gap-2'>
          <button
            onClick={() => setIsSelectionModalOpen(true)}
            className='flex w-32 cursor-pointer items-center justify-between gap-1 rounded-sm border border-zinc-800 bg-black/50 px-2 py-1.5 text-left outline-none backdrop-blur-md transition-colors hover:border-zinc-600 focus:outline-none'
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
            draggable={!isTrueGM && Boolean(character)}
            onDragStart={handleTokenDragStart}
            className={`group relative h-32 w-32 shrink-0 rounded-sm transition-transform hover:scale-105 ${
              !isTrueGM && character
                ? 'cursor-grab active:cursor-grabbing'
                : 'cursor-pointer'
            } ${
              portraitUrl
                ? 'bg-transparent shadow-none'
                : 'border-2 border-zinc-800 bg-black/50 shadow-2xl backdrop-blur-md'
            }`}
          >
            {portraitUrl ? (
              <img
                src={portraitUrl}
                alt={charName}
                className='absolute inset-0 h-full w-full object-contain drop-shadow-[0_5px_15px_rgba(0,0,0,0.8)]'
                draggable={false}
              />
            ) : (
              <>
                <div className='absolute inset-0 bg-gradient-to-tr from-zinc-900 to-zinc-800 opacity-50' />
                <div className='absolute inset-x-2 bottom-0 h-3/4 rounded-t-[40%] border-x border-t border-zinc-700/50 bg-zinc-800/30' />
              </>
            )}
            <div className='absolute inset-0 flex flex-col items-center justify-center p-2 text-center opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100'>
              <span className='text-shadow-md mb-2 font-serif text-xs font-bold tracking-widest text-white'>
                {character ? 'ABRIR FICHA' : 'SELECIONAR FICHA'}
              </span>
              {!isTrueGM && character && (
                <span className='font-serif text-[10px] tracking-widest text-zinc-400'>
                  Arraste para o mapa
                </span>
              )}
            </div>
          </div>
        </div>

        {/* GM PARTY TRACKER (Visível apenas para o Mestre) */}
        <GmPartyTracker isGM={isTrueGM} roster={roster} />

        {/* Player Conditions & Trackers (Visível apenas para quem NÃO É mestre) */}
        {!isTrueGM && (
          <div className='flex flex-col gap-2'>
            {hasConditions && (
              <div className='flex w-fit items-center gap-2 rounded-sm border border-zinc-800 bg-black/50 px-3 py-1.5 shadow-md backdrop-blur-md'>
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
              <div className='flex flex-col gap-2 rounded-sm border border-zinc-800/80 bg-black/50 p-4 shadow-2xl backdrop-blur-md'>
                <TrackerResourceBar
                  label='PV'
                  current={character.resources.hp.current || 0}
                  max={character.resources.hp.max || 0}
                  colorClass='text-red-500'
                  activeColorClass='bg-red-500'
                  onUpdate={(delta: number) => applyResourceChange('hp', delta)}
                />
                <TrackerResourceBar
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
        )}
      </div>

      {!isChatOpen && (
        <div className='pointer-events-auto absolute bottom-6 right-6 z-40 flex gap-3'>
          <button
            id='chat-open-btn'
            onClick={() => setIsChatOpen(true)}
            className='group relative flex h-14 w-14 flex-col items-center justify-center gap-1 rounded-sm border border-zinc-800 bg-black/50 text-zinc-500 shadow-xl outline-none backdrop-blur-md transition-all hover:-translate-y-1 hover:border-zinc-500 focus:outline-none'
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
          localClaim={localClaim}
        />
      )}

      <div
        id='chat-panel'
        className={`pointer-events-auto absolute right-0 top-0 z-50 flex h-full w-full max-w-sm transform flex-col border-l border-zinc-900 bg-[#0a0a0a]/80 shadow-[0_0_50px_rgba(0,0,0,0.8)] backdrop-blur-md transition-transform duration-300 ease-in-out ${isChatOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <ChatPanel
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          onOpenRoller={() => setIsRollerOpen(true)}
        />
      </div>

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
