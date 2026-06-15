"use client";

import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";

export type WorkflowToastTone = "info" | "success" | "warning" | "error";

export type WorkflowToast = {
  id: string;
  message: string;
  tone: WorkflowToastTone;
};

type WorkflowToastsProps = {
  toasts: WorkflowToast[];
  onDismiss: (id: string) => void;
};

export function WorkflowToasts({ toasts, onDismiss }: WorkflowToastsProps) {
  if (!toasts.length) return null;

  return (
    <div
      className="pointer-events-none fixed right-4 top-20 z-50 flex w-[360px] max-w-[calc(100vw-2rem)] flex-col gap-2"
      aria-live="polite"
      aria-atomic="false"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          className={[
            "pointer-events-auto flex items-start gap-3 rounded-md border bg-panel/95 p-3 text-sm shadow-node backdrop-blur",
            toastToneClass(toast.tone)
          ].join(" ")}
        >
          <ToastIcon toast={toast} />
          <div className="min-w-0 flex-1 leading-5 text-baited-ink">{toast.message}</div>
          <button
            type="button"
            onClick={() => onDismiss(toast.id)}
            className="grid h-6 w-6 shrink-0 place-items-center rounded text-zinc-500 transition hover:bg-panel2 hover:text-baited-ink"
            aria-label="Dismiss notification"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

function ToastIcon({ toast }: { toast: WorkflowToast }) {
  if (toast.tone === "success") return <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-baited-green" />;
  if (toast.tone === "warning") return <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />;
  if (toast.tone === "error") return <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" />;
  return <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" />;
}

function toastToneClass(tone: WorkflowToastTone) {
  if (tone === "success") return "border-baited-green/35";
  if (tone === "warning") return "border-amber-400/35";
  if (tone === "error") return "border-rose-400/35";
  return "border-sky-400/30";
}
