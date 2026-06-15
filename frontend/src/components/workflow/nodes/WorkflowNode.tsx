"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { AlertTriangle, Check, Circle } from "lucide-react";

import { NodeIcon } from "@/components/workflow/NodeIcon";
import { blocksByType } from "@/lib/workflow/catalog";
import type { WorkflowCanvasNode } from "@/lib/workflow/types";

const colorStyles: Record<string, string> = {
  emerald: "border-emerald-500/70 bg-emerald-500/10 text-emerald-100",
  sky: "border-sky-500/70 bg-sky-500/10 text-sky-100",
  violet: "border-violet-500/70 bg-violet-500/10 text-violet-100",
  amber: "border-amber-500/70 bg-amber-500/10 text-amber-100",
  rose: "border-rose-500/70 bg-rose-500/10 text-rose-100",
  cyan: "border-cyan-500/70 bg-cyan-500/10 text-cyan-100",
  zinc: "border-zinc-500/70 bg-zinc-500/10 text-zinc-100",
  lime: "border-lime-500/70 bg-lime-500/10 text-lime-100"
};

export function WorkflowNode({ data, selected }: NodeProps<WorkflowCanvasNode>) {
  const block = blocksByType[data.blockType];
  const colorClass = colorStyles[block?.color ?? "zinc"] ?? colorStyles.zinc;
  const isTerminal = block?.terminal;

  return (
    <div
      className={[
        "relative w-60 rounded-md border bg-panel shadow-node transition",
        selected ? "border-baited-green ring-2 ring-baited-green/30" : "border-line",
        data.status === "error" ? "ring-2 ring-rose-500/50" : "",
        data.status === "warning" ? "ring-2 ring-amber-500/45" : ""
      ].join(" ")}
    >
      <Handle type="target" position={Position.Left} />
      <div className="flex items-start gap-3 p-3">
        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-md border ${colorClass}`}>
          <NodeIcon icon={block?.icon ?? "split"} className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-baited-ink" title={data.label}>
            {data.label}
          </div>
          <div className="mt-1 truncate text-xs text-zinc-400" title={block?.label}>
            {block?.label ?? data.blockType}
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-zinc-400">
            <StatusIcon status={data.status ?? "idle"} />
            {statusLabel(data.status ?? "idle")}
          </div>
        </div>
      </div>
      {!isTerminal ? <Handle type="source" position={Position.Right} /> : null}
    </div>
  );
}

function StatusIcon({ status }: { status: NonNullable<WorkflowCanvasNode["data"]["status"]> }) {
  if (status === "valid") return <Check className="h-3.5 w-3.5 text-baited-green" />;
  if (status === "error") return <AlertTriangle className="h-3.5 w-3.5 text-rose-400" />;
  if (status === "warning") return <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />;
  return <Circle className="h-3 w-3 text-zinc-500" />;
}

function statusLabel(status: NonNullable<WorkflowCanvasNode["data"]["status"]>) {
  if (status === "valid") return "Configured";
  if (status === "error") return "Needs attention";
  if (status === "warning") return "Review";
  return "Not checked";
}
