import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useCharacterStore } from '../characterStore';
import { TestRequest, ResolvedPool, TestOutcome } from '../../../shared/types';
import { useChatStore } from '../../chat/chatStore';

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
  const [isSecret, setIsSecret] = useState(false);
  const [helpSteps, setHelpSteps] = useState<number>(0);

  // New state to track which Trigger abilities the player is using for this roll
  const [triggeredAbilities, setTriggeredAbilities] = useState<string[]>([]);

  const [preview, setPreview] = useState<ResolvedPool | null>(null);

  const buildRequest = (): TestRequest => ({
    attribute: attributeName,
    skill_id: selectedSkill || undefined,
    triggered: triggeredAbilities, // Hooked up to our checkboxes
    help: helpSteps > 0 ? helpSteps : undefined,
    extra_dice: [],
    secret: isSecret,
  });

  // Re-fetch the preview mathematically from Rust whenever any modifier changes
  useEffect(() => {
    if (!activePath) return;
    invoke<ResolvedPool>('preview_test', {
      path: activePath,
      request: buildRequest(),
    })
      .then(setPreview)
      .catch(console.error);
  }, [selectedSkill, isSecret, helpSteps, triggeredAbilities, activePath]);

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

  const availableSkills =
    character?.skills.filter((s) => s.governed_by === attributeName) || [];

  // Extract only abilities/inventory that act as "Triggers" (they add dice, not steps)
  const availableTriggers = [
    ...(character?.abilities || []),
    ...(character?.inventory || []),
  ].filter((entry) =>
    entry.effects.some((e) => e.unit !== 'step' && e.unit !== 'Step')
  );

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

        {/* Trigger Abilities Checkboxes */}
        {availableTriggers.length > 0 && (
          <div className='mb-4'>
            <span className='mb-2 block text-xs font-bold uppercase text-neutral-500'>
              Habilidades & Efeitos
            </span>
            <div className='flex flex-wrap gap-2'>
              {availableTriggers.map((entry) => (
                <label
                  key={entry.id}
                  className={`flex cursor-pointer items-center gap-2 rounded border px-3 py-1.5 transition-colors ${
                    triggeredAbilities.includes(entry.id)
                      ? 'border-blue-500 bg-blue-500/20'
                      : 'border-neutral-700 bg-neutral-800 hover:bg-neutral-700'
                  }`}
                >
                  <input
                    type='checkbox'
                    className='h-3 w-3'
                    checked={triggeredAbilities.includes(entry.id)}
                    onChange={(e) => {
                      if (e.target.checked)
                        setTriggeredAbilities([
                          ...triggeredAbilities,
                          entry.id,
                        ]);
                      else
                        setTriggeredAbilities(
                          triggeredAbilities.filter((id) => id !== entry.id)
                        );
                    }}
                  />
                  <span className='text-sm font-medium text-white'>
                    {entry.name}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div className='mb-4 flex gap-2'>
          <span className='flex items-center text-sm font-bold text-neutral-400'>
            Ajuda:
          </span>
          {[0, 1, 2].map((val) => (
            <button
              key={val}
              onClick={() => setHelpSteps(val)}
              className={`rounded px-3 py-1 text-xs font-bold transition-colors ${
                helpSteps === val
                  ? 'bg-blue-600 text-white'
                  : 'bg-neutral-800 text-neutral-500 hover:bg-neutral-700 hover:text-white'
              }`}
            >
              {val === 0 ? 'Nenhuma' : `+${val} Passo${val > 1 ? 's' : ''}`}
            </button>
          ))}
        </div>

        {preview && (
          <div className='mb-4 rounded border border-neutral-800 bg-black p-3'>
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

        <div className='mb-6 flex items-center gap-2'>
          <input
            type='checkbox'
            id='secret-skill-roll'
            checked={isSecret}
            onChange={(e) => setIsSecret(e.target.checked)}
            className='h-4 w-4 rounded border-neutral-600 bg-neutral-700'
          />
          <label
            htmlFor='secret-skill-roll'
            className='text-sm font-medium text-neutral-300'
          >
            Rolagem Secreta (GM apenas)
          </label>
        </div>

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
