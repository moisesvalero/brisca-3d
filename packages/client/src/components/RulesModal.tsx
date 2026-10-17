import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";

interface RulesModalProps {
  open: boolean;
  onClose: () => void;
}

const POINTS: Array<[string, string]> = [
  ["As", "11"],
  ["Tres", "10"],
  ["Rey", "4"],
  ["Caballo", "3"],
  ["Sota", "2"],
];

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => (
  <section>
    <h3 className="mb-1.5 text-[11px] font-black uppercase tracking-wider text-amber-300">
      {title}
    </h3>
    <div className="space-y-1.5 text-sm leading-relaxed text-slate-300">
      {children}
    </div>
  </section>
);

export const RulesModal: React.FC<RulesModalProps> = ({ open, onClose }) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    const focusTimer = window.setTimeout(() => closeRef.current?.focus(), 40);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const panel = panelRef.current;
      if (!panel) return;
      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(
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
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", onKeyDown);
      restoreFocusRef.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[75] flex items-end justify-center bg-slate-950/85 backdrop-blur-md sm:items-center sm:p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="rules-title"
        className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-amber-500/40 bg-slate-900 shadow-2xl sm:max-h-[85dvh] sm:rounded-3xl"
      >
        <header className="flex items-start justify-between gap-3 border-b border-amber-500/20 px-4 py-3 sm:px-5 sm:py-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-300">
              Baraja española · 2 jugadores
            </p>
            <h2
              id="rules-title"
              className="text-xl font-black tracking-tight text-white sm:text-2xl"
            >
              Reglas de la Brisca
            </h2>
          </div>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label="Cerrar las reglas"
            className="shrink-0 rounded-xl p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4 sm:px-5 sm:py-5">
          <Section title="Objetivo">
            <p>
              Sumar <b className="text-white">más puntos que el rival</b> con
              las cartas que ganas en las bazas. La baraja reparte{" "}
              <b className="text-white">120 puntos</b> en total: gana quien
              consiga más de 60. Si acabáis 60 a 60, hay empate.
            </p>
          </Section>

          <Section title="Valor de las cartas">
            <div className="grid grid-cols-5 gap-1.5">
              {POINTS.map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-xl border border-slate-700 bg-slate-950 px-1 py-2 text-center"
                >
                  <div className="text-[10px] uppercase tracking-wide text-slate-400">
                    {label}
                  </div>
                  <div className="text-base font-black text-amber-300">
                    {value}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-400">
              El resto de cartas (2, 4, 5, 6 y 7) valen 0 puntos.
            </p>
          </Section>

          <Section title="Reparto y triunfo">
            <ul className="list-disc space-y-1 pl-5">
              <li>
                Cada jugador recibe <b className="text-white">3 cartas</b>.
              </li>
              <li>
                Se descubre una carta: su palo es el{" "}
                <b className="text-white">triunfo</b>. Las demás quedan en el
                mazo, encima de ella.
              </li>
              <li>
                Empieza el jugador que ha creado la sala y el ganador de cada
                baza abre la siguiente.
              </li>
            </ul>
          </Section>

          <Section title="Cómo se juega una baza">
            <ul className="list-disc space-y-1 pl-5">
              <li>
                El primero lanza una carta; el otro responde con la que quiera.{" "}
                <b className="text-white">
                  No es obligatorio asistir ni superar el palo.
                </b>
              </li>
              <li>
                Gana la baza la carta más alta del palo de salida o, si hay
                triunfo, la carta de triunfo más alta.
              </li>
              <li>
                El ganador roba primero del mazo y el otro después. Cuando se
                acaba el mazo, el perdedor de la última baza se lleva la carta
                de triunfo descubierta.
              </li>
              <li>Los puntos de las dos cartas van al ganador de la baza.</li>
            </ul>
          </Section>

          <Section title="Orden de fuerza">
            <p>
              As &gt; Tres &gt; Rey &gt; Caballo &gt; Sota &gt; 7 &gt; 6 &gt; 5
              &gt; 4 &gt; 2.
            </p>
            <p className="text-xs text-slate-400">
              Cualquier triunfo gana a una carta de otro palo. Si ambos juegan
              triunfo, gana el más alto de esa lista.
            </p>
          </Section>

          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5">
            <h3 className="mb-1.5 text-[11px] font-black uppercase tracking-wider text-amber-300">
              Regla del 7 y el 2
            </h3>
            <div className="space-y-1.5 text-sm leading-relaxed text-amber-100/90">
              <p>
                Si el triunfo descubierto es una carta con puntos (As, Tres,
                Sota, Caballo o Rey), el jugador que tenga el{" "}
                <b className="text-white">7 de triunfo</b> puede cambiarlo por
                esa carta.
              </p>
              <p>
                Si es una carta blanca (2, 4, 5, 6 o 7), el cambio se hace con
                el <b className="text-white">2 de triunfo</b>.
              </p>
              <p className="text-xs text-amber-200/70">
                Solo se puede cambiar mientras quede mazo. Si tienes una carta
                válida, aparecerá el botón «Cambiar triunfo».
              </p>
            </div>
          </div>

          <Section title="Fin de la partida">
            <p>
              Cuando se acaban las cartas, cada jugador suma los puntos de sus
              bazas. Gana quien tenga más de 60; si ambos acaban con 60, es
              empate.
            </p>
          </Section>

          <Section title="En esta versión">
            <ul className="list-disc space-y-1 pl-5">
              <li>
                Online para <b className="text-white">2 jugadores</b> con sala
                privada de 4 letras o enlace directo.
              </li>
              <li>
                Si se cae la conexión, la partida te espera{" "}
                <b className="text-white">60 segundos</b> para reconectar.
              </li>
              <li>
                La revancha se inicia cuando{" "}
                <b className="text-white">los dos</b> jugadores la aceptan.
              </li>
              <li>También puedes jugar contra la IA en el modo práctica.</li>
            </ul>
          </Section>
        </div>

        <footer className="border-t border-slate-800 p-3 sm:p-4">
          <button
            onClick={onClose}
            className="w-full rounded-2xl bg-amber-500 py-2.5 font-black text-slate-950 transition hover:bg-amber-400"
          >
            Entendido
          </button>
        </footer>
      </div>
    </div>
  );
};
