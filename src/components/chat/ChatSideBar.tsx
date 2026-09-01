import { useChatStore } from '../../store/chatStore';
import { RollEquation } from './RollEquation.tsx';

export function ChatSidebar() {
  const { messages } = useChatStore();

  return (
    <aside className='z-10 flex w-[320px] flex-col border-r border-neutral-700 bg-[#121212]'>
      <div className='border-b border-neutral-700 bg-black p-4'>
        <h2 className='text-lg font-bold'>Registro de Eventos</h2>
      </div>

      <div className='flex flex-1 flex-col gap-4 overflow-y-auto p-4'>
        {messages.map((msg) => (
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
                  {msg.rollLabel}
                </span>
                <RollEquation result={msg.rollResult} />
              </>
            )}
          </div>
        ))}
      </div>
    </aside>
  );
}
