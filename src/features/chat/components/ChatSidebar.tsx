import { useState, useRef, useEffect, UIEvent } from 'react';
import { useChatStore } from '../chatStore';
import { useCharacterStore } from '../../character-sheet/characterStore';
import { RollEquation } from './RollEquation';

type ChatFilter = 'all' | 'messages' | 'dice';

export function ChatSidebar() {
  const { messages, addMessage } = useChatStore();
  const { character } = useCharacterStore();

  const [filter, setFilter] = useState<ChatFilter>('all');
  const [chatInput, setChatInput] = useState('');

  const scrollRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

  const filteredMessages = messages.filter((msg) => {
    if (filter === 'messages') return msg.type === 'text' && !msg.rollLabel;
    if (filter === 'dice')
      return msg.type === 'roll' || (msg.type === 'text' && !!msg.rollLabel);
    return true;
  });

  const handleScroll = (e: UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const distanceToBottom = scrollHeight - scrollTop - clientHeight;
    setIsAtBottom(distanceToBottom < 50);
  };

  useEffect(() => {
    if (isAtBottom && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [filteredMessages, isAtBottom]);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      setIsAtBottom(true);
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    addMessage({
      sender: character?.name || 'Jogador',
      type: 'text',
      content: chatInput.trim(),
    });

    setChatInput('');
    scrollToBottom();
  };

  return (
    <aside className='relative z-10 flex w-[320px] flex-col border-r border-neutral-700 bg-[#121212]'>
      <div className='border-b border-neutral-700 bg-black p-4'>
        <h2 className='mb-3 text-lg font-bold text-white'>
          Registro de Eventos
        </h2>

        <div className='flex gap-1 rounded bg-neutral-900 p-1'>
          <button
            onClick={() => setFilter('all')}
            className={`flex-1 rounded px-2 py-1 text-xs font-bold transition-colors ${filter === 'all' ? 'bg-neutral-700 text-white' : 'text-neutral-500 hover:text-neutral-300'}`}
          >
            Tudo
          </button>
          <button
            onClick={() => setFilter('messages')}
            className={`flex-1 rounded px-2 py-1 text-xs font-bold transition-colors ${filter === 'messages' ? 'bg-neutral-700 text-white' : 'text-neutral-500 hover:text-neutral-300'}`}
          >
            Mensagens
          </button>
          <button
            onClick={() => setFilter('dice')}
            className={`flex-1 rounded px-2 py-1 text-xs font-bold transition-colors ${filter === 'dice' ? 'bg-neutral-700 text-white' : 'text-neutral-500 hover:text-neutral-300'}`}
          >
            Dados
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className='flex flex-1 flex-col gap-4 overflow-y-auto p-4'
      >
        {filteredMessages.map((msg) => (
          <div
            key={msg.id}
            className='animate-fade-in rounded bg-neutral-800 p-3 shadow-md'
          >
            <span className='text-sm font-bold text-neutral-300'>
              {msg.sender}
            </span>

            {msg.type === 'roll' && msg.rollResult && (
              <>
                <span className='mt-1 block text-xs uppercase tracking-wider text-neutral-500'>
                  {msg.rollResult.secret ? '🤫 Rolagem Secreta' : msg.rollLabel}
                </span>
                <RollEquation result={msg.rollResult} />
              </>
            )}

            {msg.type === 'text' && (
              <>
                {msg.rollLabel && (
                  <span className='mt-1 block text-xs uppercase tracking-wider text-blue-400'>
                    {msg.rollLabel}
                  </span>
                )}
                <p
                  className={`mt-2 text-sm text-neutral-200 ${msg.rollLabel ? 'border-l-2 border-neutral-600 pl-2' : ''}`}
                >
                  {msg.content}
                </p>
              </>
            )}
          </div>
        ))}
      </div>

      {!isAtBottom && (
        <button
          onClick={scrollToBottom}
          className='absolute bottom-[80px] left-1/2 -translate-x-1/2 rounded-full bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-lg transition-transform hover:scale-105'
        >
          ↓ Novas Mensagens
        </button>
      )}

      {/* Chat Input Area */}
      <form
        onSubmit={handleSendMessage}
        className='border-t border-neutral-700 bg-black p-3'
      >
        <input
          type='text'
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          placeholder='Digite uma mensagem...'
          className='w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white placeholder-neutral-500 focus:border-blue-500 focus:outline-none'
        />
      </form>
    </aside>
  );
}
