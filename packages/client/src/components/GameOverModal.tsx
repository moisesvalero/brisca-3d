import React, { useEffect } from "react";
import confetti from "canvas-confetti";
import { Trophy, Frown, RotateCcw, Loader2, WifiOff } from "lucide-react";
import { ClientState } from "../network/gameClient.js";
import { sounds } from "../audio/soundManager.js";

interface GameOverModalProps {
  state: ClientState;
  rematchWaiting: boolean;
  rematchOffered: boolean;
  onRematch: () => void;
  onExit: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  state,
  rematchWaiting,
  rematchOffered,
  onRematch,
  onExit,
}) => {
  const isWinner = state.winner === state.playerId;
  const isDraw = state.winner === "draw";
  const myScore = state.scores[state.playerId];
  const oppScore = state.scores[state.playerId === "p1" ? "p2" : "p1"];
  const canRematch = state.isOnline ? state.opponentConnected : true;

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

  const rematchLabel = rematchWaiting
    ? "Esperando al rival…"
    : rematchOffered
      ? "Aceptar revancha"
      : state.isOnline
        ? "Jugar revancha"
        : "Jugar otra vez";

  return (
    <div className="absolute inset-0 flex items-center justify-center p-4 z-40 bg-slate-950/85 backdrop-blur-md">
      <div className="w-full max-w-sm bg-slate-900 border border-amber-500/40 rounded-3xl p-6 text-center shadow-2xl relative overflow-hidden">
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

        <div className="grid grid-cols-2 gap-3 bg-slate-950 p-4 rounded-2xl border border-slate-800 mb-6">
          <div className="flex flex-col">
            <span className="text-xs uppercase text-slate-400">
              {state.myName || "Tus Puntos"}
            </span>
            <span className="text-2xl font-black text-amber-400">
              {myScore}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs uppercase text-slate-400">
              {state.opponentName || "Rival"}
            </span>
            <span className="text-2xl font-black text-slate-300">
              {oppScore}
            </span>
          </div>
        </div>

        {!canRematch && (
          <div className="mb-4 flex items-center justify-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11px] font-bold text-rose-200">
            <WifiOff className="w-3.5 h-3.5" />
            <span>Tu rival se ha desconectado</span>
          </div>
        )}

        {rematchOffered && !rematchWaiting && (
          <p className="mb-4 text-[11px] font-bold uppercase tracking-wider text-emerald-300">
            Tu rival quiere la revancha
          </p>
        )}

        <div className="flex flex-col gap-2.5">
          <button
            onClick={onRematch}
            disabled={rematchWaiting || !canRematch}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-60 disabled:cursor-not-allowed text-slate-950 font-black py-3 rounded-2xl transition shadow-lg"
          >
            {rematchWaiting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RotateCcw className="w-4 h-4" />
            )}
            <span>{rematchLabel}</span>
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
