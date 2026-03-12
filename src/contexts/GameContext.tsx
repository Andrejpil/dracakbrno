import { createContext, useContext, ReactNode } from 'react';
import { useGameState } from '@/hooks/useGameState';

type GameContextType = ReturnType<typeof useGameState>;

const GameContext = createContext<GameContextType | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const state = useGameState();
  return <GameContext.Provider value={state}>{children}</GameContext.Provider>;
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be inside GameProvider');
  return ctx;
}
