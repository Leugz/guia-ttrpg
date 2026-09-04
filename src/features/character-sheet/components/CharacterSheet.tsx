import React, { useState } from 'react';
import { HeartCrack, Brain, MessageSquare } from 'lucide-react';
import { useCharacterStore } from '../characterStore';
import { useChatStore } from '../../chat/chatStore';
import { DieShape } from '../../../shared/components/DieShape';
import { SkillPromptModal } from './SkillPromptModal';

const BUILTIN_CONDITIONS = [
  {
    id: 'machucado',
    label: 'Machucado',
    desc: 'Físico -1 Passo',
    activeClass: 'text-red-400 border-red-900/50 bg-red-950/30',
  },
  {
    id: 'desatencao',
    label: 'Desatenção',
    desc: 'Mente -1 Passo',
    activeClass: 'text-blue-400 border-blue-900/50 bg-blue-950/30',
  },
  {
    id: 'irritacao',
    label: 'Irritação',
    desc: 'Emoção -1 Passo',
    activeClass: 'text-green-400 border-green-900/50 bg-green-950/30',
  },
  // {
  //   id: 'ajudado',
  //   label: 'Ajudado',
  //   desc: 'Vantagem: +1/+2 Passos',
  //   activeClass: 'text-yellow-400 border-yellow-900/50 bg-yellow-950/30',
  // },
];

