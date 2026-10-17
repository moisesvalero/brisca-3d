import React, { useEffect, useRef } from "react";
import {
  Check,
  Copy,
  Download,
  Home,
  MoreVertical,
  Plus,
  Share2,
  X,
} from "lucide-react";
import { useInstallPrompt } from "../pwa/useInstallPrompt.js";

interface InstallBannerProps {
  show: boolean;
}

const Step: React.FC<{
  icon: React.FC<{ className?: string }>;
  children: React.ReactNode;
}> = ({ icon: Icon, children }) => (
  <li className="flex items-start gap-3">
    <span
      aria-hidden="true"
      className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-300"
    >
      <Icon className="h-4 w-4" />
    </span>
    <span className="text-sm leading-relaxed text-slate-300">{children}</span>
  </li>
);

export const InstallBanner: React.FC<InstallBannerProps> = ({ show }) => {
  const p = useInstallPrompt(show);

  const dialogRef = useRef<HTMLDivElement>(null);

  // If the player creates/joins a room while the guide is open, close it.
  useEffect(() => {
    if (!show) p.setHelpOpen(false);
  }, [show, p.setHelpOpen]);

  useEffect(() => {
    if (!p.helpOpen) return;
    const dialog = dialogRef.current;
    if (!dialog) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        p.setHelpOpen(false);
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((node) => !node.hasAttribute("disabled"));
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [p.helpOpen, p.setHelpOpen]);

  if (!p.visible && !p.helpOpen) return null;

  return (
    <>
      {p.visible && !p.helpOpen && (
        <div
          role="region"
          aria-label="Instalar Brisca 3D"
          className="install-rise fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-50 mx-auto max-w-md"
        >
          <div className="flex items-center gap-3 rounded-2xl border border-amber-500/40 bg-slate-900/95 p-3 shadow-2xl backdrop-blur-md">
            <img
              src="/pwa-192x192.png"
              alt=""
              className="h-11 w-11 shrink-0 rounded-xl border border-amber-500/30"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black text-white">
                {p.inApp
                  ? "Ábrela en tu navegador"
                  : p.isIOS
                    ? "Añádela a tu pantalla"
                    : "Instala Brisca 3D"}
              </p>
              <p className="text-[11px] leading-snug text-slate-400">
                {p.inApp
                  ? "Copia el enlace y ábrelo en Safari o Chrome."
                  : p.isIOS
                    ? "Compartir → Añadir a pantalla de inicio."
                    : "Juega a pantalla completa, sin barra del navegador."}
              </p>
            </div>
            <button
              onClick={p.inApp ? p.copyLink : p.install}
              className="shrink-0 rounded-xl bg-amber-500 px-3 py-2 text-xs font-black text-slate-950 transition hover:bg-amber-400"
            >
              {p.inApp
                ? p.copied
                  ? "Copiado"
                  : "Copiar"
                : p.canNativeInstall
                  ? "Instalar"
                  : "Cómo"}
            </button>
            <button
              onClick={p.dismiss}
              aria-label="Ahora no"
              className="shrink-0 rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-800 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {p.helpOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="install-help-title"
          className="fixed inset-0 z-[65] flex items-end justify-center bg-slate-950/85 p-4 backdrop-blur-md sm:items-center"
        >
          <div
            ref={dialogRef}
            className="w-full max-w-md rounded-3xl border border-amber-500/40 bg-slate-900 p-5 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-300">
                  Aplicación instalable
                </p>
                <h2
                  id="install-help-title"
                  className="text-xl font-black text-white"
                >
                  Instalar Brisca 3D
                </h2>
              </div>
              <button
                onClick={() => p.setHelpOpen(false)}
                aria-label="Cerrar"
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {p.inApp ? (
              <div className="mt-4">
                <p className="text-sm leading-relaxed text-slate-400">
                  Estás dentro de otra aplicación (WhatsApp, Instagram, etc.).
                  Copia el enlace y ábrelo en Safari o Chrome para poder
                  instalarla.
                </p>
                <button
                  onClick={p.copyLink}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 py-3 font-black text-slate-950 transition hover:bg-amber-400"
                >
                  {p.copied ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                  <span>{p.copied ? "¡Enlace copiado!" : "Copiar enlace"}</span>
                </button>
              </div>
            ) : p.isIOS ? (
              <div className="mt-4">
                {!p.isSafariIOS && (
                  <p className="mb-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-200">
                    Abre esta página en Safari para instalarla.
                  </p>
                )}
                <ol className="space-y-3">
                  <Step icon={Share2}>
                    Toca el botón <b className="text-white">Compartir</b> de la
                    barra de Safari.
                  </Step>
                  <Step icon={Plus}>
                    Elige{" "}
                    <b className="text-white">Añadir a pantalla de inicio</b>.
                  </Step>
                  <Step icon={Home}>
                    Confirma con <b className="text-white">Añadir</b>. La app
                    aparecerá como un icono más.
                  </Step>
                </ol>
              </div>
            ) : (
              <div className="mt-4">
                <ol className="space-y-3">
                  <Step icon={MoreVertical}>
                    Abre el menú de Chrome (los tres puntos{" "}
                    <b className="text-white">⋮</b>).
                  </Step>
                  <Step icon={Download}>
                    Toca <b className="text-white">Instalar aplicación</b> o{" "}
                    <b className="text-white">Añadir a pantalla de inicio</b>.
                  </Step>
                  <Step icon={Home}>
                    Confirma. La app se abrirá a pantalla completa.
                  </Step>
                </ol>
                <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
                  En otros navegadores, busca la opción equivalente en el menú.
                </p>
              </div>
            )}

            <button
              autoFocus
              onClick={() => p.setHelpOpen(false)}
              className="mt-5 w-full rounded-2xl border border-slate-700 bg-slate-800 py-2.5 text-sm font-bold text-slate-200 transition hover:bg-slate-700"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
};
