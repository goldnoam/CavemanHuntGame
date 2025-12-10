import React, { useState, useEffect } from 'react';
import GameEngine from './components/GameEngine';
import UIOverlay from './components/UIOverlay';
import { GameState, NarratorMessage } from './types';
import { generateNarration } from './services/narratorService';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.START);
  const [narratorMessage, setNarratorMessage] = useState<NarratorMessage | null>(null);

  // Clear narrator message after a few seconds
  useEffect(() => {
    if (narratorMessage) {
      const timer = setTimeout(() => {
        setNarratorMessage(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [narratorMessage]);

  const handleStart = async () => {
    setGameState(GameState.PLAYING);
    // Initial flavor text
    if (gameState === GameState.START) {
        setNarratorMessage({ text: "הרוחות איתך, אוג! הבא את הממותה!", type: 'info' });
        // Use static narration for variety on start
        generateNarration("המשחק מתחיל, האדם הקדמון יוצא לדרך").then(text => {
            // Narration logic
        });
    }
  };

  return (
    <div className="min-h-screen bg-stone-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative Background Elements */}
      <div className="absolute inset-0 opacity-20 pointer-events-none" 
           style={{backgroundImage: 'url("https://www.transparenttextures.com/patterns/rocky-wall.png")'}}>
      </div>
      
      <div className="scanlines"></div>

      <div className="relative z-10 w-full max-w-4xl">
        <header className="mb-4 flex justify-between items-center text-stone-400">
           <span className="text-xs uppercase tracking-widest">Prehistoric Engine v1.0</span>
           <span className="text-xs uppercase tracking-widest">React + Vite</span>
        </header>

        <div className="relative">
            <GameEngine 
                gameState={gameState} 
                setGameState={setGameState}
                setNarratorMessage={setNarratorMessage}
            />
            <UIOverlay 
                gameState={gameState} 
                onStart={handleStart} 
                narratorMessage={narratorMessage}
            />
        </div>

        <footer className="mt-6 text-center text-stone-600 text-sm">
           <p>נוצר באמצעות React, Tailwind</p>
        </footer>
      </div>
    </div>
  );
};

export default App;