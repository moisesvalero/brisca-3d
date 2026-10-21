import React, { useEffect, useState } from "react";
import {
  Volume2,
  VolumeX,
  Tv,
  RefreshCw,
  Share2,
  LogOut,
  Loader2,
  Check,
  WifiOff,
  Wifi,
  BookOpen,
  Plus,
  Minus,
} from "lucide-react";
import { ClientState, ConnectionStatus } from "../network/gameClient.js";
import type { Card } from "@brisca/core";
import { canSwapTrump } from "@brisca/core";
import { buildInviteUrl } from "../network/config.js";

interface HUDProps {
  state: ClientState;
  status: ConnectionStatus;
  statusMessage?: string;
  soundEnabled: boolean;
  crtEnabled: boolean;
  onToggleSound: () => void;
  onToggleCRT: () => void;
  onSwapTrump: () => void;
  onLeave: () => void;
  onOpenRules: () => void;
  onPlayCard: (card: Card) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
}

const RANK_LABELS: Record<number, string> = {
  1: "As",
  3: "Tres",
  10: "Sota",
  11: "Caballo",
  12: "Rey",
};

const rankLabel = (rank: number): string => RANK_LABELS[rank] ?? String(rank);

const cardName = (card: Card): string =>
  `${rankLabel(card.rank)} de ${card.suit}`;

