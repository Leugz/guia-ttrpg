import { useState, useEffect } from 'react';
import { useCharacterStore, getProfileColor } from '../characterStore';
import { TestRequest, ResolvedPool, TestOutcome } from '../../../shared/types';
import { useChatStore } from '../../chat/chatStore';
import * as gameClient from '../../session/net/gameClient';

export function SkillPromptModal({
  attributeName,
  initialSkillId,
  onClose,
}: {
  attributeName: string;
  initialSkillId?: string | null;
  onClose: () => void;
}) {
  const {
    character,
    activeSheetId,
    applyResourceChange,
    impeto,
    setImpeto,
    avaliacao,
    setAvaliacao,
    pendingImpetoD4,
    setPendingImpetoD4,
    ajudado,
    setAjudado, // NEW
  } = useCharacterStore();

  const { addMessage } = useChatStore();

  const [selectedSkill, setSelectedSkill] = useState<string | null>(
    initialSkillId || null
  );
  const [isSecret, setIsSecret] = useState(false);

  // FIXED: Auto-loads from the store instead of character.active_effects
  const [helpSteps, setHelpSteps] = useState<number>(ajudado ? 1 : 0);

  const [triggeredAbilities, setTriggeredAbilities] = useState<string[]>(() => {
    const actives =
      character?.abilities.filter((a) => a.active).map((a) => a.id) || [];
    if (pendingImpetoD4) actives.push('impeto_1');
    return actives;
  });

  const [dt, setDt] = useState<number | ''>(7);
  const [preview, setPreview] = useState<ResolvedPool | null>(null);

  const virtualTriggers: any[] = [];

  if (
    attributeName === 'mind' &&
    character?.abilities.some((a) => a.id === 'foco_mental') &&
    character.resources.dp.current >= 2
  ) {
    virtualTriggers.push({
      id: 'foco_mental',
      name: 'Foco Mental (+d4)',
      cost: '-2 PD',
    });
  }
  if (
    attributeName === 'emotion' &&
    character?.abilities.some((a) => a.id === 'foco_emocional') &&
    character.resources.dp.current >= 2
  ) {
    virtualTriggers.push({
      id: 'foco_emocional',
      name: 'Foco Emocional (+d4)',
      cost: '-2 PD',
    });
  }

  if (impeto >= 1 || pendingImpetoD4) {
    virtualTriggers.push({
      id: 'impeto_1',
      name: 'Gastar Ímpeto (+d4)',
      cost: '-1 Ímpeto',
    });
  }
  if (avaliacao >= 1) {
    virtualTriggers.push({
      id: 'avaliacao_1',
      name: 'Gastar 1 Avaliação (+d4)',
      cost: '-1 Avaliação',
    });
  }
  if (avaliacao >= 2) {
    virtualTriggers.push({
      id: 'avaliacao_2',
      name: 'Gastar 2 Avaliações (+2d4)',
      cost: '-2 Avaliações',
    });
  }

  const buildRequest = (): TestRequest => {
    const extraDice: number[] = [];
    if (triggeredAbilities.includes('impeto_1')) extraDice.push(4);
    if (triggeredAbilities.includes('foco_mental')) extraDice.push(4);
    if (triggeredAbilities.includes('foco_emocional')) extraDice.push(4);

    if (triggeredAbilities.includes('avaliacao_1')) extraDice.push(4);
    if (triggeredAbilities.includes('avaliacao_2')) {
      extraDice.push(4);
      extraDice.push(4);
    }

    const cleanTriggers = triggeredAbilities.filter(
      (id) =>
        ![
          'impeto_1',
          'foco_mental',
          'foco_emocional',
          'avaliacao_1',
          'avaliacao_2',
        ].includes(id)
    );

    return {
      attribute: attributeName,
      skill_id: selectedSkill || undefined,
      triggered: cleanTriggers,
      help: helpSteps > 0 ? helpSteps : undefined,
      extra_dice: extraDice,
      secret: isSecret,
      dt: dt !== '' ? dt : undefined,
    };
  };

  useEffect(() => {
    if (!activeSheetId) return;
    let cancelled = false;
    gameClient
      .previewTest(activeSheetId, buildRequest())
      .then((pool: ResolvedPool) => {
        // A slower reply must not overwrite a newer preview.
        if (!cancelled) setPreview(pool);
      })
      .catch(console.error);
    return () => {
      cancelled = true;
    };
  }, [
    selectedSkill,
    isSecret,
    helpSteps,
    triggeredAbilities,
    activeSheetId,
    dt,
  ]);

  const handleRoll = async () => {
    if (!activeSheetId || !character) return;
    try {
      const outcome: TestOutcome = await gameClient.rollTest(
        activeSheetId,
        buildRequest()
      );

      if (triggeredAbilities.includes('foco_mental'))
        applyResourceChange('dp', -2);
      if (triggeredAbilities.includes('foco_emocional'))
        applyResourceChange('dp', -2);

      if (triggeredAbilities.includes('impeto_1')) {
        if (!pendingImpetoD4) setImpeto((prev) => prev - 1);
        setPendingImpetoD4(false);
      }

      if (triggeredAbilities.includes('avaliacao_1'))
        setAvaliacao((prev) => prev - 1);
      if (triggeredAbilities.includes('avaliacao_2'))
        setAvaliacao((prev) => prev - 2);

      // FIXED: Automatically clears the local "Ajudado" state
      if (helpSteps > 0 && ajudado) {
        setAjudado(false);
      }

      addMessage({
        sender: character.name,
        color: getProfileColor(character.profile),
        type: 'roll',
        rollLabel: outcome.pool.label,
        rollResult: outcome.result,
      });

      if (dt !== '' && outcome.result.total_sum < dt) {
        if (
          character.abilities.some(
            (a) => a.id === 'impeto' || a.id === 'esforco_e_suor'
          )
        ) {
          setImpeto((prev) => Math.min(3, prev + 1));
          addMessage({
            sender: 'Sistema',
            color: getProfileColor(character.profile),
            type: 'text',
            content: `Falha no teste (Tirou ${outcome.result.total_sum} vs DT ${dt}). Preencheu 1 espaço de Ímpeto!`,
          });
        }
      }
      onClose();
    } catch (error) {
      console.error('Roll failed:', error);
    }
  };

  const availableSkills =
    character?.skills.filter((s) => s.governed_by === attributeName) || [];

  return (
    <div className='fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm'>
      <div className='w-[450px] rounded-lg border border-zinc-700 bg-[#0a0a0a] p-6 shadow-2xl'>
        <div className='mb-4 flex items-center justify-between border-b border-zinc-800 pb-2'>
          <h3 className='font-serif text-xl font-black uppercase tracking-widest text-white'>
            Teste de{' '}
            {attributeName === 'physical'
              ? 'Físico'
              : attributeName === 'mind'
                ? 'Mente'
                : 'Emoção'}
          </h3>
          <div className='flex items-center gap-2 rounded border border-zinc-700 bg-zinc-900 px-2 py-1'>
            <span className='text-xs font-bold text-zinc-400'>DT</span>
            <input
              type='number'
              value={dt}
              onChange={(e) =>
                setDt(e.target.value ? Number(e.target.value) : '')
              }
              placeholder='Nenhum'
              className='w-16 bg-transparent text-right font-mono text-lg font-bold text-[var(--theme-color)] outline-none'
            />
          </div>
        </div>

        <div className='scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent mb-4 grid max-h-40 grid-cols-2 gap-2 overflow-y-auto pr-2'>
          {availableSkills.map((skill) => (
            <button
              key={skill.id}
              onClick={() => setSelectedSkill(skill.id)}
              className={`relative flex items-center justify-between overflow-hidden rounded border px-3 py-2 text-sm transition-colors ${
                selectedSkill === skill.id
                  ? 'border-[var(--theme-color)] bg-zinc-900 text-white'
                  : 'border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:brightness-125'
              }`}
            >
              <span className='relative z-10 font-bold'>{skill.name}</span>
              <div className='relative z-10 flex h-7 w-7 items-center justify-center'>
                <img
                  src={`/dice/d${skill.value}.svg`}
                  alt=''
                  className='pointer-events-none absolute inset-0 h-full w-full opacity-20'
                />
                <span className='relative z-10 font-mono text-base font-bold text-white'>
                  {skill.value}
                </span>
              </div>
            </button>
          ))}
        </div>

        <div className='mb-4'>
          <span className='mb-2 block text-xs font-bold uppercase text-zinc-500'>
            Ajuda Recebida
          </span>
          <div className='flex gap-2'>
            <button
              onClick={() => setHelpSteps(0)}
              className={`flex-1 rounded py-1.5 text-xs font-bold transition-colors ${helpSteps === 0 ? 'bg-[var(--theme-color)] text-white' : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'}`}
            >
              Nenhuma
            </button>
            <button
              onClick={() => setHelpSteps(1)}
              className={`flex-1 rounded py-1.5 text-xs font-bold transition-colors ${helpSteps === 1 ? 'bg-[var(--theme-color)] text-white' : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'}`}
            >
              +1 Passo
            </button>
            <button
              onClick={() => setHelpSteps(2)}
              className={`flex-1 rounded py-1.5 text-xs font-bold transition-colors ${helpSteps === 2 ? 'bg-[var(--theme-color)] text-white' : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'}`}
            >
              +2 Passos
            </button>
          </div>
        </div>

        {(virtualTriggers.length > 0 ||
          (character &&
            character.abilities.filter((a) => a.active).length > 0)) && (
          <div className='mb-4'>
            <span className='mb-2 block text-xs font-bold uppercase text-zinc-500'>
              Habilidades Ativas & Custos
            </span>
            <div className='flex flex-col gap-2'>
              {character?.abilities
                .filter((a) => a.active)
                .map((a) => (
                  <div
                    key={a.id}
                    className='flex items-center justify-between rounded border border-[var(--theme-color)] bg-zinc-900 px-3 py-2'
                  >
                    <span className='text-sm font-medium text-[var(--theme-color)]'>
                      {a.name}
                    </span>
                    <span className='text-xs font-bold text-zinc-500'>
                      Ativa na Ficha
                    </span>
                  </div>
                ))}

              {virtualTriggers.map((entry) => (
                <label
                  key={entry.id}
                  className={`flex items-center justify-between rounded border px-3 py-2 transition-colors ${
                    triggeredAbilities.includes(entry.id)
                      ? 'cursor-pointer border-[var(--theme-color)] bg-zinc-900'
                      : 'cursor-pointer border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800'
                  } ${entry.id === 'impeto_1' && pendingImpetoD4 ? 'cursor-not-allowed opacity-80' : ''}`}
                >
                  <div className='flex items-center gap-2'>
                    <input
                      type='checkbox'
                      className='h-3 w-3'
                      checked={triggeredAbilities.includes(entry.id)}
                      disabled={entry.id === 'impeto_1' && pendingImpetoD4}
                      onChange={(e) => {
                        let newTriggers = [...triggeredAbilities];
                        if (e.target.checked) {
                          newTriggers.push(entry.id);
                          if (entry.id === 'avaliacao_1')
                            newTriggers = newTriggers.filter(
                              (id) => id !== 'avaliacao_2'
                            );
                          if (entry.id === 'avaliacao_2')
                            newTriggers = newTriggers.filter(
                              (id) => id !== 'avaliacao_1'
                            );
                        } else {
                          newTriggers = newTriggers.filter(
                            (id) => id !== entry.id
                          );
                        }
                        setTriggeredAbilities(newTriggers);
                      }}
                    />
                    <span className='text-sm font-medium text-white'>
                      {entry.name}
                    </span>
                  </div>
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-bold ${entry.id === 'impeto_1' && pendingImpetoD4 ? 'bg-green-950 text-green-500' : 'bg-red-950/50 text-red-400'}`}
                  >
                    {entry.id === 'impeto_1' && pendingImpetoD4
                      ? 'Pago na Ficha'
                      : entry.cost}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div className='mb-4 mt-4 flex items-center gap-2 border-t border-zinc-800/50 pt-4'>
          <input
            type='checkbox'
            id='secret-skill-roll'
            checked={isSecret}
            onChange={(e) => setIsSecret(e.target.checked)}
            className='h-4 w-4 rounded border-zinc-700 bg-zinc-900 accent-[var(--theme-color)]'
          />
          <label
            htmlFor='secret-skill-roll'
            className='cursor-pointer text-sm font-medium text-zinc-400 hover:text-white'
          >
            Rolagem Secreta (Apenas Mestre)
          </label>
        </div>

        {preview && (
          <div className='mb-4 rounded border border-zinc-800 bg-zinc-950 p-3'>
            <span className='mb-2 block text-xs uppercase text-zinc-500'>
              Parada de Dados
            </span>
            <div className='flex flex-wrap gap-2'>
              {preview.dice.map((die, i) => (
                <div
                  key={i}
                  className='relative flex h-8 w-8 items-center justify-center rounded bg-zinc-900'
                >
                  <img
                    src={`/dice/d${die.sides}.svg`}
                    alt=''
                    className='pointer-events-none absolute inset-0 h-full w-full p-1 opacity-20'
                  />
                  <span className='relative z-10 font-mono text-sm font-bold text-white'>
                    {die.sides}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className='mt-4 flex justify-end gap-3'>
          <button
            onClick={onClose}
            className='text-zinc-500 transition-colors hover:text-white'
          >
            Cancelar
          </button>
          <button
            onClick={handleRoll}
            className='rounded border border-zinc-700 bg-zinc-800 px-4 py-2 font-bold text-white transition-colors hover:bg-zinc-700'
          >
            Rolar Dados
          </button>
        </div>
      </div>
    </div>
  );
}
