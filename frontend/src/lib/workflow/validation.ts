import { getAllowedBranchesForNode } from "./branches";
import { blocksByType as fallbackBlocksByType } from "./catalog";
import type { BlockLookup } from "./branches";
import type { BlockParam, ValidationIssue, ValidationResult, WorkflowPayload } from "./types";

export function validateWorkflowClient(
  payload: WorkflowPayload,
  blocksByType: BlockLookup = fallbackBlocksByType
): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const { nodes, edges } = payload.definition;
  const nodeIdList = nodes.map((node) => node.id);
  const nodeIds = new Set(nodeIdList);
  const nodesById = new Map(nodes.map((node) => [node.id, node]));

  if (!nodes.length) {
    return {
      valid: false,
      errors: [{ code: "empty_workflow", message: "The workflow needs at least one node." }],
      warnings
    };
  }

  if (nodeIdList.length !== nodeIds.size) {
    errors.push({
      code: "duplicate_node_id",
      message: "Every workflow node must have a unique id."
    });
  }

  for (const node of nodes) {
    if (!blocksByType[node.type]) {
      errors.push({
        code: "unknown_node_type",
        message: `Unknown node type '${node.type}'.`,
        nodeId: node.id
      });
    }
  }

  const startNodes = nodes.filter((node) => node.type === "campaign_entrypoint");
  if (startNodes.length !== 1) {
    errors.push({
      code: "invalid_start_count",
      message: "The workflow must contain exactly one Campaign Start node."
    });
  }

  if (!nodes.some((node) => blocksByType[node.type]?.terminal)) {
    errors.push({
      code: "missing_terminal_node",
      message: "At least one risk end-state node is required."
    });
  }

  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, string[]>();
  const branchBySource = new Map<string, string[]>();
  for (const edge of edges) {
    if (!nodeIds.has(edge.source)) {
      errors.push({
        code: "missing_edge_source",
        message: "An edge references a missing source node.",
        edgeId: edge.id
      });
      continue;
    }

    if (!nodeIds.has(edge.target)) {
      errors.push({
        code: "missing_edge_target",
        message: "An edge references a missing target node.",
        edgeId: edge.id
      });
      continue;
    }

    outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge.target]);
    incoming.set(edge.target, [...(incoming.get(edge.target) ?? []), edge.source]);
    branchBySource.set(edge.source, [...(branchBySource.get(edge.source) ?? []), edge.branch]);

    const sourceNode = nodesById.get(edge.source);
    const sourceBlock = sourceNode ? blocksByType[sourceNode.type] : null;
    const allowedBranches = getAllowedBranchesForNode(sourceNode, blocksByType);

    if (allowedBranches.length && !allowedBranches.includes(edge.branch)) {
      errors.push({
        code: "invalid_branch",
        message: `Branch '${edge.branch}' is not valid for ${sourceNode?.label ?? edge.source}.`,
        nodeId: edge.source,
        edgeId: edge.id
      });
    }

    if (sourceBlock?.terminal) {
      errors.push({
        code: "terminal_node_has_output",
        message: "Risk end-state nodes cannot have outgoing edges.",
        nodeId: edge.source,
        edgeId: edge.id
      });
    }
  }

  for (const node of nodes) {
    const block = blocksByType[node.type];
    if (!block) {
      continue;
    }

    for (const param of block.params) {
      const value = node.params[param.name];
      if (isEmptyParamValue(value)) {
        if (!param.required) continue;
        errors.push({
          code: "missing_required_param",
          message: `'${param.label}' is required.`,
          nodeId: node.id
        });
        continue;
      }

      const paramIssue = validateParamValue(param, value, node.id);
      if (paramIssue) {
        errors.push(paramIssue);
      }
    }

    const branches = branchBySource.get(node.id) ?? [];
    if (new Set(branches).size !== branches.length) {
      errors.push({
        code: "duplicate_branch",
        message: "A node cannot use the same branch label more than once.",
        nodeId: node.id
      });
    }

    if (node.type === "condition") {
      const allowedBranches = getAllowedBranchesForNode(node, blocksByType);
      const missingBranches = allowedBranches.filter((branch) => !branches.includes(branch));
      if (allowedBranches.length && missingBranches.length) {
        errors.push({
          code: "condition_missing_outcome",
          message: `Condition is missing outcome branch: ${missingBranches.join(", ")}.`,
          nodeId: node.id
        });
      }
      if (!allowedBranches.length && branches.length < 2) {
        errors.push({
          code: "condition_needs_branches",
          message: "Condition nodes need at least two outgoing branches.",
          nodeId: node.id
        });
      }
    }

    if (node.type !== "condition" && !block.terminal && branches.length > 1) {
      warnings.push({
        code: "multi_output_action",
        message: "Action nodes usually have a single outgoing edge.",
        nodeId: node.id
      });
    }

    if (node.type !== "campaign_entrypoint" && !(incoming.get(node.id) ?? []).length) {
      warnings.push({
        code: "missing_incoming_edge",
        message: "This node is not connected from any previous step.",
        nodeId: node.id
      });
    }
  }

  if (startNodes.length) {
    const reachable = reachableFrom(startNodes[0].id, outgoing);
    for (const node of nodes) {
      if (!reachable.has(node.id)) {
        warnings.push({
          code: "unreachable_node",
          message: "This node is not reachable from Campaign Start.",
          nodeId: node.id
        });
      }
    }
  }

  if (hasCycle([...nodeIds], outgoing)) {
    errors.push({ code: "cycle_detected", message: "The workflow graph must be acyclic." });
  }

  return { valid: errors.length === 0, errors, warnings };
}

function validateParamValue(
  param: BlockParam,
  value: unknown,
  nodeId: string
): ValidationIssue | null {
  if (param.kind === "select") {
    if (typeof value !== "string" || (param.options?.length && !param.options.includes(value))) {
      return {
        code: "invalid_param_option",
        message: `'${param.label}' must be one of: ${(param.options ?? []).join(", ")}.`,
        nodeId
      };
    }
  }

  if (param.kind === "number" && (typeof value !== "number" || !Number.isFinite(value))) {
    return {
      code: "invalid_param_type",
      message: `'${param.label}' must be a finite number.`,
      nodeId
    };
  }

  if (param.kind === "text" && typeof value !== "string") {
    return {
      code: "invalid_param_type",
      message: `'${param.label}' must be text.`,
      nodeId
    };
  }

  return null;
}

function isEmptyParamValue(value: unknown) {
  return value === undefined || value === null || value === "";
}

function hasCycle(nodeIds: string[], outgoing: Map<string, string[]>) {
  const visiting = new Set<string>();
  const visited = new Set<string>();

  function visit(nodeId: string): boolean {
    if (visiting.has(nodeId)) return true;
    if (visited.has(nodeId)) return false;
    visiting.add(nodeId);
    for (const target of outgoing.get(nodeId) ?? []) {
      if (visit(target)) return true;
    }
    visiting.delete(nodeId);
    visited.add(nodeId);
    return false;
  }

  return nodeIds.some((nodeId) => visit(nodeId));
}

function reachableFrom(startId: string, outgoing: Map<string, string[]>) {
  const visited = new Set<string>();
  const queue = [startId];

  while (queue.length) {
    const nodeId = queue.shift();
    if (!nodeId || visited.has(nodeId)) continue;
    visited.add(nodeId);
    queue.push(...(outgoing.get(nodeId) ?? []));
  }

  return visited;
}
