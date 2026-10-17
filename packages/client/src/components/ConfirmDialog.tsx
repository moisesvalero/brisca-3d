import React from "react";

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  title,
  message,
  confirmLabel,
  cancelLabel = "Cancelar",
  danger = false,
  onConfirm,
  onCancel,
}) => {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      className="absolute inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md"
    >
      <div className="w-full max-w-sm rounded-3xl border border-slate-700 bg-slate-900 p-6 text-center shadow-2xl">
        <h2
          id="confirm-dialog-title"
          className="text-xl font-black uppercase tracking-tight text-white"
        >
          {title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">{message}</p>

        <div className="mt-6 flex flex-col gap-2">
          <button
            onClick={onConfirm}
            className={`w-full rounded-2xl py-3 font-black transition ${
              danger
                ? "bg-rose-500 text-white hover:bg-rose-400"
                : "bg-amber-500 text-slate-950 hover:bg-amber-400"
            }`}
          >
            {confirmLabel}
          </button>
          {onCancel && (
            <button
              onClick={onCancel}
              className="w-full rounded-2xl border border-slate-700 bg-slate-800 py-2.5 text-sm font-bold text-slate-300 transition hover:bg-slate-700"
            >
              {cancelLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
