import { blocksByType } from "./catalog";
import type { BlockDefinition, WorkflowCanvasEdge, WorkflowCanvasNode, WorkflowNodeDefinition } from "./types";

type BranchSource = WorkflowCanvasNode | WorkflowNodeDefinition;

export function getAllowedBranchesForNode(node: BranchSource | null | undefined): string[] {
  if (!node) return [];

  const blockType = "data" in node ? node.data.blockType : node.type;
  const params = "data" in node ? node.data.params : node.params;
  return getAllowedBranchesForBlock(blocksByType[blockType], params);
}

export function getNextAvailableBranch(
  node: BranchSource | null | undefined,
  existingEdges: WorkflowCanvasEdge[]
) {
  const used = new Set(existingEdges.map((edge) => String(edge.data?.branch ?? edge.label)));
  return getAllowedBranchesForNode(node).find((branch) => !used.has(branch)) ?? null;
}

export function getAllowedBranchesForBlock(
  block: BlockDefinition | undefined,
  params: Record<string, string | number | boolean | null>
): string[] {
  if (!block) return [];

  const rule = block.branchRule;
  if (rule) {
    const value = params[rule.param];
    return typeof value === "string" ? (rule.branchesByValue[value] ?? []) : [];
  }

  return block.allowedBranches ?? [];
}

