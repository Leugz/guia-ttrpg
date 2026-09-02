interface ResourceBarProps {
  label: string;
  current: number;
  max: number;
  colorClass: string;
  onClick?: () => void;
}

export function ResourceBar({
  label,
  current,
  max,
  colorClass,
  onClick,
}: ResourceBarProps) {
  return (
    <div
      onClick={onClick}
      className={`flex-1 rounded border border-neutral-800 bg-neutral-900 p-2 text-center transition-colors hover:bg-neutral-800 ${onClick ? 'cursor-pointer' : ''}`}
    >
      <span
        className={`block text-xs font-bold uppercase tracking-wider ${colorClass}`}
      >
        {label}
      </span>
      <span className='font-mono text-lg font-bold text-white'>
        {current} {/* renamed */}
        <span className='text-sm font-normal text-neutral-500'>/ {max}</span>
      </span>
    </div>
  );
}
