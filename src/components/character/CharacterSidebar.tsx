import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ParsedDocument, useCharacterStore } from '../../store/characterStore';
import { StepDice, RollResult } from '../../lib/systemRules';
import { useChatStore } from '../../store/chatStore';

import { ResourceBar } from './ResourceBar';
import { SkillPromptModal } from './SkillPromptModal';
import { CharacterHeader } from './CharacterHeader';
import { AbilityList } from './AbilityList';

export function CharacterSidebar() {
  const { character, loadCharacter, modifyResource } = useCharacterStore();
  const { addMessage } = useChatStore();

  const [activePrompt, setActivePrompt] = useState<{
    name: string;
    dice: number;
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

  const executeFinalRoll = async (skillDie: StepDice, skillName: string) => {
    if (!activePrompt) return;

    try {
      const result = await invoke<RollResult>('execute_roll', {
        pool: [activePrompt.dice, skillDie],
      });
      const displayAttribute =
        activePrompt.name === 'physical'
          ? 'Físico'
          : activePrompt.name === 'mind'
            ? 'Mente'
            : 'Emoção';

      addMessage({
        sender: character?.name || 'Guest',
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

  const handleUseAbility = (name: string, description: string) => {
    addMessage({
      sender: character?.name || 'Unknown',
      type: 'text',
      content: description,
      rollLabel: `Usa Habilidade: ${name}`,
    });
  };

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
            <CharacterHeader
              name={character.name}
              occupation={character.occupation}
              level={character.level}
            />

            <div className='flex gap-2'>
              <ResourceBar
                label='HP (Take Dmg)'
                current={character.resources.hp.current}
                max={character.resources.hp.max}
                colorClass='text-red-500'
                onClick={() => modifyResource('hp', -1)}
              />
              <ResourceBar
                label='DP'
                current={character.resources.dp.current}
                max={character.resources.dp.max}
                colorClass='text-blue-500'
                onClick={() => modifyResource('dp', -1)}
              />
            </div>

            <div className='mt-2 flex gap-2'>
              {Object.entries(character.attributes).map(([name, value]) => (
                <div
                  key={name}
                  onClick={() =>
                    setActivePrompt({ name, dice: value as number })
                  }
                  className='flex-1 cursor-pointer rounded border border-neutral-800 bg-neutral-900 p-2 text-center transition-colors hover:bg-neutral-700'
                >
                  <span className='block text-xs font-bold text-neutral-400'>
                    {attributeDisplayMap[name]}
                  </span>
                  <span className='font-mono text-lg font-bold text-white'>
                    {value as number}
                  </span>
                </div>
              ))}
            </div>

            <AbilityList
              characterName={character.name}
              abilities={character.abilities}
              onUseAbility={handleUseAbility}
            />
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
