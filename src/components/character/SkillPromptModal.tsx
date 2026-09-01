import { useState } from 'react';
import { ATRIBUTO_PERICIA_MAP, StepDice } from '../../lib/systemRules';

interface SkillPromptModalProps {
  attributeName: string;
  attributeDice: string;
  onClose: () => void;
  onConfirm: (periciaDie: StepDice, periciaName: string) => void;
}

export function SkillPromptModal({
  attributeName,
  attributeDice,
  onClose,
  onConfirm,
}: SkillPromptModalProps) {
  const [selectedPericia, setSelectedPericia] = useState<string | null>(null);
  const [isTrained, setIsTrained] = useState(false);

  // Safely get the mapped skills, defaulting to an empty array if something goes wrong
  const availableSkills =
    ATRIBUTO_PERICIA_MAP[attributeName as keyof typeof ATRIBUTO_PERICIA_MAP] ||
    [];

  const handleRoll = () => {
    // If they check "Trained", we upgrade the Perícia die to a D6 (or whatever your system baseline is)
    // For now, untrained is D4, trained is D6
    const periciaDie = isTrained ? StepDice.D6 : StepDice.D4;
    onConfirm(periciaDie, selectedPericia || 'Untrained');
  };

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm'>
      <div className='animate-fade-in w-[400px] rounded-lg border border-neutral-700 bg-neutral-900 p-6 shadow-2xl'>
        <h3 className='mb-1 text-xl font-bold capitalize text-white'>
          Teste de {attributeName} ({attributeDice})
        </h3>
        <p className='mb-4 text-sm text-neutral-400'>
          Selecione a perícia correspondente para somar ao teste.
        </p>

        <div className='mb-4 grid grid-cols-2 gap-2'>
          {availableSkills.map((skill) => (
            <button
              key={skill}
              onClick={() => setSelectedPericia(skill)}
              className={`rounded border px-3 py-2 text-sm transition-colors ${
                selectedPericia === skill
                  ? 'border-blue-500 bg-blue-500/20 text-white'
                  : 'border-neutral-700 bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
              }`}
            >
              {skill}
            </button>
          ))}
        </div>

        <div className='mb-6 flex items-center gap-2'>
          <input
            type='checkbox'
            id='trained'
            checked={isTrained}
            onChange={(e) => setIsTrained(e.target.checked)}
            className='h-4 w-4 rounded border-neutral-600 bg-neutral-700'
          />
          <label
            htmlFor='trained'
            className='text-sm font-medium text-neutral-300'
          >
            Personagem é treinado (+1 Step)
          </label>
        </div>

        <div className='flex justify-end gap-3'>
          <button
            onClick={onClose}
            className='rounded px-4 py-2 text-sm font-medium text-neutral-400 transition-colors hover:text-white'
          >
            Cancelar
          </button>
          <button
            onClick={handleRoll}
            className='rounded bg-blue-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-blue-500'
          >
            Rolar Dados
          </button>
        </div>
      </div>
    </div>
  );
}
