"use client";

import { GitBranch, MousePointer2, Settings2, Trash2 } from "lucide-react";

import { NodeIcon } from "@/components/workflow/NodeIcon";
import { getAllowedBranchesForNode } from "@/lib/workflow/branches";
import { blocksByType } from "@/lib/workflow/catalog";
import type { ValidationIssue, WorkflowCanvasEdge, WorkflowCanvasNode } from "@/lib/workflow/types";

type NodeInspectorProps = {
  node: WorkflowCanvasNode | null;
  edge: WorkflowCanvasEdge | null;
  edgeSourceNode: WorkflowCanvasNode | null;
  edgeTargetNode: WorkflowCanvasNode | null;
  selectionSummary: {
    nodes: number;
    edges: number;
  };
  issues: ValidationIssue[];
  onUpdateNode: (
    nodeId: string,
    changes: Partial<WorkflowCanvasNode["data"]>
  ) => void;
  onDeleteNode: (nodeId: string) => void;
  onUpdateEdgeBranch: (edgeId: string, branch: string) => void;
  onDeleteEdge: (edgeId: string) => void;
  onDeleteSelection: () => void;
};

export function NodeInspector({
  node,
  edge,
  edgeSourceNode,
  edgeTargetNode,
  selectionSummary,
  issues,
  onUpdateNode,
  onDeleteNode,
  onUpdateEdgeBranch,
  onDeleteEdge,
  onDeleteSelection
}: NodeInspectorProps) {
  if (edge) {
    const currentBranch = String(edge.data?.branch ?? edge.label ?? "success");
    const allowedBranches = getAllowedBranchesForNode(edgeSourceNode);
    const branchOptions = allowedBranches.includes(currentBranch)
      ? allowedBranches
      : [currentBranch, ...allowedBranches];

    return (
      <aside className="flex h-full w-[360px] shrink-0 flex-col border-l border-line bg-panel">
        <div className="border-b border-line p-4">
          <div className="text-xs font-semibold uppercase text-zinc-500">Inspector</div>
          <div className="mt-3 flex items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-line bg-canvas text-baited-green">
              <GitBranch className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-baited-ink">Branch</div>
              <div className="truncate text-xs text-zinc-500">{edge.id}</div>
            </div>
            <button
              type="button"
              onClick={() => onDeleteEdge(edge.id)}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-rose-500/40 bg-rose-500/10 text-rose-200 transition hover:border-rose-400 hover:bg-rose-500/20 hover:text-rose-100"
              title="Delete branch"
              aria-label="Delete selected branch"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="thin-scrollbar flex-1 overflow-y-auto p-4">
          <div className="rounded-md border border-line bg-canvas p-3">
            <div className="text-xs font-semibold text-zinc-500">From</div>
            <div className="mt-1 truncate text-sm text-baited-ink">
              {edgeSourceNode?.data.label ?? edge.source}
            </div>
            <div className="mt-3 text-xs font-semibold text-zinc-500">To</div>
            <div className="mt-1 truncate text-sm text-baited-ink">
              {edgeTargetNode?.data.label ?? edge.target}
            </div>
          </div>

          <label className="mt-5 block">
            <span className="text-xs font-semibold text-zinc-400">Branch label</span>
            <select
              value={String(edge.data?.branch ?? edge.label ?? "success")}
              onChange={(event) => onUpdateEdgeBranch(edge.id, event.target.value)}
              className="mt-2 w-full rounded-md border border-line bg-canvas px-3 py-2 text-sm text-baited-ink outline-none focus:border-baited-green"
            >
              {branchOptions.map((branch) => (
                <option key={branch} value={branch}>
                  {allowedBranches.includes(branch) ? branch : `${branch} (invalid)`}
                </option>
              ))}
            </select>
          </label>
        </div>
      </aside>
    );
  }

  const selectedItemsCount = selectionSummary.nodes + selectionSummary.edges;

  if (!node && selectedItemsCount > 0) {
    return (
      <aside className="flex h-full w-[360px] shrink-0 flex-col border-l border-line bg-panel">
        <div className="border-b border-line p-4">
          <div className="text-xs font-semibold uppercase text-zinc-500">Inspector</div>
          <div className="mt-3 flex items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-line bg-canvas text-baited-green">
              <MousePointer2 className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-baited-ink">Selection</div>
              <div className="truncate text-xs text-zinc-500">
                {selectedItemsCount} selected item{selectedItemsCount === 1 ? "" : "s"}
              </div>
            </div>
            <button
              type="button"
              onClick={onDeleteSelection}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-rose-500/40 bg-rose-500/10 text-rose-200 transition hover:border-rose-400 hover:bg-rose-500/20 hover:text-rose-100"
              title="Delete selection"
              aria-label="Delete selected items"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="thin-scrollbar flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-md border border-line bg-canvas p-3">
              <div className="text-xs font-semibold uppercase text-zinc-500">Nodes</div>
              <div className="mt-2 text-2xl font-semibold text-baited-ink">
                {selectionSummary.nodes}
              </div>
            </div>
            <div className="rounded-md border border-line bg-canvas p-3">
              <div className="text-xs font-semibold uppercase text-zinc-500">Branches</div>
              <div className="mt-2 text-2xl font-semibold text-baited-ink">
                {selectionSummary.edges}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onDeleteSelection}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm font-semibold text-rose-100 transition hover:border-rose-400 hover:bg-rose-500/20"
          >
            <Trash2 className="h-4 w-4" />
            Delete selection
          </button>
        </div>
      </aside>
    );
  }

  if (!node) {
    return (
      <aside className="flex h-full w-[360px] shrink-0 flex-col border-l border-line bg-panel">
        <div className="border-b border-line p-4">
          <div className="text-xs font-semibold uppercase text-zinc-500">
            Inspector
          </div>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center p-8 text-center text-sm text-zinc-500">
          <Settings2 className="mb-3 h-7 w-7 text-zinc-600" />
          Select a node to configure its campaign parameters.
        </div>
      </aside>
    );
  }

  const block = blocksByType[node.data.blockType];

  return (
    <aside className="flex h-full w-[360px] shrink-0 flex-col border-l border-line bg-panel">
      <div className="border-b border-line p-4">
        <div className="text-xs font-semibold uppercase text-zinc-500">
          Inspector
        </div>
        <div className="mt-3 flex items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-line bg-canvas">
            <NodeIcon icon={block?.icon ?? "split"} className="h-5 w-5 text-baited-green" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-baited-ink">{block?.label}</div>
            <div className="truncate text-xs text-zinc-500">{node.id}</div>
          </div>
          <button
            type="button"
            onClick={() => onDeleteNode(node.id)}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-rose-500/40 bg-rose-500/10 text-rose-200 transition hover:border-rose-400 hover:bg-rose-500/20 hover:text-rose-100"
            title="Delete node"
            aria-label="Delete selected node"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="thin-scrollbar flex-1 overflow-y-auto p-4">
        <label className="block">
          <span className="text-xs font-semibold text-zinc-400">Node label</span>
          <input
            value={node.data.label}
            onChange={(event) => onUpdateNode(node.id, { label: event.target.value })}
            className="mt-2 w-full rounded-md border border-line bg-canvas px-3 py-2 text-sm text-baited-ink outline-none focus:border-baited-green"
          />
        </label>

        <div className="mt-6 space-y-4">
          {block?.params.length ? (
            block.params.map((param) => (
              <label key={param.name} className="block">
                <span className="flex items-center justify-between text-xs font-semibold text-zinc-400">
                  {param.label}
                  {param.required ? <span className="text-rose-300">Required</span> : null}
                </span>
                {param.kind === "select" ? (
                  <select
                    value={String(node.data.params[param.name] ?? "")}
                    onChange={(event) =>
                      onUpdateNode(node.id, {
                        params: { ...node.data.params, [param.name]: event.target.value }
                      })
                    }
                    className="mt-2 w-full rounded-md border border-line bg-canvas px-3 py-2 text-sm text-baited-ink outline-none focus:border-baited-green"
                  >
                    <option value="" disabled>
                      Select...
                    </option>
                    {param.options?.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={param.kind === "number" ? "number" : "text"}
                    value={String(node.data.params[param.name] ?? "")}
                    onChange={(event) =>
                      onUpdateNode(node.id, {
                        params: {
                          ...node.data.params,
                          [param.name]:
                            param.kind === "number"
                              ? event.target.value === ""
                                ? ""
                                : Number(event.target.value)
                              : event.target.value
                        }
                      })
                    }
                    className="mt-2 w-full rounded-md border border-line bg-canvas px-3 py-2 text-sm text-baited-ink outline-none focus:border-baited-green"
                  />
                )}
              </label>
            ))
          ) : (
            <div className="rounded-md border border-line bg-canvas p-3 text-sm text-zinc-500">
              This risk end-state does not need configuration.
            </div>
          )}
        </div>

        {issues.length ? (
          <div className="mt-6 rounded-md border border-rose-500/40 bg-rose-500/10 p-3">
            <div className="text-xs font-semibold uppercase text-rose-200">
              Attention
            </div>
            <div className="mt-2 space-y-2">
              {issues.map((issue) => (
                <div key={`${issue.code}-${issue.message}`} className="text-sm text-rose-100">
                  {issue.message}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