export const HUD: React.FC<HUDProps> = ({
  state,
  status,
  statusMessage,
  soundEnabled,
  crtEnabled,
  onToggleSound,
  onToggleCRT,
  onSwapTrump,
  onLeave,
  onOpenRules,
  onPlayCard,
  onZoomIn,
  onZoomOut,
}) => {
  const [copied, setCopied] = useState(false);
  const [trickRevealed, setTrickRevealed] = useState(false);
  const [shownScores, setShownScores] = useState(state.scores);
  const isMyTurn = state.turn === state.playerId;
  const opponentId = state.playerId === "p1" ? "p2" : "p1";
  const myScore = shownScores[state.playerId];
  const oppScore = shownScores[opponentId];
  const isOnlineRoom = state.isOnline && state.roomCode !== "SOLO";

  useEffect(() => {
    if (state.phase !== "RESOLVING_TRICK") {
      setTrickRevealed(false);
      return;
    }
    setTrickRevealed(false);
    const timer = window.setTimeout(() => setTrickRevealed(true), 1600);
    return () => window.clearTimeout(timer);
  }, [state.phase, state.currentTrick.winner, state.currentTrick.points]);

  useEffect(() => {
    if (state.phase !== "RESOLVING_TRICK" || trickRevealed) {
      setShownScores(state.scores);
    }
  }, [state.phase, state.scores, trickRevealed]);

  const canSwap =
    (state.phase === "PLAYER_TURN" || state.phase === "RESOLVING_TRICK") &&
    state.deckCount > 0 &&
    state.hasWonTrick &&
    state.myHand.some((card) =>
      canSwapTrump(card, state.trumpCard, state.hasWonTrick),
    );

  const copyInvite = async () => {
    const url = buildInviteUrl(state.roomCode);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2_500);
    } catch {
      window.prompt("Copia el enlace y envíalo a tu rival:", url);
    }
  };

  const turnMessage = !state.opponentConnected
    ? "⏳ Rival desconectado — esperando su vuelta…"
    : state.phase === "RESOLVING_TRICK"
      ? !trickRevealed
        ? "🃏 Mostrando la baza…"
        : state.currentTrick.winner === state.playerId
          ? `✨ ¡Baza ganada! (+${state.currentTrick.points} pts)`
          : `⚔️ El rival se lleva la baza (+${state.currentTrick.points} pts)`
      : isMyTurn
        ? "🎮 TU TURNO — Elige una carta"
        : "⏳ Esperando jugada del rival…";

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col p-2 sm:p-4 pt-[max(0.75rem,env(safe-area-inset-top))] z-10">
      <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2">
        <div className="pointer-events-auto flex items-center gap-2 sm:gap-3 bg-slate-900/85 backdrop-blur-md border border-amber-500/30 px-3 sm:px-4 py-1.5 sm:py-2 rounded-2xl shadow-xl max-w-[45vw]">
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] sm:text-xs uppercase tracking-wider text-amber-300/90 font-bold truncate">
              {state.myName || "Tú"}
            </span>
            <span className="text-xl sm:text-2xl font-black text-amber-400 arcade-glow-gold">
              {myScore}{" "}
              <span className="text-[10px] sm:text-xs text-amber-200">PTS</span>
            </span>
          </div>
        </div>

        <div className="pointer-events-auto flex items-center gap-2 sm:gap-3 bg-slate-950/90 backdrop-blur-lg border border-slate-700/60 px-3 sm:px-4 py-1.5 sm:py-2 rounded-2xl shadow-2xl">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="text-[10px] sm:text-xs uppercase text-slate-400 tracking-wider">
              Triunfo:
            </span>
            <span className="text-xs sm:text-sm font-bold uppercase text-amber-300">
              {state.trumpSuit}{" "}
              {state.trumpTaken
                ? "· recogido"
                : `(${rankLabel(state.trumpCard.rank)})`}
            </span>
          </div>
          <div className="h-3 sm:h-4 w-px bg-slate-700" />
          <div className="text-[10px] sm:text-xs text-slate-300">
            Mazo:{" "}
            <span className="font-bold text-white">{state.deckCount}</span>
          </div>
          {isOnlineRoom && (
            <>
              <div className="h-3 sm:h-4 w-px bg-slate-700" />
              <button
                onClick={copyInvite}
                className="flex items-center gap-1 text-[10px] sm:text-xs bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg transition-all"
                title="Copiar enlace de la sala"
                aria-label="Copiar enlace de la sala"
              >
                {copied ? (
                  <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                ) : (
                  <Share2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                )}
                <span>{copied ? "Copiado" : state.roomCode}</span>
              </button>
            </>
          )}
        </div>

        <div className="pointer-events-auto flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-2 sm:gap-3 bg-slate-900/85 backdrop-blur-md border border-slate-700/50 px-3 sm:px-4 py-1.5 sm:py-2 rounded-2xl shadow-xl max-w-[38vw]">
            <div className="flex flex-col text-right min-w-0">
              <span className="text-[10px] sm:text-xs uppercase tracking-wider text-slate-400 font-bold truncate">
                {state.opponentName || "Rival"}
              </span>
              <span className="text-xl sm:text-2xl font-black text-slate-200">
                {oppScore}{" "}
                <span className="text-[10px] sm:text-xs text-slate-400">
                  PTS
                </span>
              </span>
            </div>
            {state.opponentConnected ? (
              <Wifi className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <WifiOff className="w-3.5 h-3.5 text-rose-400" />
            )}
          </div>

          <div
            className="flex items-center gap-0.5 bg-slate-900/85 backdrop-blur-md border border-slate-800 p-1 sm:p-1.5 rounded-2xl"
            role="group"
            aria-label="Zoom de la mesa"
          >
            <button
              onClick={onZoomOut}
              className="p-1.5 sm:p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition"
              title="Volver al zoom por defecto"
              aria-label="Volver al zoom por defecto"
            >
              <Minus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
            <span className="hidden sm:inline text-[9px] font-black tracking-widest text-slate-500 px-0.5 select-none">
              ZOOM
            </span>
            <button
              onClick={onZoomIn}
              className="p-1.5 sm:p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition"
              title="Acercar más"
              aria-label="Acercar más"
            >
              <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          </div>

          <div className="flex gap-1 bg-slate-900/85 backdrop-blur-md border border-slate-800 p-1 sm:p-1.5 rounded-2xl">
            <button
              onClick={onToggleSound}
              className="p-1.5 sm:p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition"
              title="Activar/Desactivar Sonido"
              aria-label={
                soundEnabled
                  ? "Desactivar efectos de sonido"
                  : "Activar efectos de sonido"
              }
            >
              {soundEnabled ? (
                <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" />
              ) : (
                <VolumeX className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-400" />
              )}
            </button>
            <button
              onClick={onToggleCRT}
              className="p-1.5 sm:p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition"
              title="Filtro Retro Balatro CRT"
              aria-label={
                crtEnabled
                  ? "Desactivar filtro CRT retro"
                  : "Activar filtro CRT retro"
              }
            >
              <Tv
                className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${
                  crtEnabled ? "text-amber-400" : "text-slate-500"
                }`}
              />
            </button>
            <button
              onClick={(event) => {
                event.currentTarget.focus();
                onOpenRules();
              }}
              className="p-1.5 sm:p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition"
              title="Reglas de la Brisca"
              aria-label="Ver reglas de la Brisca"
            >
              <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
            <button
              onClick={onLeave}
              className="p-1.5 sm:p-2 rounded-xl text-slate-300 hover:text-rose-300 hover:bg-slate-800 transition"
              title="Salir de la partida"
              aria-label="Salir de la partida"
            >
              <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center gap-2 mt-3">
        <div
          role="status"
          aria-live="polite"
          className={`px-5 py-1.5 rounded-full font-black text-xs sm:text-sm tracking-wider uppercase transition-all duration-300 backdrop-blur-md shadow-2xl border ${
            !state.opponentConnected
              ? "bg-rose-500/20 text-rose-200 border-rose-500/40"
              : state.phase === "RESOLVING_TRICK"
                ? !trickRevealed
                  ? "bg-slate-900/70 text-slate-400 border-slate-800"
                  : state.currentTrick.winner === state.playerId
                    ? "bg-amber-500/30 text-amber-300 border-amber-400 arcade-glow-gold scale-105"
                    : "bg-rose-500/20 text-rose-300 border-rose-500/40"
                : isMyTurn
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50 arcade-glow-emerald animate-pulse"
                  : "bg-slate-900/70 text-slate-400 border-slate-800"
          }`}
        >
          {turnMessage}
        </div>

        {canSwap && (
          <button
            onClick={onSwapTrump}
            className="pointer-events-auto flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs uppercase px-5 py-2 rounded-full shadow-2xl border border-amber-300 transition-transform active:scale-95 animate-bounce"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Cambiar Triunfo (7 / 2)</span>
          </button>
        )}
      </div>

      <div className="sr-only" role="group" aria-label="Tus cartas">
        <p>
          {isMyTurn
            ? "Es tu turno. Elige una carta."
            : "Esperando la jugada del rival."}
        </p>
        {state.myHand.map((card) => (
          <button
            key={card.id}
            type="button"
            disabled={!isMyTurn || state.phase !== "PLAYER_TURN"}
            onClick={() => onPlayCard(card)}
            aria-label={`Jugar ${cardName(card)}`}
          >
            Jugar {cardName(card)}
          </button>
        ))}
      </div>

      {status === "reconnecting" && (
        <div className="pointer-events-auto mx-auto mt-3 flex items-center gap-2 rounded-2xl border border-amber-500/40 bg-slate-950/90 px-4 py-2 text-xs font-bold text-amber-200 shadow-2xl">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>{statusMessage || "Reconectando con la partida…"}</span>
        </div>
      )}
    </div>
  );
};
