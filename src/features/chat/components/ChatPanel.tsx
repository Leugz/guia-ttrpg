import { useState, useRef, useEffect } from 'react';
import {
  Send,
  MessageSquare,
  Dices,
  EyeOff,
  Sparkles,
  Activity,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  X,
} from 'lucide-react';
import { useChatStore } from '../chatStore';
import {
  useCharacterStore,
  getProfileColor,
} from '../../character-sheet/characterStore';
import { useSessionStore } from '../../session/sessionStore';
import { useLanStore } from '../../session/net/lanStore';
import { DieShape } from '../../../shared/components/DieShape';
import { GM_COLOR } from '../../character-sheet/characterStore';

const TextMessage = ({ msg }: { msg: any }) => {
  const isGuestOrGM = msg.sender === 'Guest' || msg.sender === 'Mestre';
  const primaryName = isGuestOrGM && msg.username ? msg.username : msg.sender;
  const secondaryName = isGuestOrGM && msg.username ? msg.sender : msg.username;

  const timeString = msg.timestamp
    ? new Date(msg.timestamp).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Agora';

  return (
    <div
      className='mb-2 rounded-sm border-l-2 bg-[#121212] px-4 py-3'
      style={{ borderColor: msg.color }}
    >
      <div className='mb-1 flex items-baseline gap-2'>
        <span
          className='font-serif text-sm font-bold tracking-wider'
          style={{ color: msg.color }}
        >
          {primaryName}
        </span>
        {secondaryName && primaryName !== secondaryName && (
          <span className='font-mono text-xs text-zinc-600'>
            ({secondaryName})
          </span>
        )}
        <span className='ml-auto text-[10px] text-zinc-700'>{timeString}</span>
      </div>
      {msg.rollLabel && (
        <span className='mb-1 block text-xs uppercase tracking-wider text-blue-400'>
          {msg.rollLabel}
        </span>
      )}
      <div className='text-sm leading-relaxed text-zinc-300'>{msg.content}</div>
    </div>
  );
};

const RollMessage = ({ rollMsg }: { rollMsg: any }) => {
  const result = rollMsg.rollResult;
  if (!result) return null;

  const countedResults = result.dice
    .filter((d: any) => d.counted)
    .map((d: any) => d.value);

  const isGuestOrGM = rollMsg.sender === 'Guest' || rollMsg.sender === 'Mestre';
  const primaryName =
    isGuestOrGM && rollMsg.username ? rollMsg.username : rollMsg.sender;
  const secondaryName =
    isGuestOrGM && rollMsg.username ? rollMsg.sender : rollMsg.username;

  const timeString = rollMsg.timestamp
    ? new Date(rollMsg.timestamp).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Agora';

  return (
    <div
      className={`group relative mb-2 rounded-sm border-l-2 bg-[#121212] px-4 py-3 ${result.secret ? 'border-dashed border-zinc-700' : ''}`}
      style={{ borderColor: result.secret ? undefined : rollMsg.color }}
    >
      {result.secret && (
        <div className='absolute right-2 top-2 flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-zinc-600'>
          <EyeOff size={12} /> Apenas Mestre
        </div>
      )}
      <div className='mb-2 flex items-baseline gap-2'>
        <span
          className='font-serif text-sm font-bold tracking-wider'
          style={{ color: rollMsg.color }}
        >
          {primaryName}
        </span>
        {secondaryName && primaryName !== secondaryName && (
          <span className='font-mono text-xs text-zinc-600'>
            ({secondaryName})
          </span>
        )}
        <span className='ml-auto text-[10px] text-zinc-700'>{timeString}</span>
      </div>
      <div className='mb-4'>
        <div className='text-sm font-bold text-zinc-200'>
          {rollMsg.rollLabel}
        </div>
      </div>
      <div className='mb-5 flex flex-wrap items-center gap-4'>
        {result.dice.map((d: any, i: number) => (
          <DieShape
            key={i}
            sides={d.sides}
            value={d.value}
            className='h-14 w-14 text-2xl'
            colorClass={
              !d.counted
                ? 'text-zinc-500'
                : result.is_critical_success && d.value >= 6
                  ? 'text-red-500'
                  : 'text-white'
            }
            isDropped={!d.counted}
          />
        ))}
      </div>
      <div className='flex items-center justify-between border-t border-zinc-800/50 pt-3'>
        <div className='font-mono text-sm text-zinc-500'>
          ({countedResults.join(' + ')})
        </div>
        <div className='flex items-center gap-3'>
          <div className='flex flex-col gap-1'>
            <span className='flex items-center justify-end gap-1 text-[10px] text-zinc-400'>
              RA <ArrowUp size={10} className='text-green-500' />{' '}
              {result.highest}
            </span>
            <span className='flex items-center justify-end gap-1 text-[10px] text-zinc-400'>
              RB <ArrowDown size={10} className='text-red-500' />{' '}
              {result.lowest}
            </span>
          </div>
          <div className='flex items-center gap-2'>
            <span className='mt-1 text-xs font-bold uppercase tracking-widest text-zinc-500'>
              Total
            </span>
            <span
              className={`font-serif text-4xl font-black ${result.is_critical_success ? 'text-red-500 drop-shadow-[0_0_8px_rgba(220,38,38,0.5)]' : result.is_critical_failure ? 'text-zinc-600' : 'text-zinc-200'}`}
            >
              {result.total_sum}
            </span>
          </div>
        </div>
      </div>
      {result.is_critical_success && (
        <div className='mt-3 flex items-center justify-center gap-2 rounded-sm border border-red-900/50 bg-red-950/30 px-2 py-1 text-xs font-bold uppercase tracking-widest text-red-500'>
          <Sparkles size={14} /> Sucesso Crítico <Sparkles size={14} />
        </div>
      )}
    </div>
  );
};

