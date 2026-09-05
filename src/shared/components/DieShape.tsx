interface DieShapeProps {
  sides: number;
  value?: number;
  className?: string;
  colorClass?: string;
  isDropped?: boolean;
}

export function DieShape({
  sides,
  value,
  className = 'w-6 h-6',
  colorClass = 'text-white',
  isDropped = false,
}: DieShapeProps) {
  const displayValue = value !== undefined ? value : sides;

  return (
    <span
      className={`relative inline-flex items-center justify-center ${className} ${isDropped ? 'opacity-50 grayscale' : ''}`}
      title={`d${sides}`}
    >
      <img
        src={`/dice/d${sides}.svg`}
        alt=''
        className='pointer-events-none absolute inset-0 h-full w-full opacity-20'
      />
      <span
        className={`relative z-10 font-serif font-bold leading-none tracking-tighter ${colorClass}`}
        style={{ fontSize: '1.2em', marginTop: sides === 4 ? '0.2em' : '0' }}
      >
        {displayValue}
      </span>
      {isDropped && (
        <span className='absolute z-20 h-[2px] w-full -rotate-45 bg-red-900/80' />
      )}
    </span>
  );
}
