import { createContext, useContext, ReactNode } from 'react';
import { useGameState } from '@/hooks/useGameState';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

type GameContextType = ReturnType<typeof useGameState>;

const GameContext = createContext<GameContextType | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const state = useGameState();
  const currentLevelUp = state.levelUpQueue[0] || null;

  return (
    <GameContext.Provider value={state}>
      {children}
      <Dialog open={!!currentLevelUp} onOpenChange={() => state.dismissLevelUp()}>
        <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="text-center text-3xl font-display">
              🎉 Nová úroveň!
            </DialogTitle>
          </DialogHeader>
          <div className="text-center py-8">
            <p className="text-lg text-foreground">
              Hrdina <span className="font-bold text-primary">{currentLevelUp?.heroName}</span>
            </p>
            <p className="text-lg text-foreground mt-1">právě dosáhl úrovně</p>
            <p className="text-6xl font-display text-primary mt-6 mb-2">{currentLevelUp?.level}</p>
          </div>
          <DialogFooter className="sm:justify-center">
            <Button size="lg" onClick={() => state.dismissLevelUp()}>
              Rozumím!
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </GameContext.Provider>
  );
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be inside GameProvider');
  return ctx;
}