export function ChatPanel({
  isOpen,
  onClose,
  onOpenRoller,
}: {
  isOpen: boolean;
  onClose: () => void;
  onOpenRoller: () => void;
}) {
  const { messages, addMessage } = useChatStore();
  const { character } = useCharacterStore();
  const { username, clientId } = useSessionStore();
  const { roster } = useLanStore();

  const [filter, setFilter] = useState('default');
  const [inputText, setInputText] = useState('');

  // FIX: Replace scrollIntoView with direct scrollTop to prevent horizontal shifting
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop =
        scrollContainerRef.current.scrollHeight;
    }
  }, [messages, filter, isOpen]);

  const filteredMessages = messages.filter((msg) => {
    if (filter === 'messages') return msg.type === 'text' && !msg.rollLabel;
    if (filter === 'dice')
      return msg.type === 'roll' || (msg.type === 'text' && !!msg.rollLabel);
    return true;
  });

  const currentPlayer = roster.find((p) => p.client_id === clientId);
  const claimedSheet = currentPlayer?.claimed_sheet;

  const identityColor = character
    ? getProfileColor(character.profile)
    : claimedSheet === '__GM__'
      ? GM_COLOR
      : '#71717a';

  const charName = character
    ? character.name
    : claimedSheet === '__GM__'
      ? 'Mestre'
      : 'Guest';

  const handleSend = () => {
    if (!inputText.trim()) return;

    addMessage({
      sender: charName,
      username: username || undefined,
      color: identityColor,
      type: 'text',
      content: inputText.trim(),
    });

    setInputText('');
  };

  return (
    <div
      className={`pointer-events-auto absolute right-0 top-0 z-50 flex h-full w-full max-w-sm transform flex-col border-l border-zinc-900 bg-[#0a0a0a] shadow-[0_0_50px_rgba(0,0,0,0.8)] transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
    >
      <div className='relative z-10 flex shrink-0 flex-col gap-3 border-b border-zinc-800/80 bg-zinc-950 p-4'>
        <div className='flex items-center justify-between'>
          <h2 className='font-serif text-lg font-black uppercase tracking-widest text-zinc-200'>
            Registro
          </h2>
          <button
            onClick={onClose}
            className='text-zinc-500 transition-colors hover:text-white'
          >
            <X size={18} />
          </button>
        </div>
        <div className='flex gap-1 rounded-sm bg-zinc-900 p-1'>
          <button
            onClick={() => setFilter('default')}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-sm py-1.5 text-xs transition-colors ${filter === 'default' ? 'bg-zinc-800 text-zinc-200' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            <Activity size={12} /> Geral
          </button>
          <button
            onClick={() => setFilter('messages')}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-sm py-1.5 text-xs transition-colors ${filter === 'messages' ? 'bg-zinc-800 text-zinc-200' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            <MessageSquare size={12} /> Textos
          </button>
          <button
            onClick={() => setFilter('dice')}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-sm py-1.5 text-xs transition-colors ${filter === 'dice' ? 'bg-zinc-800 text-zinc-200' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            <Dices size={12} /> Dados
          </button>
        </div>
      </div>

      {/* Container utilizing the new scroll fix */}
      <div
        ref={scrollContainerRef}
        className='scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent relative z-10 flex flex-1 flex-col gap-1 overflow-y-auto p-3'
      >
        {filteredMessages.length === 0 ? (
          <div className='flex h-full flex-col items-center justify-center text-zinc-600 opacity-50'>
            <AlertTriangle size={32} className='mb-2' />
            <span className='font-serif text-sm uppercase tracking-widest'>
              Nenhum Registro
            </span>
          </div>
        ) : (
          filteredMessages.map((msg) =>
            msg.type === 'text' ? (
              <TextMessage key={msg.id} msg={msg} />
            ) : (
              <RollMessage key={msg.id} rollMsg={msg} />
            )
          )
        )}
      </div>

      <div className='relative z-10 shrink-0 border-t border-zinc-800 bg-zinc-950 p-3'>
        <div className='group relative'>
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder='Mensagem...'
            className='min-h-[80px] w-full resize-none rounded-sm border border-zinc-800 bg-zinc-900 p-3 pr-[70px] text-sm text-zinc-300 outline-none transition-all placeholder:text-zinc-600 focus:border-zinc-700'
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <div className='absolute bottom-2 right-2 flex gap-1'>
            <button
              onClick={onOpenRoller}
              title='Rolar Dados (Ctrl+R)'
              className='rounded p-1.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-white'
            >
              <Dices size={16} />
            </button>
            <button
              onClick={handleSend}
              disabled={!inputText.trim()}
              className='rounded bg-zinc-800 p-1.5 text-zinc-200 shadow-md transition-colors hover:bg-zinc-700 hover:text-white disabled:bg-zinc-900 disabled:text-zinc-700 disabled:opacity-50'
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
