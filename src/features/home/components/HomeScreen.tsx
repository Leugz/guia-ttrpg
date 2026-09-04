import { useState } from 'react';
import { Server, LogIn, Edit3, Plus, Play, Trash2 } from 'lucide-react';
import { useSessionStore } from '../../session/sessionStore';

export function HomeScreen() {
  const {
    username,
    setUsername,
    hostedGames,
    createGame,
    deleteGame,
    hostGame,
    joinGame,
  } = useSessionStore();

  const [ipInput, setIpInput] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(username || '');

  const [isCreatingGame, setIsCreatingGame] = useState(false);
  const [newGameName, setNewGameName] = useState('');

  const handleUpdateName = () => {
    if (nameInput.trim().length > 1) {
      setUsername(nameInput);
      setIsEditingName(false);
    }
  };

  const handleCreateGame = () => {
    if (newGameName.trim().length > 0) {
      createGame(newGameName.trim(), 'act_1');
      setIsCreatingGame(false);
      setNewGameName('');
    }
  };

  return (
    <div className='fixed inset-0 flex flex-col items-center justify-center bg-[#050505] p-4 sm:p-8'>
      <div className='absolute left-8 top-8 flex items-center gap-3'>
        <div className='flex flex-col'>
          <span className='text-[10px] font-bold uppercase tracking-widest text-zinc-500'>
            Agente Logado
          </span>
          {isEditingName ? (
            <div className='mt-1 flex items-center gap-2'>
              <input
                type='text'
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                className='border border-zinc-700 bg-black px-2 py-1 text-xs text-white outline-none focus:border-red-700'
              />
              <button
                onClick={handleUpdateName}
                className='bg-zinc-800 px-2 py-1 text-xs text-white hover:bg-zinc-700'
              >
                Salvar
              </button>
            </div>
          ) : (
            <div className='flex items-center gap-2'>
              <span className='font-serif text-lg font-black uppercase tracking-wider text-white'>
                {username}
              </span>
              <button
                onClick={() => setIsEditingName(true)}
                className='text-zinc-600 transition-colors hover:text-white'
              >
                <Edit3 size={14} />
              </button>
            </div>
          )}
        </div>
      </div>

      <div className='relative z-10 grid w-full max-w-5xl grid-cols-1 gap-8 md:grid-cols-2'>
        {/* HOST PANEL */}
        <div className='group relative flex h-[450px] flex-col overflow-hidden border border-zinc-800 bg-[#0a0a0a] p-8'>
          <div className='absolute left-0 top-0 h-1 w-full bg-red-900/50'></div>
          <div className='mb-6 flex shrink-0 items-center gap-3'>
            <Server size={24} className='text-red-600' />
            <h2 className='font-serif text-2xl font-black uppercase tracking-widest text-white'>
              Hospedar Jogo
            </h2>
          </div>

          {isCreatingGame ? (
            <div className='mt-auto flex flex-col gap-4'>
              <p className='mb-2 text-sm leading-relaxed text-zinc-500'>
                O sistema criará uma cópia independente do Ato 1 para esta mesa.
              </p>
              <label className='flex flex-col gap-2'>
                <span className='text-xs font-bold uppercase tracking-wider text-zinc-500'>
                  Nome da Mesa / Campanha
                </span>
                <input
                  type='text'
                  value={newGameName}
                  onChange={(e) => setNewGameName(e.target.value)}
                  placeholder='Ex: Grupo de Sábado'
                  className='border border-zinc-800 bg-black p-4 font-bold uppercase tracking-widest text-white outline-none transition-colors focus:border-red-700'
                />
              </label>
              <div className='mt-2 flex gap-3'>
                <button
                  onClick={() => setIsCreatingGame(false)}
                  className='flex-1 bg-zinc-900 p-4 font-bold uppercase tracking-widest text-zinc-400 transition-colors hover:bg-zinc-800'
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCreateGame}
                  disabled={!newGameName.trim()}
                  className='flex-1 border border-red-900/50 bg-red-950/50 p-4 font-bold uppercase tracking-widest text-red-500 transition-colors hover:bg-red-900 hover:text-white disabled:opacity-50'
                >
                  Criar
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className='scrollbar-thin scrollbar-thumb-zinc-800 flex flex-1 flex-col gap-2 overflow-y-auto pr-2'>
                {hostedGames.map((game) => (
                  <div
                    key={game.id}
                    className='group/item flex items-center justify-between border border-zinc-800/80 bg-zinc-900/50 p-3 transition-colors hover:border-zinc-600'
                  >
                    <div className='flex flex-col'>
                      <span className='text-sm font-bold uppercase tracking-wider text-white'>
                        {game.name}
                      </span>
                      <span className='text-[10px] uppercase tracking-widest text-zinc-500'>
                        {game.actId === 'act_1'
                          ? 'Ato 1: O Início'
                          : game.actId}
                      </span>
                    </div>
                    <div className='flex items-center gap-2'>
                      <button
                        onClick={() => deleteGame(game.id)}
                        className='p-2 text-zinc-600 opacity-0 transition-all hover:text-red-500 group-hover/item:opacity-100'
                      >
                        <Trash2 size={16} />
                      </button>
                      <button
                        onClick={() => hostGame(game.id)}
                        className='rounded bg-zinc-800 p-2 text-zinc-300 transition-colors hover:bg-red-900 hover:text-white'
                      >
                        <Play size={16} fill='currentColor' />
                      </button>
                    </div>
                  </div>
                ))}
                {hostedGames.length === 0 && (
                  <div className='flex h-full flex-col items-center justify-center text-zinc-600 opacity-50'>
                    <span className='font-serif text-sm uppercase tracking-widest'>
                      Nenhuma Mesa Encontrada
                    </span>
                  </div>
                )}
              </div>
              <button
                onClick={() => setIsCreatingGame(true)}
                className='mt-4 flex w-full shrink-0 items-center justify-center gap-2 bg-zinc-800 p-4 font-bold uppercase tracking-widest text-white transition-colors hover:bg-zinc-700'
              >
                <Plus size={18} /> Nova Campanha
              </button>
            </>
          )}
        </div>

        {/* JOIN PANEL */}
        <div className='group relative flex h-[450px] flex-col overflow-hidden border border-zinc-800 bg-[#0a0a0a] p-8'>
          <div className='absolute left-0 top-0 h-1 w-full bg-blue-900/50'></div>
          <div className='mb-6 flex shrink-0 items-center gap-3'>
            <LogIn size={24} className='text-blue-600' />
            <h2 className='font-serif text-2xl font-black uppercase tracking-widest text-white'>
              Conectar a Jogo
            </h2>
          </div>
          <p className='mb-8 text-sm leading-relaxed text-zinc-500'>
            Conecte-se a um servidor hospedado por outro jogador na mesma rede
            local (LAN) ou via VPN (Radmin/Hamachi).
          </p>

          <div className='mt-auto flex flex-col gap-4'>
            <label className='flex flex-col gap-2'>
              <span className='text-xs font-bold uppercase tracking-wider text-zinc-500'>
                Endereço IP do Mestre
              </span>
              <input
                type='text'
                value={ipInput}
                onChange={(e) => setIpInput(e.target.value)}
                placeholder='Ex: 192.168.1.100'
                className='border border-zinc-800 bg-black p-4 font-mono text-white outline-none transition-colors focus:border-blue-700'
              />
            </label>
            <button
              onClick={() => joinGame(ipInput)}
              disabled={ipInput.trim().length < 7}
              className='w-full bg-zinc-800 p-4 font-bold uppercase tracking-widest text-white transition-colors hover:bg-blue-900 disabled:bg-zinc-900'
            >
              Conectar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
