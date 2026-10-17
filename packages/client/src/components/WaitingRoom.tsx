import React, { useState } from "react";
import { Copy, Check, Share2, X, Loader2 } from "lucide-react";
import { buildInviteUrl } from "../network/config.js";
import type { ConnectionStatus } from "../network/gameClient.js";

interface WaitingRoomProps {
  code: string;
  status: ConnectionStatus;
  statusMessage?: string;
  onCancel: () => void;
}

export const WaitingRoom: React.FC<WaitingRoomProps> = ({
  code,
  status,
  statusMessage,
  onCancel,
}) => {
  const [copied, setCopied] = useState(false);
  const inviteUrl = code ? buildInviteUrl(code) : "";

  const copy = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2_500);
    } catch {
      window.prompt("Copia el enlace y envíalo a tu rival:", inviteUrl);
    }
  };

  const share = async () => {
    if (!inviteUrl) return;
    const text = `¡Juega a la Brisca 3D conmigo! Sala ${code}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Brisca 3D Royale",
          text,
          url: inviteUrl,
        });
        return;
      } catch {
        // user cancelled, fall through to copy
      }
    }
    await copy();
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center p-4 z-30 bg-slate-950/85 backdrop-blur-md">
      <div className="w-full max-w-md bg-slate-900/95 border border-amber-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl text-center relative">
        <button
          onClick={onCancel}
          aria-label="Cancelar y volver al menú"
          className="absolute top-3 right-3 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold uppercase tracking-wider mb-5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          Sala privada
        </div>

        {code ? (
          <>
            <h2 className="text-2xl font-black text-white mb-1">
              Comparte este código
            </h2>
            <p className="text-xs text-slate-400 mb-5">
              Tu rival solo tiene que abrir el enlace o escribir el código.
            </p>

            <div className="text-5xl font-black text-amber-400 tracking-[0.35em] pl-[0.35em] bg-slate-950 px-4 py-3 rounded-2xl border border-amber-500/40 shadow-inner select-all">
              {code}
            </div>

            <div className="flex flex-col sm:flex-row gap-2 mt-4">
              <button
                onClick={copy}
                className="flex-1 flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2.5 rounded-xl transition shadow-lg"
              >
                {copied ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
                <span>{copied ? "¡Enlace copiado!" : "Copiar enlace"}</span>
              </button>
              <button
                onClick={share}
                className="flex-1 flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-white font-bold px-4 py-2.5 rounded-xl border border-slate-700 transition"
              >
                <Share2 className="w-4 h-4" />
                <span>Compartir</span>
              </button>
            </div>

            <div className="flex items-center justify-center gap-2 text-xs text-slate-400 mt-5">
              <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
              <span>Esperando a que se una tu rival…</span>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-2xl font-black text-white mb-2">
              {status === "error"
                ? "No se pudo crear la sala"
                : "Creando sala…"}
            </h2>
            <p className="text-xs text-slate-400 mb-5">
              {statusMessage || "Conectando con el servidor de partidas…"}
            </p>
            <div className="flex items-center justify-center gap-2 text-slate-300">
              <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
              <span className="text-sm">Un momento…</span>
            </div>
          </>
        )}

        <p className="text-[11px] text-slate-500 mt-5">
          La partida comenzará automáticamente cuando entre el segundo jugador.
        </p>
      </div>
    </div>
  );
};
