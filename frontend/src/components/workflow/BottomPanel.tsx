"use client";

import { AlertTriangle, Braces, CheckCircle2, ClipboardList } from "lucide-react";
import type { ReactNode } from "react";

import type { SubmissionRead, ValidationIssue, ValidationResult, WorkflowPayload } from "@/lib/workflow/types";

type PanelTab = "validation" | "payload" | "submission";

type BottomPanelProps = {
  activeTab: PanelTab;
  height: number;
  payload: WorkflowPayload;
  validation: ValidationResult | null;
  submission: SubmissionRead | null;
  notice: string | null;
  onTabChange: (tab: PanelTab) => void;
  onIssueClick: (issue: ValidationIssue) => void;
};

export function BottomPanel({
  activeTab,
  height,
  payload,
  validation,
  submission,
  notice,
  onTabChange,
  onIssueClick
}: BottomPanelProps) {
  return (
    <section
      data-testid="workflow-bottom-panel"
      className="flex shrink-0 flex-col border-t border-line bg-panel"
      style={{ height }}
    >
      <div className="flex h-11 items-center justify-between border-b border-line px-4">
        <div className="flex items-center gap-1">
          <TabButton
            active={activeTab === "validation"}
            icon={<AlertTriangle className="h-4 w-4" />}
            label="Validation"
            onClick={() => onTabChange("validation")}
          />
          <TabButton
            active={activeTab === "payload"}
            icon={<Braces className="h-4 w-4" />}
            label="Payload"
            onClick={() => onTabChange("payload")}
          />
          <TabButton
            active={activeTab === "submission"}
            icon={<ClipboardList className="h-4 w-4" />}
            label="Submission Log"
            onClick={() => onTabChange("submission")}
          />
        </div>
        {notice ? <div className="text-xs text-zinc-400">{notice}</div> : null}
      </div>

      <div className="thin-scrollbar min-h-0 flex-1 overflow-auto p-4">
        {activeTab === "validation" ? (
          <ValidationContent validation={validation} onIssueClick={onIssueClick} />
        ) : null}
        {activeTab === "payload" ? (
          <pre className="rounded-md border border-line bg-canvas p-4 text-xs leading-5 text-zinc-300">
            {JSON.stringify(payload, null, 2)}
          </pre>
        ) : null}
        {activeTab === "submission" ? <SubmissionContent submission={submission} /> : null}
      </div>
    </section>
  );
}

function TabButton({
  active,
  icon,
  label,
  onClick
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-semibold transition",
        active ? "bg-canvas text-baited-ink" : "text-zinc-500 hover:text-zinc-200"
      ].join(" ")}
    >
      {icon}
      {label}
    </button>
  );
}

function ValidationContent({
  validation,
  onIssueClick
}: {
  validation: ValidationResult | null;
  onIssueClick: (issue: ValidationIssue) => void;
}) {
  if (!validation) {
    return <div className="text-sm text-zinc-500">Run validation to inspect graph and parameter issues.</div>;
  }

  if (validation.valid && !validation.warnings.length) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-baited-green/30 bg-baited-green/10 p-3 text-sm text-emerald-100">
        <CheckCircle2 className="h-4 w-4 text-baited-green" />
        Workflow is valid and ready for mock submission.
      </div>
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <IssueGroup title="Errors" issues={validation.errors} tone="error" onIssueClick={onIssueClick} />
      <IssueGroup title="Warnings" issues={validation.warnings} tone="warning" onIssueClick={onIssueClick} />
    </div>
  );
}

function IssueGroup({
  title,
  issues,
  tone,
  onIssueClick
}: {
  title: string;
  issues: ValidationIssue[];
  tone: "error" | "warning";
  onIssueClick: (issue: ValidationIssue) => void;
}) {
  const color = tone === "error" ? "border-rose-500/40 text-rose-100" : "border-amber-500/40 text-amber-100";
  return (
    <div className={`rounded-md border ${color} bg-canvas p-3`}>
      <div className="text-xs font-semibold uppercase text-zinc-500">{title}</div>
      <div className="mt-2 space-y-2">
        {issues.length ? (
          issues.map((issue) => (
            <button
              key={`${issue.code}-${issue.nodeId ?? issue.edgeId ?? issue.message}`}
              onClick={() => onIssueClick(issue)}
              className="block w-full rounded border border-transparent px-2 py-1.5 text-left text-sm hover:border-line hover:bg-panel2"
            >
              <span className="font-semibold">{issue.code}</span>
              <span className="block text-zinc-300">{issue.message}</span>
            </button>
          ))
        ) : (
          <div className="text-sm text-zinc-500">None</div>
        )}
      </div>
    </div>
  );
}

function SubmissionContent({ submission }: { submission: SubmissionRead | null }) {
  if (!submission) {
    return <div className="text-sm text-zinc-500">Submit the workflow to create a mock execution record.</div>;
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-3">
        <Summary label="Status" value={submission.status} />
        <Summary label="Submission id" value={submission.id} />
        <Summary label="Created at" value={new Date(submission.createdAt).toLocaleString()} />
      </div>
      <pre className="rounded-md border border-line bg-canvas p-4 text-xs leading-5 text-zinc-300">
        {JSON.stringify(submission.payload, null, 2)}
      </pre>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-line bg-canvas p-3">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="mt-1 truncate text-sm font-semibold text-baited-ink" title={value}>
        {value}
      </div>
    </div>
  );
}
