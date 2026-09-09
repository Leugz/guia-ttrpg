import { useState } from 'react';
import { DieShape } from '../../../shared/components/DieShape';
import type { RollResult } from '../../../shared/types';

interface RerollDiceModalProps {
  rollResult: RollResult;
  onConfirm: (index: number) => void;
  onClose: () => void;
}

export function RerollDiceModal({
  rollResult,
  onConfirm,
  onClose,
}: RerollDiceModalProps) {
  const [selected, setSelected] = useState<number | null>(null);

  return (
    <div className='fixed inset-0 z-[90] flex items-center justify-center bg-black/70 backdrop-blur-sm'>
      <div className='w-[380px] rounded-lg border border-zinc-700 bg-neutral-900 p-6 shadow-2xl'>
        <h3 className='mb-1 text-lg font-bold text-white'>
          Olhar Infal&iacute;vel
        </h3>
        <p className='mb-4 text-xs text-zinc-500'>
          Escolha um dado para rolar novamente (-2 PD).
        </p>

        <div className='mb-6 flex flex-wrap justify-center gap-3'>
          {rollResult.dice.map((die, i) => (
            <button
              key={i}
              onClick={() => setSelected(i)}
              className={`rounded border p-1 transition-colors ${
                selected === i
                  ? 'border-[var(--theme-color)] bg-zinc-900 shadow-[0_0_10px_var(--theme-color)]'
                  : 'border-zinc-800 bg-black hover:border-zinc-600'
              }`}
            >
              <DieShape
                sides={die.sides}
                value={die.value}
                className='h-12 w-12 text-xl'
                colorClass={die.counted ? 'text-white' : 'text-zinc-500'}
                isDropped={!die.counted}
              />
            </button>
          ))}
        </div>

        <div className='flex justify-end gap-3'>
          <button
            onClick={onClose}
            className='px-4 py-2 text-sm font-medium text-zinc-500 hover:text-white'
          >
            Cancelar
          </button>
          <button
            onClick={() => selected !== null && onConfirm(selected)}
            disabled={selected === null}
            className='rounded border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-bold text-white hover:bg-zinc-700 disabled:opacity-50'
          >
            Rolar Novamente
          </button>
        </div>
      </div>
    </div>
  );
}
