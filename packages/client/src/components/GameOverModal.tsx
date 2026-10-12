import React, { useEffect } from "react";
import confetti from "canvas-confetti";
import { Trophy, Frown, RotateCcw } from "lucide-react";
import { ClientState } from "../network/gameClient.js";
import { sounds } from "../audio/soundManager.js";

interface GameOverModalProps {
  state: ClientState;
  onRematch: () => void;
  onExit: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  state,
  onRematch,
  onExit,
}) => {
  const isWinner = state.winner === state.playerId;
  const isDraw = state.winner === "draw";
  const myScore = state.scores[state.playerId];
  const oppScore = state.scores[state.playerId === "p1" ? "p2" : "p1"];

  useEffect(() => {
    if (isWinner) {
      sounds.playVictory();
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#f59e0b", "#10b981", "#3b82f6", "#ec4899"],
      });
    }
  }, [isWinner]);

  return (
    <div className="absolute inset-0 flex items-center justify-center p-4 z-40 bg-slate-950/85 backdrop-blur-md">
      <div className="w-full max-w-sm bg-slate-900 border border-amber-500/40 rounded-3xl p-6 text-center shadow-2xl relative overflow-hidden animate-in fade-in zoom-in-95 duration-300">
        <div className="my-3 flex justify-center">
          {isWinner ? (
            <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 arcade-glow-gold animate-bounce">
              <Trophy className="w-9 h-9" />
            </div>
          ) : isDraw ? (
            <div className="w-16 h-16 rounded-2xl bg-slate-700/30 border border-slate-600 flex items-center justify-center text-slate-300">
              <RotateCcw className="w-8 h-8" />
            </div>
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
              <Frown className="w-8 h-8" />
            </div>
          )}
        </div>

        <h2 className="text-3xl font-black text-white tracking-tight uppercase mb-1">
          {isWinner ? "¡Victoria!" : isDraw ? "¡Empate!" : "Derrota"}
        </h2>
        <p className="text-xs text-slate-400 mb-6">
          {isWinner
            ? "¡Has ganado la partida superando los 60 puntos!"
            : isDraw
              ? "Ambos jugadores habéis empatado a 60 puntos."
              : "El rival ha conseguido más puntos en esta partida."}
        </p>

        {/* Scores summary */}
        <div className="grid grid-cols-2 gap-3 bg-slate-950 p-4 rounded-2xl border border-slate-800 mb-6">
          <div className="flex flex-col">
            <span className="text-xs uppercase text-slate-400">Tus Puntos</span>
            <span className="text-2xl font-black text-amber-400">
              {myScore}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs uppercase text-slate-400">
              Puntos Rival
            </span>
            <span className="text-2xl font-black text-slate-300">
              {oppScore}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2.5">
          <button
            onClick={onRematch}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black py-3 rounded-2xl transition shadow-lg"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Jugar Revancha</span>
          </button>
          <button
            onClick={onExit}
            className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2.5 rounded-2xl border border-slate-700 transition text-sm"
          >
            Volver al Menú
          </button>
        </div>
      </div>
    </div>
  );
};
