import { useEffect, useState } from 'react';

export interface TypewriterTextProps {
  text: string;
}

export function TypewriterText({ text }: TypewriterTextProps) {
  const [displayText, setDisplayText] = useState('');

  useEffect(() => {
    let isCancelled = false;
    let timer: number;
    let charIdx = 0;

    const startTyping = () => {
      if (isCancelled) return;
      if (charIdx <= text.length) {
        setDisplayText(text.slice(0, charIdx));
        charIdx++;
        timer = window.setTimeout(startTyping, Math.random() * 50 + 50);
      } else {
        timer = window.setTimeout(eraseTyping, 10000);
      }
    };

    const eraseTyping = () => {
      if (isCancelled) return;
      if (charIdx > 0) {
        charIdx--;
        setDisplayText(text.slice(0, charIdx));
        timer = window.setTimeout(eraseTyping, 20);
      } else {
        timer = window.setTimeout(startTyping, 500);
      }
    };

    startTyping();

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [text]);

  return (
    <span>
      {displayText}
      <span className='ml-1 inline-block h-[0.9em] w-[0.4em] animate-pulse bg-zinc-200 align-baseline' />
    </span>
  );
}
