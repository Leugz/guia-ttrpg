import { useState, useEffect } from 'react';
import { ChatSidebar } from './features/chat/components/ChatSidebar';
import { GameBoard } from './features/map/components/GameBoard';
import { CharacterSidebar } from './features/character-sheet/components/CharacterSidebar';
import { FreeDiceRoller } from './features/dice/components/FreeDiceRoller';
import { useChatStore } from './features/chat/chatStore';

export default function App() {
  const [isRollerOpen, setIsRollerOpen] = useState(false);
  const { connect } = useChatStore();

  useEffect(() => {
    let hostIp = window.location.hostname;
    if (
      hostIp === 'tauri.localhost' ||
      hostIp === '' ||
      hostIp === 'localhost'
    ) {
      hostIp = 'localhost';
    }
    connect(hostIp);

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        setIsRollerOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [connect]);

  return (
    <div className='flex h-screen w-screen overflow-hidden bg-neutral-900 text-white'>
      <ChatSidebar />
      <GameBoard />
      <CharacterSidebar />

      <FreeDiceRoller
        isOpen={isRollerOpen}
        onClose={() => setIsRollerOpen(false)}
      />
    </div>
  );
}
