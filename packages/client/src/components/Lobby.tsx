import React, { useState } from "react";
import { Users, Bot, Sparkles, Copy, Check } from "lucide-react";

interface LobbyProps {
  onCreateOnline: (name: string) => void;
  onJoinOnline: (code: string, name: string) => void;
  onPlaySolo: (name: string) => void;
  waitingRoomCode?: string | null;
}

export const Lobby: React.FC<LobbyProps> = ({
  onCreateOnline,
  onJoinOnline,
  onPlaySolo,
  waitingRoomCode,
}) => {
  const [name, setName] = useState("Jugador");
  const [joinCode, setJoinCode] = useState("");
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (waitingRoomCode) {
      const url = `${window.location.origin}?room=${waitingRoomCode}`;
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center p-4 z-30 bg-slate-950/80 backdrop-blur-md">
      <div className="w-full max-w-md bg-slate-900/90 border border-amber-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        {/* Glow corner accent */}
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

        {/* Title & Badge */}
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

        {waitingRoomCode ? (
          /* Waiting Screen when room was created */
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <div className="text-xs uppercase tracking-wider text-slate-400">
              Comparte este código con tu amigo:
            </div>
            <div className="text-5xl font-black text-amber-400 tracking-widest bg-slate-950 px-8 py-3 rounded-2xl border border-amber-500/40 shadow-inner">
              {waitingRoomCode}
            </div>

            <button
              onClick={handleCopy}
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-5 py-2.5 rounded-xl transition shadow-lg w-full justify-center"
            >
              {copied ? (
                <Check className="w-4 h-4" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
              <span>
                {copied ? "¡Enlace copiado!" : "Copiar Enlace para WhatsApp"}
              </span>
            </button>

            <div className="flex items-center gap-2 text-xs text-slate-400 mt-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              <span>Esperando a que el jugador 2 se conecte...</span>
            </div>
          </div>
        ) : (
          /* Main menu options */
          <div className="flex flex-col gap-4">
            {/* Player Name */}
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
                onChange={(e) => setName(e.target.value)}
                maxLength={15}
                className="w-full bg-slate-950 border border-slate-700 focus:border-amber-500 rounded-xl px-4 py-2.5 text-sm font-semibold text-white outline-none transition"
                placeholder="Escribe tu apodo..."
              />
            </div>

            <div className="h-px bg-slate-800 my-1" />

            {/* Quick Actions */}
            <div className="flex flex-col gap-2.5">
              <button
                onClick={() => onCreateOnline(name)}
                className="w-full flex items-center justify-center gap-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black py-3 rounded-2xl shadow-xl transition-transform active:scale-98"
              >
                <Users className="w-4 h-4" />
                <span>Crear Sala Online (2 Jugadores)</span>
              </button>

              {/* Join Room Box */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="CÓDIGO (EJ: B7F2)"
                  aria-label="Código de sala"
                  maxLength={4}
                  className="flex-1 bg-slate-950 border border-slate-700 focus:border-amber-500 rounded-2xl px-4 py-2 text-center text-sm font-bold tracking-widest text-amber-300 outline-none uppercase"
                />
                <button
                  onClick={() =>
                    joinCode.trim() && onJoinOnline(joinCode.trim(), name)
                  }
                  disabled={!joinCode.trim()}
                  className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white font-bold px-5 py-2 rounded-2xl transition border border-slate-700"
                >
                  Unirse
                </button>
              </div>

              <button
                onClick={() => onPlaySolo(name)}
                className="w-full flex items-center justify-center gap-2 bg-slate-800/80 hover:bg-slate-800 text-slate-200 font-bold py-2.5 rounded-2xl border border-slate-700/60 transition"
              >
                <Bot className="w-4 h-4 text-emerald-400" />
                <span>Jugar Solo vs IA (Modo Práctica)</span>
              </button>
            </div>

            {/* Brief Rules */}
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-3 text-xs text-slate-400 leading-relaxed mt-2">
              <div className="font-bold text-slate-300 mb-0.5">
                Puntos de la Brisca (Total 120 pts):
              </div>
              <div>
                • As = 11 pts | Tres = 10 pts | Rey = 4 pts | Caballo = 3 pts |
                Sota = 2 pts
              </div>
              <div>• Gana quien consiga más de 60 puntos.</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
