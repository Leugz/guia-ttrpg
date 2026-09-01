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

  const isDeadOrDying =
    character &&
    (character.resources.pv.current <= 0 ||
      character.resources.pd.current <= 0);
  const tokenColor = isDeadOrDying ? '#555555' : '#ef4444';

  return (
    <Stage width={windowSize.width - 620} height={windowSize.height}>
      <Layer>
        <Circle x={150} y={150} radius={25} fill={tokenColor} draggable />
      </Layer>
    </Stage>
  );
}
