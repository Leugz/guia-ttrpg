import { invoke } from '@tauri-apps/api/core';
import { ParsedDocument, useCharacterStore } from '../../store/characterStore';
import { StepDice, RollResult } from '../../lib/systemRules';
import { useChatStore } from '../../store/chatStore';
import { ResourceBar } from './ResourceBar';
import { useState } from 'react';
import { SkillPromptModal } from './SkillPromptModal';

export function CharacterSidebar() {
  const { character, loadCharacter, takeDamage } = useCharacterStore();
  const { addMessage } = useChatStore();
  const [activePrompt, setActivePrompt] = useState<{
    name: string;
    dice: string;
  } | null>();
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

  const executeFinalRoll = async (
    periciaDie: StepDice,
    periciaName: string
  ) => {
    if (!activePrompt) return;

    const baseDie = parseDiceString(activePrompt.dice);

    try {
      const result = await invoke<RollResult>('execute_roll', {
        pool: [baseDie, periciaDie],
      });

      addMessage({
        sender: character?.nome || 'Guest',
        type: 'roll',
        rollLabel: `Teste de ${activePrompt.name} (${periciaName})`,
        rollResult: result,
      });
    } catch (error) {
      console.error('Roll failed:', error);
    } finally {
      setActivePrompt(null);
    }
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
              <h3 className='text-lg font-bold text-white'>{character.nome}</h3>
              <p className='text-sm text-neutral-400'>
                {character.ocupacao} • Nível {character.nivel}
              </p>
            </div>

            <div className='flex gap-2'>
              <ResourceBar
                label='PV (Take Dmg)'
                atual={character.recursos.pv.atual}
                max={character.recursos.pv.max}
                colorClass='text-red-500'
                onClick={() => takeDamage(1)}
              />
              <ResourceBar
                label='PD'
                atual={character.recursos.pd.atual}
                max={character.recursos.pd.max}
                colorClass='text-blue-500'
              />
            </div>

            <div className='mt-2 flex gap-2'>
              {Object.entries(character.atributos_base).map(([nome, valor]) => (
                <div
                  key={nome}
                  onClick={() =>
                    setActivePrompt({ name: nome, dice: valor as string })
                  }
                  className='flex-1 cursor-pointer rounded border border-neutral-800 bg-neutral-900 p-2 text-center transition-colors hover:bg-neutral-700'
                >
                  <span className='block text-xs font-bold capitalize text-neutral-400'>
                    {nome}
                  </span>
                  <span className='font-mono text-lg font-bold text-white'>
                    {valor}
                  </span>
                </div>
              ))}
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
