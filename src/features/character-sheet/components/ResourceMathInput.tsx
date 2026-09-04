import { useState, useRef, useEffect } from 'react';

interface ResourceMathInputProps {
  current: number;
  max: number;
  onUpdate: (val: number) => void;
}

export function ResourceMathInput({
  current,
  max,
  onUpdate,
}: ResourceMathInputProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const handleCommit = () => {
    setIsEditing(false);
    if (!inputValue.trim()) return;

    let delta = 0;
    const strVal = inputValue.trim().replace('+', ''); // Strip + if they typed it manually

    if (strVal.startsWith('-')) {
      delta = parseInt(strVal) || 0; // parseInt("-5") becomes -5
    } else {
      delta = parseInt(strVal) || 0; // parseInt("5") becomes 5
    }

    const newValue = current + delta;
    const clamped = Math.max(0, Math.min(max, newValue));

    onUpdate(clamped - current);
    setInputValue('');
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type='text'
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onBlur={handleCommit}
        onKeyDown={(e) => e.key === 'Enter' && handleCommit()}
        placeholder={current.toString()}
        className='w-10 border border-zinc-700 bg-zinc-900 px-1 text-right font-mono text-sm text-white outline-none'
      />
    );
  }

  return (
    <div
      onClick={() => setIsEditing(true)}
      className='w-10 cursor-text text-right font-mono text-sm text-zinc-400 transition-colors hover:text-white'
      title='Editar (ex: 5 para curar 5, -2 para perder 2)'
    >
      {current}
    </div>
  );
}
