import React from 'react';
import { useSessionStore } from './features/session/sessionStore';
import { WelcomeScreen } from './features/home/components/WelcomeScreen';
import { HomeScreen } from './features/home/components/HomeScreen';
import { VttApp } from './features/vtt/VttApp';

export default function App() {
  const { username, activeGamePath } = useSessionStore();

  if (!username) {
    return <WelcomeScreen />;
  }

  if (!activeGamePath) {
    return <HomeScreen />;
  }

  return <VttApp />;
}