const SectionTitle = ({
  children,
  className = '',
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) => (
  <div
    className={`relative inline-block ${className} ${onClick ? 'cursor-pointer hover:brightness-125' : ''}`}
    onClick={onClick}
  >
    <div className='absolute inset-0 origin-left -skew-x-12 scale-110 transform bg-[var(--theme-color)] opacity-90'></div>
    <h2 className='relative z-10 select-none px-3 py-1 font-serif text-lg font-black uppercase tracking-widest text-white'>
      {children}
    </h2>
  </div>
);

const ResourceTrack = ({
  label,
  current,
  max,
  colorClass,
  blockClass,
  onSetExact,
}: any) => (
  <div className='flex items-center gap-3'>
    <div
      className={`flex w-20 justify-between font-serif text-xl font-bold sm:text-2xl ${colorClass}`}
    >
      <span>{label}</span>{' '}
      <span className='inline-block w-8 text-right text-white'>{current}</span>
    </div>
    <div className='flex w-full max-w-[200px] flex-wrap gap-1'>
      {Array.from({ length: max }).map((_, i) => (
        <div
          key={i}
          onClick={() =>
            onSetExact && onSetExact(current === i + 1 ? i : i + 1)
          }
          className={`h-4 w-3 -skew-x-12 cursor-pointer transition-all duration-300 sm:w-4 ${i < current ? blockClass : 'border border-zinc-700/50 bg-zinc-800 hover:bg-zinc-700'}`}
        />
      ))}
    </div>
  </div>
);

export function CharacterSheet({ onClose }: { onClose: () => void }) {
  const {
    character,
    applyResourceChange,
    toggleEntry,
    rollDeathSave,
    stepAttribute,
    applyBuiltinEffect,
    removeActiveEffect,
    impeto,
    setImpeto,
    avaliacao,
    setAvaliacao,
    activeImpetoBuff,
    setActiveImpetoBuff,
    pendingImpetoD4,
    setPendingImpetoD4,
    ajudado,
    setAjudado, // NEW
  } = useCharacterStore();

  const { addMessage } = useChatStore();
  const [activeAttribute, setActiveAttribute] = useState<string | null>(null);
  const [activeSkillId, setActiveSkillId] = useState<string | null>(null);

  if (!character) return null;

  const isDying =
    character.resources.hp.current <= 0 || character.resources.dp.current <= 0;
  const isDead = character.death_saves?.hp?.failed;
  const isInsane = character.death_saves?.dp?.failed;

  const handleUseAbility = (name: string, description: string) => {
    addMessage({
      sender: character.name,
      type: 'text',
      content: description,
      rollLabel: `Usa Habilidade: ${name}`,
    });
  };

  const LADDER = [4, 6, 8, 10, 12, 20];
  const getEffectiveDie = (baseValue: number, attrKey: string) => {
    let steps = 0;
    if (
      attrKey === 'physical' &&
      character.active_effects.some((e) => e.id === 'machucado')
    )
      steps -= 1;
    if (
      attrKey === 'mind' &&
      character.active_effects.some((e) => e.id === 'desatencao')
    )
      steps -= 1;
    if (
      attrKey === 'emotion' &&
      character.active_effects.some((e) => e.id === 'irritacao')
    )
      steps -= 1;

    if (steps === 0) return { value: baseValue, modified: false };

    const idx = LADDER.indexOf(baseValue);
    if (idx === -1) return { value: baseValue, modified: false };

    const newIdx = Math.max(0, Math.min(LADDER.length - 1, idx + steps));
    return { value: LADDER[newIdx], modified: true };
  };

  return (
    <div
      className='absolute inset-0 z-40 flex items-center justify-center bg-black/90 p-4 selection:bg-[var(--theme-color)] selection:text-white sm:p-8'
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className='scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-zinc-950 relative mx-auto flex h-full max-h-[90vh] w-full max-w-7xl flex-col overflow-hidden overflow-y-auto rounded-sm border border-zinc-900 bg-[#050505] shadow-[0_0_50px_rgba(0,0,0,0.5)]'>
        <div
          className={`relative p-2 transition-all duration-700 sm:p-6 ${isDying ? 'grayscale' : ''}`}
        >
          <div className='relative z-10'>
            <header className='mb-8 mt-4 flex flex-col items-center justify-between px-4 sm:mb-12 sm:flex-row sm:px-12'>
              <h1
                className='font-serif text-5xl font-black tracking-[0.15em] sm:text-7xl'
                style={{ color: 'var(--theme-color)' }}
              >
                {character.name}
              </h1>
              <div className='mt-4 flex items-center gap-3 font-serif text-sm font-bold uppercase tracking-widest sm:mt-0 sm:text-base'>
                <div
                  className='rounded-sm border bg-zinc-900/50 px-3 py-1 backdrop-blur-sm'
                  style={{
                    color: 'var(--theme-color)',
                    borderColor: 'var(--theme-color)',
                  }}
                >
                  {character.profile}
                </div>
                <div className='text-zinc-500'>•</div>
                <div className='text-zinc-400'>{character.occupation}</div>
                <div className='text-zinc-500'>•</div>
                <div className='flex items-center gap-2'>
                  <span className='text-zinc-400'>NÍVEL</span>
                  <div
                    className='flex h-8 w-8 -skew-x-12 items-center justify-center text-xl font-black text-white shadow-lg'
                    style={{ backgroundColor: 'var(--theme-color)' }}
                  >
                    {character.level}
                  </div>
                </div>
              </div>
            </header>

            <div className='grid grid-cols-1 gap-8 px-4 pb-10 sm:px-8 lg:grid-cols-3'>
              <div className='flex flex-col space-y-8'>
                <div className='group relative'>
                  <SectionTitle className='mb-4'>Atributos</SectionTitle>
                  <div className='relative z-10 ml-4 mt-6 flex flex-col gap-6 sm:ml-12'>
                    <div
                      className='absolute bottom-4 left-[-20px] top-4 w-px bg-gradient-to-b from-transparent to-transparent'
                      style={{
                        backgroundImage:
                          'linear-gradient(to bottom, transparent, var(--theme-color), transparent)',
                      }}
                    ></div>

                    {Object.entries(character.attributes).map(([key, val]) => {
                      const effective = getEffectiveDie(val as number, key);
                      return (
                        <div
                          key={key}
                          onClick={() => {
                            setActiveAttribute(key);
                            setActiveSkillId(null);
                          }}
                          className='flex w-full max-w-[200px] cursor-pointer items-center justify-between transition-transform hover:translate-x-2'
                        >
                          <span className='font-serif text-xl font-bold uppercase tracking-widest sm:text-2xl'>
                            {key === 'physical'
                              ? 'FÍSICO'
                              : key === 'mind'
                                ? 'MENTE'
                                : 'EMOÇÃO'}
                          </span>
                          <div className='relative'>
                            <DieShape
                              sides={effective.value}
                              className='h-10 w-10 sm:h-12 sm:w-12'
                              colorClass={
                                effective.modified
                                  ? 'text-red-500'
                                  : 'text-[var(--theme-color)]'
                              }
                            />
                            {effective.modified && (
                              <span className='absolute -right-2 -top-1 text-[10px] font-bold text-red-500'>
                                ↓
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <SectionTitle className='mb-6'>Perícias</SectionTitle>
                  <div className='scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-zinc-950 flex max-h-[500px] flex-col overflow-y-auto pr-4'>
                    {character.skills.map((skill) => {
                      const effectiveAttr = getEffectiveDie(
                        (character.attributes as any)[skill.governed_by],
                        skill.governed_by
                      );
                      return (
                        <div
                          key={skill.id}
                          onClick={() => {
                            setActiveAttribute(skill.governed_by);
                            setActiveSkillId(skill.id);
                          }}
                          className='my-1 grid cursor-pointer grid-cols-[1fr_auto_auto_auto] items-center gap-3 rounded px-2 py-1.5 text-sm opacity-90 hover:bg-zinc-900/50 hover:opacity-100'
                        >
                          <div className='pr-2 text-left font-bold uppercase tracking-wider text-zinc-300'>
                            {skill.name}
                          </div>
                          <DieShape
                            sides={skill.value}
                            className='h-7 w-7 sm:h-8 sm:w-8'
                            colorClass='text-zinc-200'
                          />
                          <span
                            className='text-lg font-black'
                            style={{ color: 'var(--theme-color)' }}
                          >
                            +
                          </span>
                          <div className='relative'>
                            <DieShape
                              sides={effectiveAttr.value}
                              className='h-7 w-7 sm:h-8 sm:w-8'
                              colorClass={
                                effectiveAttr.modified
                                  ? 'text-red-500'
                                  : 'text-[var(--theme-color)]'
                              }
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className='relative flex flex-col items-center justify-start pt-4'>
                <div className='relative z-20 mb-6 flex w-full flex-wrap justify-center gap-2 px-4'>
                  {BUILTIN_CONDITIONS.map((cond) => {
                    const isActive =
                      cond.id === 'ajudado'
                        ? ajudado
                        : character.active_effects.some(
                            (e) => e.id === cond.id
                          );
                    return (
                      <button
                        key={cond.id}
                        onClick={() => {
                          if (cond.id === 'ajudado') {
                            setAjudado(!isActive);
                          } else {
                            isActive
                              ? removeActiveEffect(cond.id)
                              : applyBuiltinEffect(cond.id);
                          }
                        }}
                        title={cond.desc}
                        className={`rounded border px-3 py-1 text-[10px] font-bold uppercase tracking-widest transition-colors ${
                          isActive
                            ? cond.activeClass
                            : 'border-zinc-800 bg-black/50 text-zinc-600 hover:border-zinc-600 hover:text-zinc-300'
                        }`}
                      >
                        {cond.label}
                      </button>
                    );
                  })}
                </div>

                {isDying && (
                  <div className='absolute left-1/2 top-1/2 z-50 flex w-full -translate-x-1/2 -translate-y-1/2 flex-col items-center'>
                    {character.resources.hp.current <= 0 ? (
                      <div
                        className='group flex animate-pulse cursor-pointer flex-col items-center'
                        onClick={() => !isDead && rollDeathSave('hp')}
                      >
                        <HeartCrack
                          size={80}
                          className='mb-4 text-red-600 drop-shadow-[0_0_20px_rgba(220,38,38,1)] transition-transform group-hover:scale-110'
                        />
                        <span className='text-center font-bold leading-relaxed tracking-widest text-red-500 drop-shadow-[0_0_10px_rgba(220,38,38,0.8)]'>
                          {isDead ? 'VOCÊ MORREU' : 'TESTE DE VIGOR NECESSÁRIO'}
                        </span>
                      </div>
                    ) : (
                      <div
                        className='group flex animate-pulse cursor-pointer flex-col items-center'
                        onClick={() => !isInsane && rollDeathSave('dp')}
                      >
                        <Brain
                          size={80}
                          className='mb-4 text-blue-600 drop-shadow-[0_0_20px_rgba(37,99,235,1)] transition-transform group-hover:scale-110'
                        />
                        <span className='text-center font-bold leading-relaxed tracking-widest text-blue-500 drop-shadow-[0_0_10px_rgba(37,99,235,0.8)]'>
                          {isInsane
                            ? 'VOCÊ ENLOUQUECEU'
                            : 'TESTE DE DISCIPLINA NECESSÁRIO'}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                <div
                  className={`relative mx-auto aspect-[2/3] w-full max-w-sm overflow-hidden rounded-t-full border-b-4 ${isDying ? 'border-zinc-700' : 'border-[var(--theme-color)]'} flex items-end justify-center bg-gradient-to-t from-zinc-900 to-zinc-950 shadow-[inset_0_-50px_100px_rgba(0,0,0,0.8)]`}
                >
                  <svg
                    viewBox='0 0 200 300'
                    className='h-[80%] w-[80%] opacity-80'
                    style={{
                      filter: 'drop-shadow(0 0 15px var(--theme-color))',
                    }}
                  >
                    <path
                      d='M100,50 C120,50 135,65 135,85 C135,105 120,120 100,120 C80,120 65,105 65,85 C65,65 80,50 100,50 Z M50,180 C50,140 70,130 100,130 C130,130 150,140 150,180 L160,300 L40,300 Z'
                      fill='#18181b'
                      stroke='#3f3f46'
                      strokeWidth='2'
                    />
                    <path
                      d='M50,180 L100,220 L150,180'
                      fill='none'
                      stroke='var(--theme-color)'
                      strokeWidth='2.5'
                      opacity='0.35'
                    />
                    <path
                      d='M80,135 L80,300 M120,135 L120,300'
                      fill='none'
                      stroke='#27272a'
                      strokeWidth='2'
                    />
                  </svg>

                  <div className='absolute bottom-0 h-1/3 w-full bg-gradient-to-t from-black to-transparent'></div>
                </div>
              </div>

              <div className='flex flex-col space-y-10'>
                <div className='flex flex-col space-y-6 rounded-sm border border-zinc-800/50 bg-zinc-900/30 p-6'>
                  <ResourceTrack
                    label='PV'
                    current={character.resources.hp.current}
                    max={character.resources.hp.max}
                    colorClass='text-zinc-200'
                    blockClass='bg-red-400'
                    onSetExact={(val: number) =>
                      applyResourceChange(
                        'hp',
                        val - character.resources.hp.current
                      )
                    }
                  />
                  <ResourceTrack
                    label='PD'
                    current={character.resources.dp.current}
                    max={character.resources.dp.max}
                    colorClass='text-zinc-400'
                    blockClass='bg-indigo-500'
                    onSetExact={(val: number) =>
                      applyResourceChange(
                        'dp',
                        val - character.resources.dp.current
                      )
                    }
                  />
                </div>

                <div className='flex flex-col space-y-6'>
                  {character.abilities.map((ability) => {
                    if (ability.id === 'impeto') {
                      return (
                        <div
                          key={ability.id}
                          className='group relative overflow-hidden border border-zinc-800/50 bg-zinc-950/80 p-5 transition-colors hover:border-zinc-700/50'
                        >
                          <div className='absolute left-0 top-0 h-full w-1 bg-[var(--theme-color)]'></div>
                          <div className='mb-3 flex items-start justify-between'>
                            <SectionTitle className='origin-left scale-90'>
                              {ability.name}
                            </SectionTitle>
                            <div className='flex gap-1 rounded-sm border border-zinc-800 bg-black p-1'>
                              {[0, 1, 2].map((i) => (
                                <div
                                  key={i}
                                  onClick={() =>
                                    setImpeto(i < impeto ? i : i + 1)
                                  }
                                  className={`h-4 w-6 cursor-pointer transition-colors ${i < impeto ? 'bg-[var(--theme-color)]' : 'bg-zinc-900 hover:bg-zinc-800'}`}
                                />
                              ))}
                            </div>
                          </div>
                          <div className='mb-4 text-sm leading-relaxed text-zinc-400'>
                            {ability.description}
                          </div>

                          <div className='flex gap-2 border-t border-zinc-800 pt-3 opacity-0 transition-opacity group-hover:opacity-100'>
                            <button
                              onClick={() => {
                                if (impeto >= 1 && !pendingImpetoD4) {
                                  setImpeto((prev) => prev - 1);
                                  setPendingImpetoD4(true);
                                  addMessage({
                                    sender: character.name,
                                    type: 'text',
                                    content:
                                      'Preparou 1 Ímpeto! O próximo teste receberá +d4.',
                                  });
                                }
                              }}
                              disabled={impeto < 1 || pendingImpetoD4}
                              className={`flex-1 rounded border py-1.5 text-[10px] uppercase tracking-wider transition-colors ${pendingImpetoD4 ? 'border-[var(--theme-color)] bg-[var(--theme-color)] text-white opacity-80' : 'border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 disabled:opacity-50'}`}
                            >
                              {pendingImpetoD4
                                ? 'Ímpeto Preparado (+d4)'
                                : 'Gastar 1 (+d4)'}
                            </button>

                            <button
                              onClick={() => {
                                if (impeto >= 3) {
                                  setImpeto((prev) => prev - 3);
                                  addMessage({
                                    sender: character.name,
                                    type: 'text',
                                    content:
                                      'Gastou 3 Ímpeto para aumentar um atributo em um passo até o fim da cena.',
                                  });
                                }
                              }}
                              disabled={impeto < 3}
                              className='flex-1 rounded border border-zinc-800 bg-zinc-900 py-1.5 text-[10px] uppercase tracking-wider text-zinc-300 hover:bg-zinc-800 disabled:opacity-50'
                            >
                              Gastar 3 (+1 Passo)
                            </button>
                          </div>
                        </div>
                      );
                    }

                    if (ability.id === 'avaliacao') {
                      return (
                        <div
                          key={ability.id}
                          className='group relative overflow-hidden border border-zinc-800/50 bg-zinc-950/80 p-5 transition-colors hover:border-zinc-700/50'
                        >
                          <div className='absolute left-0 top-0 h-full w-1 bg-[var(--theme-color)]'></div>
                          <div className='mb-3 flex items-start justify-between'>
                            <SectionTitle className='origin-left scale-90'>
                              {ability.name}
                            </SectionTitle>

                            <div className='flex gap-2 rounded-sm border border-zinc-800 bg-black p-1.5'>
                              {[0, 1].map((i) => (
                                <DieShape
                                  key={i}
                                  sides={4}
                                  className='h-6 w-6 cursor-default'
                                  colorClass={
                                    i < avaliacao
                                      ? 'text-[var(--theme-color)]'
                                      : 'text-zinc-700 opacity-50'
                                  }
                                />
                              ))}
                            </div>
                          </div>
                          <div className='mb-4 text-sm leading-relaxed text-zinc-400'>
                            {ability.description}
                          </div>

                          <div className='flex flex-col gap-2 border-t border-zinc-800 pt-3 opacity-0 transition-opacity group-hover:opacity-100'>
                            <button
                              onClick={() => {
                                if (character.resources.dp.current >= 2) {
                                  applyResourceChange('dp', -2);
                                  setAvaliacao(2);
                                  addMessage({
                                    sender: character.name,
                                    type: 'text',
                                    content:
                                      'Gastou 2 PD para ativar Avaliação (Garantindo 2 usos de d4).',
                                  });
                                }
                              }}
                              disabled={
                                character.resources.dp.current < 2 ||
                                avaliacao === 2
                              }
                              className='flex items-center justify-center gap-2 rounded border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs uppercase tracking-wider text-zinc-300 transition-colors hover:bg-zinc-800 disabled:opacity-50'
                            >
                              Ativar Avaliação (-2 PD)
                            </button>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={ability.id}
                        className='group relative overflow-hidden border border-zinc-800/50 bg-zinc-950/80 p-5 transition-colors hover:border-zinc-700/50'
                      >
                        <div
                          className={`absolute left-0 top-0 h-full w-1 transition-all ${ability.active ? 'bg-[var(--theme-color)] shadow-[0_0_10px_var(--theme-color)]' : 'bg-zinc-800'}`}
                        ></div>

                        <div className='mb-3 w-fit'>
                          <SectionTitle
                            onClick={() =>
                              toggleEntry(ability.id, !ability.active)
                            }
                          >
                            {ability.name}
                          </SectionTitle>
                        </div>

                        <div className='text-sm leading-relaxed text-zinc-400'>
                          {ability.description}
                        </div>

                        <div className='mt-4 flex justify-end gap-2 border-t border-zinc-800/50 pt-3'>
                          <button
                            onClick={() =>
                              handleUseAbility(
                                ability.name,
                                ability.description
                              )
                            }
                            className='flex items-center justify-center rounded border border-zinc-800 bg-zinc-900 p-2 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white'
                            title='Enviar ao Chat'
                          >
                            <MessageSquare size={16} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {activeAttribute && (
        <SkillPromptModal
          attributeName={activeAttribute}
          initialSkillId={activeSkillId}
          onClose={() => {
            setActiveAttribute(null);
            setActiveSkillId(null);
          }}
        />
      )}
    </div>
  );
}
