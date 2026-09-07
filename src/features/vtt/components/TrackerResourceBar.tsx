import { ResourceMathInput } from '../../character-sheet/components/ResourceMathInput';

const VISUAL_BLOCKS = 10;

export interface TrackerResourceBarProps {
  label: string;
  current: number;
  max: number;
  colorClass: string;
  activeColorClass: string;
  onUpdate: (delta: number) => void;
}

/**
 * The PV/PD pip bar shown on the table overlay, for the player's own sheet and
 * for each party member the GM has selected.
 *
 * Lifted out of `VttApp`, where it was declared inline with a `props: any`
 * signature. Distinct from `character-sheet/components/ResourceBar`, which is
 * a read-only summary tile inside the sheet itself.
 */
export function TrackerResourceBar({
  label,
  current,
  max,
  colorClass,
  activeColorClass,
  onUpdate,
}: TrackerResourceBarProps) {
  const percentage = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0;
  const activeCount = Math.round(percentage * VISUAL_BLOCKS);

  return (
    <div className='flex items-center gap-1'>
      <div className={`w-8 font-serif text-lg font-bold ${colorClass}`}>
        {label}
      </div>
      <ResourceMathInput current={current} max={max} onUpdate={onUpdate} />
      <div className='ml-2 flex flex-nowrap gap-1'>
        {Array.from({ length: VISUAL_BLOCKS }, (_, index) => (
          <div
            key={index}
            className={`h-4 w-3.5 -skew-x-12 border border-black/50 shadow-sm transition-colors ${index < activeCount ? activeColorClass : 'bg-zinc-800/80'}`}
          />
        ))}
      </div>
    </div>
  );
}
