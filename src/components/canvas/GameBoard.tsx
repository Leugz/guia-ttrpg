import { Stage, Layer, Circle } from 'react-konva';
import { useEffect, useState } from 'react';
import { useCharacterStore } from '../../store/characterStore';

export function GameBoard() {
  const [windowSize, setWindowSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });
  const { character } = useCharacterStore();

  useEffect(() => {
    const handleResize = () =>
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Check the strict backend saving throw states (Section 4.13)
  const isDead =
    character &&
    (character.death_saves.hp.failed || character.death_saves.dp.failed);
  const isDying =
    character &&
    (character.resources.hp.current <= 0 ||
      character.resources.dp.current <= 0);

  // Black for dead, Gray for dying (0 HP/DP), Red for healthy
  const tokenColor = isDead ? '#1a1a1a' : isDying ? '#555555' : '#ef4444';

  return (
    <Stage width={windowSize.width - 620} height={windowSize.height}>
      <Layer>
        <Circle x={150} y={150} radius={25} fill={tokenColor} draggable />
      </Layer>
    </Stage>
  );
}
