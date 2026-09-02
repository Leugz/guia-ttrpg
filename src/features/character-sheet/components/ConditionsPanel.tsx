import { useCharacterStore } from '../characterStore';
import { ActiveEffect } from '../../../shared/types';

const BUILTIN_CONDITIONS = [
  { id: 'machucado', label: 'Machucado', desc: 'Físico -1 Passo' },
  { id: 'desatencao', label: 'Desatenção', desc: 'Mente -1 Passo' },
  { id: 'irritacao', label: 'Irritação', desc: 'Emoção -1 Passo' },
];

export function ConditionsPanel() {
  const { character, applyBuiltinEffect, removeActiveEffect } =
    useCharacterStore();

  if (!character) return null;

  const handleToggle = (id: string, isActive: boolean) => {
    if (isActive) {
      removeActiveEffect(id);
    } else {
      applyBuiltinEffect(id);
    }
  };

  return (
    <div className='mt-2 flex gap-2'>
      {BUILTIN_CONDITIONS.map((cond) => {
        const isActive = character.active_effects.some(
          (effect: ActiveEffect) => effect.id === cond.id
        );

        return (
          <button
            key={cond.id}
            onClick={() => handleToggle(cond.id, isActive)}
            className={`flex-1 flex-col items-center justify-center rounded border p-2 transition-colors ${
              isActive
                ? 'border-red-500 bg-red-500/20 text-red-400'
                : 'border-neutral-800 bg-neutral-900 text-neutral-500 hover:border-neutral-600 hover:text-neutral-300'
            }`}
          >
            <span className='block text-xs font-bold uppercase tracking-wider'>
              {cond.label}
            </span>
            <span className='mt-0.5 block text-[10px] opacity-80'>
              {cond.desc}
            </span>
          </button>
        );
      })}
    </div>
  );
}
