import { Entry } from '../../../shared/types';
import { useCharacterStore } from '../characterStore';

interface AbilityListProps {
  characterName: string;
  abilities: Entry[];
  onUseAbility: (name: string, description: string) => void;
}

export function AbilityList({ abilities, onUseAbility }: AbilityListProps) {
  const { toggleEntry } = useCharacterStore();

  if (!abilities || abilities.length === 0) return null;

  // Helper to check if an entry has toggleable step effects
  const hasStepEffect = (entry: Entry) =>
    entry.effects.some(
      (effect) => effect.unit === 'step' || effect.unit === 'Step'
    );

  return (
    <div className='mt-2 flex flex-col gap-2'>
      <h3 className='mb-1 border-b border-neutral-800 pb-1 text-xs font-bold uppercase tracking-wider text-neutral-500'>
        Habilidades
      </h3>
      {abilities.map((ability) => {
        const isToggleable = hasStepEffect(ability);

        return (
          <div
            key={ability.id}
            className='rounded border border-neutral-800 bg-neutral-900 p-3 transition-colors hover:border-neutral-600 hover:bg-neutral-800'
          >
            <div className='mb-2 flex items-center justify-between'>
              <span
                onClick={() => onUseAbility(ability.name, ability.description)}
                className='cursor-pointer text-sm font-bold text-white transition-colors hover:text-blue-400'
              >
                {ability.name}
              </span>

              {isToggleable && (
                <button
                  onClick={() => toggleEntry(ability.id, !ability.active)}
                  className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors ${
                    ability.active ? 'bg-blue-600' : 'bg-neutral-600'
                  }`}
                >
                  <span
                    className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                      ability.active ? 'translate-x-4' : 'translate-x-1'
                    }`}
                  />
                </button>
              )}
            </div>

            <span className='block text-xs leading-relaxed text-neutral-400'>
              {ability.description}
            </span>

            {/* Display the active tag visually if it's turned on */}
            {ability.active && (
              <div className='mt-2 inline-block rounded bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-400'>
                Efeito Ativo
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
