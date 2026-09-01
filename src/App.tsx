import { Stage, Layer, Circle } from 'react-konva';
import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ParsedDocument, useCharacterStore } from './store/characterStore';
import { StepDice, RollResult } from './lib/systemRules';

export default function App() {
  const [windowSize, setWindowSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });
  const { character, loadCharacter, takeDamage } = useCharacterStore();
  const TEST_PATH = '/home/leugz_/Projects/personal/guia/test_character.md';

  useEffect(() => {
    const handleResize = () =>
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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

  // Determine token color based on NFR specification
  const isDeadOrDying =
    character &&
    (character.recursos.pv.atual <= 0 || character.recursos.pd.atual <= 0);
  const tokenColor = isDeadOrDying ? '#555555' : '#ef4444'; // Grayscale or Red

  const parseDiceString = (diceStr: string): StepDice => {
    const num = parseInt(diceStr.toLowerCase().replace('d', ''), 10);
    return [4, 6, 8, 10, 12].includes(num) ? (num as StepDice) : StepDice.D4;
  };

  const handleAttributeRoll = async (attrName: string, attrDice: string) => {
    const baseDie = parseDiceString(attrDice);
    const periciaDie = StepDice.D4; // Placeholder for untrained Perícia

    try {
      const result = await invoke<RollResult>('execute_roll', {
        pool: [baseDie, periciaDie],
      });

      // Log the structured Rust response directly to the browser console
      console.log(`[Rolled ${attrName.toUpperCase()}]`, result);
    } catch (error) {
      console.error('Roll failed:', error);
    }
  };

  return (
    <div className='flex h-screen overflow-hidden bg-neutral-900 text-white'>
      {/* 2D Grid & Tokens */}
      <Stage width={windowSize.width - 300} height={windowSize.height}>
        <Layer>
          <Circle x={150} y={150} radius={25} fill={tokenColor} draggable />
        </Layer>
      </Stage>

      {/* Ordem Paranormal Character Sheet / HUD */}
      <aside className='flex w-[300px] flex-col gap-4 overflow-y-auto border-l border-neutral-700 bg-black p-4'>
        <h2 className='text-xl font-bold'>Ficha de Personagem</h2>

        <button
          onClick={handleTestLoad}
          className='rounded border border-neutral-600 bg-neutral-800 px-4 py-2 text-sm font-medium transition-colors hover:bg-neutral-700'
        >
          Carregar Personagem
        </button>

        {/* Dynamic Sheet Render */}
        {character && (
          <div className='animate-fade-in mt-4 flex flex-col gap-4'>
            <div className='rounded border border-neutral-800 bg-neutral-900 p-3'>
              <h3 className='text-lg font-bold text-white'>{character.nome}</h3>
              <p className='text-sm text-neutral-400'>
                {character.ocupacao} • Nível {character.nivel}
              </p>
            </div>

            {/* Recursos (PV / PD) */}
            <div className='flex gap-2'>
              <div
                onClick={() => takeDamage(1)}
                className='flex-1 cursor-pointer rounded border border-neutral-800 bg-neutral-900 p-2 text-center transition-colors hover:bg-neutral-800'
              >
                <span className='block text-xs font-bold text-red-500'>
                  PV (Take Dmg)
                </span>
                <span className='font-mono text-lg font-bold'>
                  {character.recursos.pv.atual}{' '}
                  <span className='text-sm font-normal text-neutral-500'>
                    / {character.recursos.pv.max}
                  </span>
                </span>
              </div>
              <div className='flex-1 cursor-pointer rounded border border-neutral-800 bg-neutral-900 p-2 text-center transition-colors hover:bg-neutral-800'>
                <span className='block text-xs font-bold text-blue-500'>
                  PD
                </span>
                <span className='font-mono text-lg font-bold'>
                  {character.recursos.pd.atual}{' '}
                  <span className='text-sm font-normal text-neutral-500'>
                    / {character.recursos.pd.max}
                  </span>
                </span>
              </div>
            </div>
            {/* Atributos Base */}
            <div className='mt-2 flex gap-2'>
              {Object.entries(character.atributos_base).map(([nome, valor]) => (
                <div
                  key={nome}
                  onClick={() => handleAttributeRoll(nome, valor)}
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
    </div>
  );
}
