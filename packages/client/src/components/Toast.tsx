import React from "react";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";

export type ToastTone = "error" | "info" | "success";

interface ToastProps {
  message: string;
  tone?: ToastTone;
  onClose: () => void;
}

const TONE_CLASSES: Record<ToastTone, string> = {
  error: "border-rose-500/50 bg-rose-950/90 text-rose-100",
  info: "border-amber-500/50 bg-slate-900/95 text-amber-100",
  success: "border-emerald-500/50 bg-emerald-950/90 text-emerald-100",
};

const TONE_ICONS: Record<ToastTone, React.FC<{ className?: string }>> = {
  error: AlertTriangle,
  info: Info,
  success: CheckCircle2,
};

export const Toast: React.FC<ToastProps> = ({
  message,
  tone = "info",
  onClose,
}) => {
  const Icon = TONE_ICONS[tone];

  return (
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-auto fixed left-1/2 top-[max(0.75rem,env(safe-area-inset-top))] z-[70] flex w-[min(92vw,32rem)] -translate-x-1/2 items-start gap-2 rounded-2xl border px-4 py-3 shadow-2xl backdrop-blur-md ${TONE_CLASSES[tone]}`}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <p className="flex-1 text-xs font-semibold leading-relaxed">{message}</p>
      <button
        onClick={onClose}
        aria-label="Cerrar aviso"
        className="shrink-0 rounded-lg p-1 opacity-70 transition hover:opacity-100"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};
