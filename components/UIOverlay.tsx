import React from 'react';
import { GameState, NarratorMessage } from '../types';

interface UIOverlayProps {
  gameState: GameState;
  onStart: () => void;
  narratorMessage: NarratorMessage | null;
}

const UIOverlay: React.FC<UIOverlayProps> = ({ gameState, onStart, narratorMessage }) => {
  
  if (gameState === GameState.PLAYING && !narratorMessage) return null;

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center z-10 p-4">
      
      {/* Narrator Box */}
      {narratorMessage && (
        <div className={`
          mb-auto mt-4 max-w-lg p-6 rounded-xl border-4 shadow-xl transform transition-all duration-500 animate-bounce
          ${narratorMessage.type === 'danger' ? 'bg-red-900 border-red-500 text-red-100' : 
            narratorMessage.type === 'victory' ? 'bg-yellow-900 border-yellow-500 text-yellow-100' :
            narratorMessage.type === 'powerup' ? 'bg-blue-900 border-blue-400 text-blue-100' :
            narratorMessage.type === 'parry' ? 'bg-purple-900 border-purple-400 text-purple-100' :
            'bg-stone-800 border-stone-500 text-stone-100'}
        `}>
          <div className="flex items-center gap-4">
            <span className="text-4xl">🧙‍♂️</span>
            <div>
              <h3 className="font-stone text-xl mb-1">השמאן אומר:</h3>
              <p className="text-lg font-bold font-sans">{narratorMessage.text}</p>
            </div>
          </div>
        </div>
      )}

      {/* Main Menu / Game Over */}
      {gameState !== GameState.PLAYING && (
        <div className="pointer-events-auto bg-stone-900/90 border-4 border-stone-600 p-8 rounded-2xl text-center shadow-2xl backdrop-blur-sm">
          <h1 className="font-stone text-6xl text-amber-500 mb-2 drop-shadow-md">
            {gameState === GameState.START && "ציד הממותה"}
            {gameState === GameState.GAME_OVER && "הפסדת!"}
            {gameState === GameState.VICTORY && "ניצחון!"}
          </h1>
          
          <p className="text-stone-300 mb-8 text-xl">
            {gameState === GameState.START && "צא למסע מסוכן להביא אוכל לשבט!"}
            {gameState === GameState.GAME_OVER && "נסה שוב, השבט רעב..."}
            {gameState === GameState.VICTORY && "השבט יאכל טוב הלילה!"}
          </p>

          <div className="space-y-4 text-stone-400 text-sm mb-8">
             <div className="flex items-center justify-center gap-4 flex-wrap">
               <span className="kbd bg-stone-800 p-2 rounded">Move: A/D / ⬅️ ➡️</span>
               <span className="kbd bg-stone-800 p-2 rounded">Jump: W / ⬆️</span>
               <span className="kbd bg-stone-800 p-2 rounded">Attack: Space</span>
               <span className="kbd bg-stone-800 p-2 rounded border border-yellow-500/50 text-yellow-100">Parry: S / ⬇️</span>
             </div>
             <p className="text-xs text-stone-500">אסוף { "⚡" } למהירות ו-{ "🍖" } לכוח! חסום התקפות בזמן!</p>
          </div>

          <button 
            onClick={onStart}
            className="bg-amber-600 hover:bg-amber-500 text-white font-stone text-2xl py-4 px-12 rounded-full transform hover:scale-105 transition-all shadow-lg ring-4 ring-amber-800 active:scale-95"
          >
            {gameState === GameState.START ? "התחל ציד" : "שחק שוב"}
          </button>
        </div>
      )}
    </div>
  );
};

export default UIOverlay;