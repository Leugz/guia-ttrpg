import { GameBoard } from './components/canvas/GameBoard';
import { CharacterSidebar } from './components/character/CharacterSidebar';
import { ChatSidebar } from './components/chat/ChatSideBar';

export default function App() {
  return (
    <div className='flex h-screen w-screen overflow-hidden bg-neutral-900 text-white'>
      <ChatSidebar />
      <GameBoard />
      <CharacterSidebar />
    </div>
  );
}
