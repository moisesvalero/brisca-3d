import React from "react";
import { Volume2, VolumeX, Tv, RefreshCw, Share2 } from "lucide-react";
import { ClientState } from "../network/gameClient.js";
import { canSwapTrump } from "@brisca/core";

interface HUDProps {
  state: ClientState;
  soundEnabled: boolean;
  crtEnabled: boolean;
  onToggleSound: () => void;
  onToggleCRT: () => void;
  onSwapTrump: () => void;
}

export const HUD: React.FC<HUDProps> = ({
  state,
  soundEnabled,
  crtEnabled,
  onToggleSound,
  onToggleCRT,
  onSwapTrump,
}) => {
  const isMyTurn = state.turn === state.playerId;
  const myScore = state.scores[state.playerId];
  const opponentId = state.playerId === "p1" ? "p2" : "p1";
  const oppScore = state.scores[opponentId];

  // Check if player has card that can swap trump
  const canSwap =
    isMyTurn &&
    state.deckCount > 0 &&
    state.myHand.some((card) => canSwapTrump(card, state.trumpCard));

  const copyRoomLink = () => {
    if (state.roomCode && state.roomCode !== "SOLO") {
      const url = `${window.location.origin}?room=${state.roomCode}`;
      navigator.clipboard.writeText(url);
      alert(`¡Enlace copiado al portapapeles! Envíalo a tu amigo: ${url}`);
    }
  };

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col p-4 z-10">
      {/* Top Bar: Scores & Arcade Info */}
      <div className="flex items-center justify-between">
        {/* Player Score */}
        <div className="pointer-events-auto flex items-center gap-3 bg-slate-900/80 backdrop-blur-md border border-amber-500/30 px-4 py-2 rounded-2xl shadow-xl">
          <div className="flex flex-col">
            <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
              Tú
            </span>
            <span className="text-2xl font-black text-amber-400 arcade-glow-gold">
              {myScore} <span className="text-xs text-amber-200">PTS</span>
            </span>
          </div>
        </div>

        {/* Center: Trump Indicator & Deck */}
        <div className="pointer-events-auto flex items-center gap-4 bg-slate-950/85 backdrop-blur-lg border border-slate-700/60 px-5 py-2 rounded-2xl shadow-2xl">
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase text-slate-400 tracking-wider">
              Triunfo:
            </span>
            <span className="text-sm font-bold uppercase text-amber-300">
              {state.trumpSuit} ({state.trumpCard.rank})
            </span>
          </div>
          <div className="h-4 w-px bg-slate-700"></div>
          <div className="text-xs text-slate-300">
            Mazo:{" "}
            <span className="font-bold text-white">{state.deckCount}</span>
          </div>
          {state.roomCode && state.roomCode !== "SOLO" && (
            <>
              <div className="h-4 w-px bg-slate-700"></div>
              <button
                onClick={copyRoomLink}
                className="flex items-center gap-1.5 text-xs bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 px-2.5 py-1 rounded-lg transition-all"
                title="Copiar enlace de sala"
                aria-label="Copiar enlace de la sala"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>{state.roomCode}</span>
              </button>
            </>
          )}
        </div>

        {/* Rival Score & Controls */}
        <div className="pointer-events-auto flex items-center gap-3">
          <div className="flex items-center gap-3 bg-slate-900/80 backdrop-blur-md border border-slate-700/50 px-4 py-2 rounded-2xl shadow-xl">
            <div className="flex flex-col text-right">
              <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
                Rival
              </span>
              <span className="text-2xl font-black text-slate-200">
                {oppScore} <span className="text-xs text-slate-400">PTS</span>
              </span>
            </div>
          </div>

          {/* Audio & CRT Toggles */}
          <div className="flex gap-1.5 bg-slate-900/80 backdrop-blur-md border border-slate-800 p-1.5 rounded-2xl">
            <button
              onClick={onToggleSound}
              className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition"
              title="Activar/Desactivar Sonido"
              aria-label={
                soundEnabled
                  ? "Desactivar efectos de sonido"
                  : "Activar efectos de sonido"
              }
            >
              {soundEnabled ? (
                <Volume2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <VolumeX className="w-4 h-4 text-rose-400" />
              )}
            </button>
            <button
              onClick={onToggleCRT}
              className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition"
              title="Filtro Retro Balatro CRT"
              aria-label={
                crtEnabled
                  ? "Desactivar filtro CRT retro"
                  : "Activar filtro CRT retro"
              }
            >
              <Tv
                className={`w-4 h-4 ${crtEnabled ? "text-amber-400" : "text-slate-500"}`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Top Center Floating Notification & Quick Action */}
      <div className="flex flex-col items-center gap-2 mt-3">
        <div
          className={`px-5 py-1.5 rounded-full font-black text-xs sm:text-sm tracking-wider uppercase transition-all duration-300 backdrop-blur-md shadow-2xl border ${
            state.phase === "RESOLVING_TRICK"
              ? state.currentTrick.winner === state.playerId
                ? "bg-amber-500/30 text-amber-300 border-amber-400 arcade-glow-gold scale-105"
                : "bg-rose-500/20 text-rose-300 border-rose-500/40"
              : isMyTurn
                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50 arcade-glow-emerald animate-pulse"
                : "bg-slate-900/70 text-slate-400 border-slate-800"
          }`}
        >
          {state.phase === "RESOLVING_TRICK"
            ? state.currentTrick.winner === state.playerId
              ? `✨ ¡Baza ganada! (+${state.currentTrick.points} pts)`
              : `⚔️ El rival se lleva la baza (+${state.currentTrick.points} pts)`
            : isMyTurn
              ? "🎮 TU TURNO - Elige una carta"
              : "⏳ Esperando jugada del rival..."}
        </div>

        {canSwap && (
          <button
            onClick={onSwapTrump}
            className="pointer-events-auto flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs uppercase px-5 py-2 rounded-full shadow-2xl border border-amber-300 transition-transform active:scale-95 animate-bounce"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Cambiar Triunfo por el 7 / 2</span>
          </button>
        )}
      </div>
    </div>
  );
};
