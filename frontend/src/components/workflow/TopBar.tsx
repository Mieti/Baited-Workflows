"use client";

import {
  CheckCircle2,
  Loader2,
  PlayCircle,
  RotateCcw,
  Save,
  Undo2
} from "lucide-react";

type TopBarProps = {
  name: string;
  status: string;
  saveState: "idle" | "saving" | "saved" | "error";
  canUndo: boolean;
  isLoading: boolean;
  isValidating: boolean;
  isResetting: boolean;
  isSaving: boolean;
  isSubmitting: boolean;
  isUnavailable: boolean;
  onNameChange: (name: string) => void;
  onUndo: () => void;
  onResetDemo: () => void;
  onValidate: () => void;
  onSave: () => void;
  onSubmit: () => void;
};

export function TopBar({
  name,
  status,
  saveState,
  canUndo,
  isLoading,
  isValidating,
  isResetting,
  isSaving,
  isSubmitting,
  isUnavailable,
  onNameChange,
  onUndo,
  onResetDemo,
  onValidate,
  onSave,
  onSubmit
}: TopBarProps) {
  const controlsDisabled =
    isLoading || isValidating || isResetting || isSaving || isSubmitting || isUnavailable;

  return (
    <header className="flex h-[68px] shrink-0 items-center justify-between border-b border-line bg-panel px-5">
      <div className="flex min-w-0 items-center gap-4">
        <div className="min-w-0">
          <input
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            disabled={controlsDisabled}
            className="w-[360px] max-w-[44vw] truncate bg-transparent text-base font-semibold text-baited-ink outline-none"
          />
          <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500">
            <span className="rounded bg-panel2 px-2 py-0.5 capitalize text-zinc-300">{status}</span>
            <span>{saveLabel(saveState)}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onUndo}
          disabled={!canUndo || controlsDisabled}
          className="flex items-center gap-2 rounded-md border border-line bg-panel2 px-3 py-2 text-sm font-semibold text-baited-ink transition hover:border-baited-green/70 disabled:cursor-not-allowed disabled:opacity-45"
          title="Undo last change (Ctrl+Z)"
          aria-label="Undo last change"
        >
          <Undo2 className="h-4 w-4 text-zinc-300" />
          Undo
        </button>
        <button
          onClick={onResetDemo}
          disabled={controlsDisabled}
          className="flex items-center gap-2 rounded-md border border-line bg-panel2 px-3 py-2 text-sm font-semibold text-baited-ink transition hover:border-amber-400/70 disabled:cursor-not-allowed disabled:opacity-60"
          title="Reset demo workflow"
        >
          {isResetting ? (
            <Loader2 className="h-4 w-4 animate-spin text-amber-300" />
          ) : (
            <RotateCcw className="h-4 w-4 text-amber-300" />
          )}
          {isResetting ? "Resetting" : "Reset demo"}
        </button>
        <button
          onClick={onValidate}
          disabled={controlsDisabled}
          className="flex items-center gap-2 rounded-md border border-line bg-panel2 px-3 py-2 text-sm font-semibold text-baited-ink transition hover:border-baited-green/70 disabled:cursor-not-allowed disabled:opacity-60"
          title="Validate workflow"
        >
          {isValidating ? (
            <Loader2 className="h-4 w-4 animate-spin text-baited-green" />
          ) : (
            <CheckCircle2 className="h-4 w-4 text-baited-green" />
          )}
          {isValidating ? "Validating" : "Validate"}
        </button>
        <button
          onClick={onSave}
          disabled={controlsDisabled}
          className="flex items-center gap-2 rounded-md border border-line bg-panel2 px-3 py-2 text-sm font-semibold text-baited-ink transition hover:border-baited-green/70 disabled:cursor-not-allowed disabled:opacity-60"
          title="Save workflow"
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin text-sky-300" />
          ) : (
            <Save className="h-4 w-4 text-sky-300" />
          )}
          {isSaving ? "Saving" : "Save"}
        </button>
        <button
          onClick={onSubmit}
          disabled={controlsDisabled}
          className="flex items-center gap-2 rounded-md bg-baited-coral px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#ff7a68] disabled:cursor-not-allowed disabled:opacity-60"
          title="Submit workflow"
        >
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
          {isSubmitting ? "Submitting" : "Submit"}
        </button>
      </div>
    </header>
  );
}

function saveLabel(state: TopBarProps["saveState"]) {
  if (state === "saving") return "Saving...";
  if (state === "saved") return "Saved";
  if (state === "error") return "Save failed";
  return "Unsaved changes";
}
