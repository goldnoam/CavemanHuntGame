
import React, { useState, useEffect } from 'react';
import GameEngine from './components/GameEngine';
import UIOverlay from './components/UIOverlay';
import { GameState, GameMode, NarratorMessage } from './types';
import { generateNarration } from './services/narratorService';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.START);
  const [gameMode, setGameMode] = useState<GameMode>(GameMode.STORY);
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

  const handleStart = async (mode: GameMode) => {
    setGameMode(mode);
    setGameState(GameState.PLAYING);
    // Initial flavor text
    if (gameState === GameState.START || gameState === GameState.GAME_OVER || gameState === GameState.VICTORY) {
        const introText = mode === GameMode.BOSS_RUSH 
            ? "זירת המוות! הילחם בכל הבוסים!" 
            : "הרוחות איתך, אוג! הבא את הממותה!";
        
        setNarratorMessage({ text: introText, type: 'info' });
        
        // Use static narration for variety on start
        generateNarration(mode === GameMode.BOSS_RUSH ? "קרב הבוסים מתחיל" : "המשחק מתחיל, האדם הקדמון יוצא לדרך").then(text => {
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
                gameMode={gameMode}
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
