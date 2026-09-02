import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useCharacterStore } from '../../store/characterStore';
import { ParsedDocument } from '../../lib/types';
import { useChatStore } from '../../store/chatStore';

import { ResourceBar } from './ResourceBar';
import { SkillPromptModal } from './SkillPromptModal';
import { CharacterHeader } from './CharacterHeader';
import { AbilityList } from './AbilityList';

export function CharacterSidebar() {
  const { character, loadCharacter, applyResourceChange } = useCharacterStore();
  const { addMessage } = useChatStore();

  // The modal now handles the complex roll logic, so we only need to track the clicked attribute
  const [activeAttribute, setActiveAttribute] = useState<string | null>(null);

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
                label='HP'
                current={character.resources.hp.current}
                max={character.resources.hp.max}
                colorClass='text-red-500'
                onClick={() => applyResourceChange('hp', -1)}
              />
              <ResourceBar
                label='DP'
                current={character.resources.dp.current}
                max={character.resources.dp.max}
                colorClass='text-blue-500'
                onClick={() => applyResourceChange('dp', -1)}
              />
            </div>

            <div className='mt-2 flex gap-2'>
              {/* We map over character.attributes, which uses the new integer values */}
              {Object.entries(character.attributes).map(([name, value]) => (
                <div
                  key={name}
                  onClick={() => setActiveAttribute(name)}
                  className='flex-1 cursor-pointer rounded border border-neutral-800 bg-neutral-900 p-2 text-center transition-colors hover:bg-neutral-700'
                >
                  <span className='block text-xs font-bold text-neutral-400'>
                    {attributeDisplayMap[name]}
                  </span>
                  {/* The UI safely renders the raw integer as standard dice notation */}
                  <span className='font-mono text-lg font-bold text-white'>
                    d{value as number}
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

      {/* Render the advanced prompt modal when an attribute is clicked */}
      {activeAttribute && (
        <SkillPromptModal
          attributeName={activeAttribute}
          onClose={() => setActiveAttribute(null)}
        />
      )}
    </>
  );
}
