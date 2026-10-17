import React, { useEffect, useState } from "react";
import { Users, Bot, Sparkles, ArrowRight } from "lucide-react";
import { readStoredName, storeName } from "../network/config.js";

interface LobbyProps {
  onCreate: (name: string) => void;
  onJoin: (code: string, name: string) => void;
  onPlaySolo: (name: string) => void;
  inviteCode?: string | null;
  busy?: boolean;
}

export const Lobby: React.FC<LobbyProps> = ({
  onCreate,
  onJoin,
  onPlaySolo,
  inviteCode,
  busy = false,
}) => {
  const [name, setName] = useState(() => readStoredName() || "Jugador");
  const [joinCode, setJoinCode] = useState(() => inviteCode ?? "");

  useEffect(() => {
    if (inviteCode) setJoinCode(inviteCode);
  }, [inviteCode]);

  const safeName = () => {
    const value = name.trim() || "Jugador";
    storeName(value);
    return value;
  };

  const handleCreate = () => {
    if (busy) return;
    onCreate(safeName());
  };

  const handleJoin = () => {
    if (busy) return;
    const code = joinCode.trim().toUpperCase();
    if (code.length !== 4) return;
    onJoin(code, safeName());
  };

  const handleSolo = () => {
    if (busy) return;
    onPlaySolo(safeName());
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center p-4 z-30 bg-slate-950/80 backdrop-blur-md">
      <div className="w-full max-w-md bg-slate-900/90 border border-amber-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold uppercase tracking-wider mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Baraja Española 3D</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white arcade-glow-gold">
            BRISCA <span className="text-amber-400">ROYALE</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            2 Jugadores Online • Estética Balatro • 40 Cartas
          </p>
        </div>

        {inviteCode && (
          <div className="mb-4 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-center">
            <p className="text-xs uppercase tracking-wider text-emerald-300 font-bold">
              Te han invitado a la partida
            </p>
            <p className="text-2xl font-black text-white tracking-[0.3em] mt-1">
              {inviteCode}
            </p>
            <p className="text-[11px] text-emerald-200/80 mt-1">
              Pulsa «Unirse» para entrar.
            </p>
          </div>
        )}

        <div className="flex flex-col gap-4">
          <div>
            <label
              htmlFor="player-nickname"
              className="block text-xs uppercase font-bold text-slate-400 mb-1"
            >
              Tu Apodo
            </label>
            <input
              id="player-nickname"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={15}
              autoComplete="nickname"
              className="w-full bg-slate-950 border border-slate-700 focus:border-amber-500 rounded-xl px-4 py-2.5 text-sm font-semibold text-white outline-none transition"
              placeholder="Escribe tu apodo..."
            />
          </div>

          <div className="h-px bg-slate-800 my-1" />

          <div className="flex flex-col gap-2.5">
            <button
              onClick={handleCreate}
              disabled={busy}
              className="w-full flex items-center justify-center gap-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-60 disabled:cursor-not-allowed text-slate-950 font-black py-3 rounded-2xl shadow-xl transition-transform active:scale-98"
            >
              <Users className="w-4 h-4" />
              <span>
                {busy ? "Conectando…" : "Crear Sala Online (2 Jugadores)"}
              </span>
            </button>

            <div className="flex gap-2">
              <input
                type="text"
                value={joinCode}
                onChange={(event) =>
                  setJoinCode(
                    event.target.value
                      .toUpperCase()
                      .replace(/[^A-Z2-9]/g, "")
                      .slice(0, 4),
                  )
                }
                placeholder="CÓDIGO (EJ: B7F2)"
                aria-label="Código de sala"
                maxLength={4}
                autoComplete="off"
                disabled={busy}
                className="flex-1 bg-slate-950 border border-slate-700 focus:border-amber-500 rounded-2xl px-4 py-2 text-center text-sm font-bold tracking-widest text-amber-300 outline-none uppercase"
              />
              <button
                onClick={handleJoin}
                disabled={busy || joinCode.trim().length !== 4}
                className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold px-5 py-2 rounded-2xl transition border border-slate-700"
              >
                <span>Unirse</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              onClick={handleSolo}
              disabled={busy}
              className="w-full flex items-center justify-center gap-2 bg-slate-800/80 hover:bg-slate-800 disabled:opacity-60 text-slate-200 font-bold py-2.5 rounded-2xl border border-slate-700/60 transition"
            >
              <Bot className="w-4 h-4 text-emerald-400" />
              <span>Jugar Solo vs IA (Modo Práctica)</span>
            </button>
          </div>

          <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-3 text-xs text-slate-400 leading-relaxed mt-2">
            <div className="font-bold text-slate-300 mb-0.5">
              Puntos de la Brisca (Total 120 pts):
            </div>
            <div>
              • As = 11 pts | Tres = 10 pts | Rey = 4 pts | Caballo = 3 pts |
              Sota = 2 pts
            </div>
            <div>• Gana quien consiga más de 60 puntos.</div>
            <div className="mt-1.5 text-emerald-300/90 font-semibold">
              Online gratis, sin registro. Comparte el código o el enlace.
            </div>
            <div className="mt-1 text-[10px] text-slate-500">
              Baraja Fournier 1878 · dominio público · Museo Fournier
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
