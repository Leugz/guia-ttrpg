import { Ability } from '../../store/characterStore';

interface AbilityListProps {
  characterName: string;
  abilities: Ability[];
  onUseAbility: (name: string, description: string) => void;
}

export function AbilityList({
  characterName,
  abilities,
  onUseAbility,
}: AbilityListProps) {
  if (!abilities || abilities.length === 0) return null;

  return (
    <div className='mt-2 flex flex-col gap-2'>
      <h3 className='mb-1 border-b border-neutral-800 pb-1 text-xs font-bold uppercase tracking-wider text-neutral-500'>
        Habilidades
      </h3>
      {abilities.map((ability, index) => (
        <div
          key={index}
          onClick={() => onUseAbility(ability.name, ability.description)}
          className='cursor-pointer rounded border border-neutral-800 bg-neutral-900 p-3 transition-colors hover:border-neutral-600 hover:bg-neutral-800'
        >
          <div className='mb-1 flex items-center justify-between'>
            <span className='text-sm font-bold text-white'>{ability.name}</span>
            {ability.active && (
              <span className='rounded bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold uppercase text-blue-400'>
                Ativa
              </span>
            )}
          </div>
          <span className='block text-xs leading-relaxed text-neutral-400'>
            {ability.description}
          </span>
        </div>
      ))}
    </div>
  );
}
