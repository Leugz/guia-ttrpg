import { Stage, Layer, Circle } from 'react-konva';
import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

export default function App() {
  const [windowSize, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight });

  // The Konva canvas dynamically resizes while the HUD panels anchor to edges[cite: 1]
  useEffect(() => {
    const handleResize = () => setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="flex h-screen bg-neutral-900 text-white">
      {/* 2D Grid & Tokens[cite: 1] */}
      <Stage width={windowSize.width - 300} height={windowSize.height}>
        <Layer>
          {/* User profile picture map tokens[cite: 1] */}
          <Circle x={150} y={150} radius={25} fill="gray" draggable />
        </Layer>
      </Stage>

      {/* Ordem Paranormal Character Sheet / HUD[cite: 1] */}
      <aside className="w-[300px] border-l border-neutral-700 bg-black p-4">
        <h2 className="text-xl font-bold">Character Sheet</h2>
        {/* State Control and Resource mirroring will render here[cite: 1] */}
      </aside>
    </div>
  );
}
