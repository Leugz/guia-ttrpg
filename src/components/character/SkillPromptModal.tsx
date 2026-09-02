import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useCharacterStore } from '../../store/characterStore';
import { TestRequest, ResolvedPool, TestOutcome } from '../../lib/types';
import { useChatStore } from '../../store/chatStore';

interface SkillPromptModalProps {
  attributeName: string;
  onClose: () => void;
}

export function SkillPromptModal({
  attributeName,
  onClose,
}: SkillPromptModalProps) {
  const { character, activePath } = useCharacterStore();
  const { addMessage } = useChatStore();

  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);
  const [preview, setPreview] = useState<ResolvedPool | null>(null);

  // Generate the TestRequest object natively
  const buildRequest = (): TestRequest => ({
    attribute: attributeName,
    skill_id: selectedSkill || undefined,
    triggered: [], // Would map checked abilities/inventory here
    extra_dice: [],
    secret: false,
  });

  // Fetch the preview from Rust whenever the selected skill changes
  useEffect(() => {
    if (!activePath) return;
    invoke<ResolvedPool>('preview_test', {
      path: activePath,
      request: buildRequest(),
    })
      .then(setPreview)
      .catch(console.error);
  }, [selectedSkill, activePath]);

  const handleRoll = async () => {
    if (!activePath || !character) return;
    try {
      const outcome = await invoke<TestOutcome>('roll_test', {
        path: activePath,
        request: buildRequest(),
      });

      addMessage({
        sender: character.name,
        type: 'roll',
        rollLabel: outcome.pool.label,
        rollResult: outcome.result,
      });
      onClose();
    } catch (error) {
      console.error('Roll failed:', error);
    }
  };

  // Safe mapping of attributes to UI skills
  const availableSkills =
    character?.skills.filter((s) => s.governed_by === attributeName) || [];

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm'>
      <div className='w-[450px] rounded-lg border border-neutral-700 bg-neutral-900 p-6 shadow-2xl'>
        <h3 className='mb-4 text-xl font-bold capitalize text-white'>
          Teste de {attributeName}
        </h3>

        <div className='mb-4 grid max-h-40 grid-cols-2 gap-2 overflow-y-auto pr-2'>
          {availableSkills.map((skill) => (
            <button
              key={skill.id}
              onClick={() => setSelectedSkill(skill.id)}
              className={`rounded border px-3 py-2 text-sm transition-colors ${
                selectedSkill === skill.id
                  ? 'border-blue-500 bg-blue-500/20 text-white'
                  : 'border-neutral-700 bg-neutral-800 text-neutral-400'
              }`}
            >
              {skill.name} (d{skill.value})
            </button>
          ))}
        </div>

        {/* Dynamic Pool Preview */}
        {preview && (
          <div className='mb-6 rounded border border-neutral-800 bg-black p-3'>
            <span className='mb-2 block text-xs uppercase text-neutral-500'>
              Resolução da Rolagem
            </span>
            <div className='flex flex-wrap gap-2'>
              {preview.dice.map((die, i) => (
                <span
                  key={i}
                  className='rounded bg-neutral-800 px-2 py-1 font-mono text-sm text-white'
                >
                  d{die.sides}{' '}
                  <span className='text-xs text-neutral-500'>
                    ({die.source})
                  </span>
                </span>
              ))}
            </div>
            {preview.applied.length > 0 && (
              <div className='mt-2 text-xs text-blue-400'>
                Efeitos ativos: {preview.applied.join(', ')}
              </div>
            )}
          </div>
        )}

        <div className='flex justify-end gap-3'>
          <button
            onClick={onClose}
            className='text-neutral-400 hover:text-white'
          >
            Cancelar
          </button>
          <button
            onClick={handleRoll}
            className='rounded bg-blue-600 px-4 py-2 font-bold text-white'
          >
            Rolar Dados
          </button>
        </div>
      </div>
    </div>
  );
}
