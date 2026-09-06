import { HomeScreen, WelcomeScreen } from '../features/home';
import { useSessionStore } from '../features/session';
import { VttApp } from '../features/vtt';

export default function App() {
  const { username, activeGamePath } = useSessionStore();

  if (!username) return <WelcomeScreen />;
  if (!activeGamePath) return <HomeScreen />;

  return <VttApp />;
}
