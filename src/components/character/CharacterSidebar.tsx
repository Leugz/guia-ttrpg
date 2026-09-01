import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ParsedDocument, useCharacterStore } from '../../store/characterStore';
import { StepDice, RollResult } from '../../lib/systemRules';
import { useChatStore } from '../../store/chatStore';
import { ResourceBar } from './ResourceBar';
import { SkillPromptModal } from './SkillPromptModal';

export function CharacterSidebar() {
  const { character, loadCharacter, takeDamage } = useCharacterStore();
  const { addMessage } = useChatStore();

  const [activePrompt, setActivePrompt] = useState<{
    name: string;
    dice: string;
  } | null>(null);

  const TEST_PATH = '/home/leugz_/Projects/personal/guia/test_character.md';

  const handleTestLoad = async () => {
    try {
      const result = await invoke<ParsedDocument>('load_character_sheet', {
        path: TEST_PATH,
      });
      loadCharacter(result, TEST_PATH);
    } catch (error) {
      console.error('IPC Error:', error);
    }
  };

  const parseDiceString = (diceStr: string): StepDice => {
    const formatted = diceStr.toUpperCase();
    return Object.values(StepDice).includes(formatted as StepDice)
      ? (formatted as StepDice)
      : StepDice.D4;
  };

  const executeFinalRoll = async (skillDie: StepDice, skillName: string) => {
    if (!activePrompt) return;

    const baseDie = parseDiceString(activePrompt.dice);

    try {
      const result = await invoke<RollResult>('execute_roll', {
        pool: [baseDie, skillDie],
      });

      const displayAttribute =
        activePrompt.name === 'physical'
          ? 'Físico'
          : activePrompt.name === 'mind'
            ? 'Mente'
            : 'Emoção';

      addMessage({
        sender: character?.name || 'Unknown',
        type: 'roll',
        rollLabel: `Teste de ${displayAttribute} (${skillName})`,
        rollResult: result,
      });
    } catch (error) {
      console.error('Roll failed:', error);
    } finally {
      setActivePrompt(null);
    }
  };

  // Helper mapping for UI translation
  const attributeDisplayMap: Record<string, string> = {
    physical: 'Físico',
    mind: 'Mente',
    emotion: 'Emoção',
  };

  return (
    <>
      <aside className='flex w-[300px] flex-col gap-4 overflow-y-auto border-l border-neutral-700 bg-black p-4'>
        <h2 className='text-xl font-bold'>Ficha de Personagem</h2>
        <button
          onClick={handleTestLoad}
          className='rounded border border-neutral-600 bg-neutral-800 px-4 py-2 text-sm font-medium transition-colors hover:bg-neutral-700'
        >
          Carregar Personagem
        </button>

        {character && (
          <div className='animate-fade-in mt-4 flex flex-col gap-4'>
            <div className='rounded border border-neutral-800 bg-neutral-900 p-3'>
              <h3 className='text-lg font-bold text-white'>{character.name}</h3>
              <p className='text-sm text-neutral-400'>
                {character.occupation} • Nível {character.level}
              </p>
            </div>

            <div className='flex gap-2'>
              <ResourceBar 
                label="PV (Take Dmg)"
                current={character.resources.pv.current} // renamed
                max={character.resources.pv.max}
                colorClass="text-red-500"
                onClick={() => takeDamage(1)}
              />
              <ResourceBar 
                label="PD"
                current={character.resources.pd.current} // renamed
                max={character.resources.pd.max}
                colorClass="text-blue-500"
              />
            </div>

            <div className='mt-2 flex gap-2'>
              {Object.entries(character.base_attributes).map(
                ([name, value]) => (
                  <div
                    key={name}
                    onClick={() =>
                      setActivePrompt({ name, dice: value as string })
                    }
                    className='flex-1 cursor-pointer rounded border border-neutral-800 bg-neutral-900 p-2 text-center transition-colors hover:bg-neutral-700'
                  >
                    <span className='block text-xs font-bold text-neutral-400'>
                      {attributeDisplayMap[name]}
                    </span>
                    <span className='font-mono text-lg font-bold text-white'>
                      {value as string}
                    </span>
                  </div>
                )
              )}
            </div>
          </div>
        )}
      </aside>

      {activePrompt && (
        <SkillPromptModal
          attributeName={activePrompt.name}
          attributeDice={activePrompt.dice}
          onClose={() => setActivePrompt(null)}
          onConfirm={executeFinalRoll}
        />
      )}
    </>
  );
}
