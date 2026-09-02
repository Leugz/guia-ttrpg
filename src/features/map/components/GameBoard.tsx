import { Stage, Layer } from 'react-konva';
import { useEffect, useState } from 'react';

export function GameBoard() {
  const [windowSize, setWindowSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  useEffect(() => {
    const handleResize = () =>
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <Stage
      width={windowSize.width - 620}
      height={windowSize.height}
      className='bg-[#121212]'
    >
      <Layer>
        {/* Board implementation deferred until mechanics are complete */}
      </Layer>
    </Stage>
  );
}
