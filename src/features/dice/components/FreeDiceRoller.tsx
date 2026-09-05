import { useState, useEffect } from 'react';
import { useChatStore } from '../../chat/chatStore';
import * as gameClient from '../../session/net/gameClient';
import {
  useCharacterStore,
  getProfileColor,
} from '../../character-sheet/characterStore';
import { useSessionStore } from '../../session/sessionStore';

interface FreeDiceRollerProps {
  isOpen: boolean;
  onClose: () => void;
}

const AVAILABLE_DICE = [4, 6, 8, 10, 12, 20];

export function FreeDiceRoller({ isOpen, onClose }: FreeDiceRollerProps) {
  const { addMessage } = useChatStore();
  const { character } = useCharacterStore();
  const { username, isHosting } = useSessionStore();

  const [pool, setPool] = useState<number[]>([]);
  const [isSecret, setIsSecret] = useState(false);

  const identityColor = character
    ? getProfileColor(character?.profile)
    : isHosting
      ? '#987c50'
      : '#71717a';

  // Global Keyboard Shortcut (Ctrl+R / Cmd+R)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        if (isOpen) onClose();
        // If you need a way to open it from anywhere, that state should live in a global UI store or App.tsx
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const addDie = (sides: number) => {
    setPool([...pool, sides]);
  };

  const removeDie = (index: number) => {
    setPool(pool.filter((_, i) => i !== index));
  };

  const handleRoll = async () => {
    if (pool.length === 0) return;

    try {
      const result = await gameClient.rollDice(pool, isSecret);

      addMessage({
        sender: character?.name || username || 'Guest',
        username: username || undefined,
        color: identityColor,
        type: 'roll',
        rollLabel: isSecret ? 'Rolagem Secreta' : 'Rolagem Livre',
        rollResult: result,
      });

      setPool([]);
      setIsSecret(false);
      onClose();
    } catch (error) {
      console.error('Free roll failed:', error);
    }
  };

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm'>
      <div className='w-[400px] rounded-lg border border-neutral-700 bg-neutral-900 p-6 shadow-2xl'>
        <h3 className='mb-4 text-xl font-bold text-white'>Rolagem Livre</h3>

        <div className='mb-4 flex flex-wrap gap-2'>
          {AVAILABLE_DICE.map((sides) => (
            <button
              key={sides}
              onClick={() => addDie(sides)}
              className='flex-1 rounded border border-neutral-700 bg-neutral-800 px-3 py-2 font-mono text-sm font-bold text-white transition-colors hover:bg-neutral-700'
            >
              d{sides}
            </button>
          ))}
        </div>

        <div className='mb-4 min-h-[60px] rounded border border-neutral-800 bg-black p-3'>
          {pool.length === 0 ? (
            <span className='text-sm text-neutral-500'>
              Nenhum dado selecionado...
            </span>
          ) : (
            <div className='flex flex-wrap gap-2'>
              {pool.map((sides, i) => (
                <button
                  key={i}
                  onClick={() => removeDie(i)}
                  className='rounded bg-neutral-800 px-2 py-1 font-mono text-xs text-white hover:bg-red-900'
                  title='Remover dado'
                >
                  d{sides}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className='mb-6 flex items-center gap-2'>
          <input
            type='checkbox'
            id='secret-roll'
            checked={isSecret}
            onChange={(e) => setIsSecret(e.target.checked)}
            className='h-4 w-4 rounded border-neutral-600 bg-neutral-700'
          />
          <label
            htmlFor='secret-roll'
            className='text-sm font-medium text-neutral-300'
          >
            Rolagem Secreta (GM apenas)
          </label>
        </div>

        <div className='flex justify-end gap-3'>
          <button
            onClick={onClose}
            className='rounded px-4 py-2 text-sm font-medium text-neutral-400 hover:text-white'
          >
            Cancelar
          </button>
          <button
            onClick={handleRoll}
            disabled={pool.length === 0}
            className='rounded bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50'
          >
            Rolar Dados
          </button>
        </div>
      </div>
    </div>
  );
}
