import { useState } from 'react';
import { Fingerprint } from 'lucide-react';
import { useSessionStore } from '../../session/sessionStore';

export function WelcomeScreen() {
  const { setUsername } = useSessionStore();
  const [input, setInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim().length > 1) {
      setUsername(input);
    }
  };

  return (
    <div className='fixed inset-0 flex items-center justify-center bg-[#050505] p-4 selection:bg-red-900 selection:text-white'>
      <div className='absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-zinc-900/20 via-[#050505] to-[#050505]'></div>

      <div className='relative z-10 w-full max-w-md rounded-sm border border-zinc-800 bg-[#0a0a0a] p-8 shadow-[0_0_50px_rgba(0,0,0,0.8)]'>
        <div className='mb-8 flex flex-col items-center'>
          <div className='mb-4 flex h-16 w-16 items-center justify-center rounded-sm border border-zinc-800 bg-zinc-900 shadow-inner'>
            <Fingerprint size={32} className='text-zinc-500' />
          </div>
          <h1 className='font-serif text-2xl font-black uppercase tracking-[0.2em] text-white'>
            Identificação
          </h1>
          <p className='mt-2 text-center text-sm text-zinc-500'>
            Insira seu nome ou apelido. Esta será sua identidade visível para os
            outros jogadores na rede.
          </p>
        </div>

        <form onSubmit={handleSubmit} className='flex flex-col gap-4'>
          <input
            type='text'
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder='Nome de Usuário'
            maxLength={24}
            className='w-full border border-zinc-700 bg-black p-4 text-center font-bold uppercase tracking-widest text-white outline-none transition-colors focus:border-red-700'
          />
          <button
            type='submit'
            disabled={input.trim().length < 2}
            className='w-full border border-zinc-700 bg-zinc-800 p-4 font-bold uppercase tracking-widest text-white transition-colors hover:border-zinc-500 hover:bg-zinc-700 disabled:bg-zinc-900 disabled:text-zinc-700'
          >
            Acessar Terminal
          </button>
        </form>
      </div>
    </div>
  );
}
