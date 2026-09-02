interface CharacterHeaderProps {
  name: string;
  occupation: string;
  level: number;
}

export function CharacterHeader({
  name,
  occupation,
  level,
}: CharacterHeaderProps) {
  return (
    <div className='rounded border border-neutral-800 bg-neutral-900 p-3'>
      <h3 className='text-lg font-bold text-white'>{name}</h3>
      <p className='text-sm text-neutral-400'>
        {occupation} • Nível {level}
      </p>
    </div>
  );
}
