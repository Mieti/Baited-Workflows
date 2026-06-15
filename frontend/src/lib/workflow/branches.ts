import { blocksByType as fallbackBlocksByType } from "./catalog";
import type { BlockDefinition, WorkflowCanvasEdge, WorkflowCanvasNode, WorkflowNodeDefinition } from "./types";

type BranchSource = WorkflowCanvasNode | WorkflowNodeDefinition;
export type BlockLookup = Record<string, BlockDefinition | undefined>;

export function getAllowedBranchesForNode(
  node: BranchSource | null | undefined,
  blocksByType: BlockLookup = fallbackBlocksByType
): string[] {
  if (!node) return [];

  const blockType = "data" in node ? node.data.blockType : node.type;
  const params = "data" in node ? node.data.params : node.params;
  return getAllowedBranchesForBlock(blocksByType[blockType], params);
}

export function getNextAvailableBranch(
  node: BranchSource | null | undefined,
  existingEdges: WorkflowCanvasEdge[],
  blocksByType: BlockLookup = fallbackBlocksByType
) {
  const used = new Set(existingEdges.map((edge) => String(edge.data?.branch ?? edge.label)));
  return getAllowedBranchesForNode(node, blocksByType).find((branch) => !used.has(branch)) ?? null;
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

  return block.allowedBranches ?? block.outputs?.map((output) => output.key) ?? [];
}
