import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useCharacterStore } from '../characterStore';
import { ParsedDocument, Effect } from '../../../shared/types';
import { useChatStore } from '../../chat/chatStore';

import { ResourceBar } from './ResourceBar';
import { SkillPromptModal } from './SkillPromptModal';
import { CharacterHeader } from './CharacterHeader';
import { AbilityList } from './AbilityList';
import { ConditionsPanel } from './ConditionsPanel';

const LADDER = [4, 6, 8, 10, 12];

export function CharacterSidebar() {
  const { character, loadCharacter, applyResourceChange } = useCharacterStore();
  const { addMessage } = useChatStore();
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

  // Calculates visual step shifts and assigns color boundaries
  const getEffectiveAttribute = (attrKey: string, baseValue: number) => {
    if (!character)
      return {
        value: baseValue,
        colorClass: 'text-white border-neutral-800 bg-neutral-900',
      };

    let buffs = 0;
    let debuffs = 0;

    const applyEffect = (effect: Effect) => {
      // Only step effects shift base attributes
      if (effect.unit !== 'step' && effect.unit !== 'Step') return;

      // If untargeted, it naturally applies to the base attribute. Otherwise, check for a match.
      const targetMatch =
        !effect.target || effect.target.toLowerCase() === attrKey.toLowerCase();

      if (targetMatch) {
        const qty = effect.quantity || 1;
        if (effect.operation === 'add' || effect.operation === 'advance')
          buffs += qty;
        if (effect.operation === 'subtract') debuffs += qty;
      }
    };

    // Scan Built-ins
    character.active_effects?.forEach((active) =>
      active.effects.forEach(applyEffect)
    );

    // Scan Toggle Abilities
    [...(character.abilities || []), ...(character.inventory || [])]
      .filter((entry) => entry.active)
      .forEach((entry) => entry.effects.forEach(applyEffect));

    const netSteps = buffs - debuffs;
    const baseIndex = LADDER.indexOf(baseValue);
    // Hard clamp to D4 (index 0) and D12 (index 4)
    const clampedIndex = Math.max(
      0,
      Math.min(LADDER.length - 1, baseIndex + netSteps)
    );

    // Assign Colors: Red = Debuffed, Blue = Buffed, Purple = Both
    let colorClass = 'text-white border-neutral-800 bg-neutral-900';
    if (netSteps > 0) {
      colorClass =
        'text-blue-400 border-blue-500/50 bg-blue-500/10 shadow-[0_0_10px_rgba(59,130,246,0.2)]';
    } else if (netSteps < 0) {
      colorClass =
        'text-red-400 border-red-500/50 bg-red-500/10 shadow-[0_0_10px_rgba(239,68,68,0.2)]';
    } else if (buffs > 0 && debuffs > 0) {
      // Mixed state where buffs and debuffs cancel out completely
      colorClass =
        'text-purple-400 border-purple-500/50 bg-purple-500/10 shadow-[0_0_10px_rgba(168,85,247,0.2)]';
    }

    return { value: LADDER[clampedIndex], colorClass, netSteps };
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

            <ConditionsPanel />

            <div className='mt-2 flex gap-2'>
              {Object.entries(character.attributes).map(([name, baseValue]) => {
                const effective = getEffectiveAttribute(
                  name,
                  baseValue as number
                );

                return (
                  <div
                    key={name}
                    onClick={() => setActiveAttribute(name)}
                    className={`flex-1 cursor-pointer rounded border p-2 text-center transition-all hover:brightness-125 ${effective.colorClass}`}
                  >
                    <span className='block text-xs font-bold uppercase tracking-wider opacity-80'>
                      {attributeDisplayMap[name]}
                    </span>
                    <span className='font-mono text-lg font-bold'>
                      d{effective.value}
                    </span>

                    {/* Small numeric indicator showing step shift */}
                    {effective.netSteps !== 0 && (
                      <span className='absolute ml-[20px] mt-[-35px] rounded-full bg-black/50 px-1 text-[10px] font-bold'>
                        {effective.netSteps && effective.netSteps > 0
                          ? `+${effective.netSteps}`
                          : effective.netSteps}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            <AbilityList
              characterName={character.name}
              abilities={character.abilities}
              onUseAbility={handleUseAbility}
            />
          </div>
        )}
      </aside>

      {activeAttribute && (
        <SkillPromptModal
          attributeName={activeAttribute}
          onClose={() => setActiveAttribute(null)}
        />
      )}
    </>
  );
}
