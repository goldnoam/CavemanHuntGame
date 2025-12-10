
import React from 'react';
import { GameState, GameMode, NarratorMessage } from '../types';

interface UIOverlayProps {
  gameState: GameState;
  onStart: (mode: GameMode) => void;
  narratorMessage: NarratorMessage | null;
}

const UIOverlay: React.FC<UIOverlayProps> = ({ gameState, onStart, narratorMessage }) => {

  return (
    <>
      {/* Narrator Message - Floating at top */}
      {narratorMessage && (
        <div className="absolute top-24 left-0 right-0 flex justify-center z-40 pointer-events-none px-4">
          <div className={`
            max-w-lg w-full p-4 rounded-xl border-4 shadow-xl transform transition-all duration-300 animate-bounce
            ${narratorMessage.type === 'danger' ? 'bg-red-900/90 border-red-500 text-red-100' : 
              narratorMessage.type === 'victory' ? 'bg-yellow-900/90 border-yellow-500 text-yellow-100' :
              narratorMessage.type === 'powerup' ? 'bg-blue-900/90 border-blue-400 text-blue-100' :
              narratorMessage.type === 'parry' ? 'bg-purple-900/90 border-purple-400 text-purple-100' :
              'bg-stone-800/90 border-stone-500 text-stone-100'}
          `}>
            <div className="flex items-center gap-4">
              <span className="text-3xl filter drop-shadow-md">🧙‍♂️</span>
              <div>
                <h3 className="font-stone text-lg mb-0.5 opacity-80">השמאן אומר:</h3>
                <p className="text-xl font-bold font-sans leading-tight">{narratorMessage.text}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Menu / Game Over Overlay */}
      {gameState !== GameState.PLAYING && (
        <div className={`
            fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-1000
            ${gameState === GameState.GAME_OVER ? 'bg-black/95 backdrop-blur-md' : 'bg-black/70 backdrop-blur-sm'}
        `}>
          <div className={`
              bg-stone-900 border-4 border-stone-600 p-8 rounded-2xl text-center shadow-2xl max-w-2xl w-full
              transform transition-all duration-500 relative overflow-hidden
              ${gameState === GameState.GAME_OVER ? 'scale-110 border-red-900 shadow-[0_0_50px_rgba(220,38,38,0.5)]' : 'scale-100'}
          `}>
            {/* Background pattern for menu */}
            <div className="absolute inset-0 opacity-10 pointer-events-none" 
                 style={{backgroundImage: 'url("https://www.transparenttextures.com/patterns/rocky-wall.png")'}}>
            </div>

            <div className="relative z-10">
                <h1 className={`font-stone text-6xl mb-6 drop-shadow-lg ${
                    gameState === GameState.GAME_OVER ? 'text-red-600 animate-pulse tracking-widest' : 
                    gameState === GameState.VICTORY ? 'text-yellow-400' : 'text-amber-500'
                }`}>
                {gameState === GameState.START && "ציד הממותה"}
                {gameState === GameState.GAME_OVER && "GAME OVER"}
                {gameState === GameState.VICTORY && "ניצחון!"}
                </h1>
                
                <p className="text-stone-300 mb-10 text-xl font-sans">
                {gameState === GameState.START && "צא למסע מסוכן להביא אוכל לשבט!"}
                {gameState === GameState.GAME_OVER && "החיות ניצחו... נסה שוב!"}
                {gameState === GameState.VICTORY && "הבאת כבוד גדול לשבט! הממותה נפלה!"}
                </p>

                {gameState === GameState.START && (
                <div className="space-y-4 text-stone-400 text-sm mb-10 bg-stone-950/50 p-6 rounded-xl inline-block border border-stone-700">
                    <div className="flex items-center justify-center gap-3 flex-wrap font-sans font-bold">
                        <span className="bg-stone-800 px-3 py-1 rounded border border-stone-600">WASD / Arrows</span>
                        <span className="bg-stone-800 px-3 py-1 rounded border border-stone-600">Space = Attack</span>
                        <span className="bg-stone-800 px-3 py-1 rounded border border-yellow-500/30 text-yellow-100">S / Down = Block</span>
                    </div>
                </div>
                )}

                <div className="flex flex-col gap-4 justify-center items-center">
                    <button 
                        onClick={() => onStart(GameMode.STORY)}
                        className={`
                            font-stone rounded-full transform transition-all shadow-xl active:scale-95 w-full md:w-auto
                            ${gameState === GameState.GAME_OVER 
                                ? 'bg-red-600 hover:bg-red-500 text-white ring-4 ring-red-900 text-5xl py-8 px-20 animate-bounce font-bold tracking-wider' 
                                : 'bg-amber-600 hover:bg-amber-500 text-white ring-4 ring-amber-800 text-3xl py-4 px-16 hover:scale-105'
                            }
                        `}
                    >
                        {gameState === GameState.START ? "התחל ציד (סיפור)" : "נסה שוב"}
                    </button>

                    {gameState === GameState.START && (
                        <button 
                            onClick={() => onStart(GameMode.BOSS_RUSH)}
                            className="bg-purple-700 hover:bg-purple-600 text-white ring-4 ring-purple-900 font-stone text-2xl py-3 px-12 rounded-full transform transition-all shadow-xl hover:scale-105 active:scale-95"
                        >
                            🥊 BOSS RUSH 🥊
                        </button>
                    )}
                </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default UIOverlay;
