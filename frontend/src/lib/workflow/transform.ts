import { MarkerType } from "@xyflow/react";
import type { Viewport } from "@xyflow/react";
import type {
  WorkflowCanvasEdge,
  WorkflowCanvasNode,
  WorkflowDefinition,
  WorkflowLayout,
  WorkflowPayload
} from "./types";

export function payloadToCanvas(payload: WorkflowPayload): {
  nodes: WorkflowCanvasNode[];
  edges: WorkflowCanvasEdge[];
} {
  const nodes = payload.definition.nodes.map<WorkflowCanvasNode>((node) => ({
    id: node.id,
    type: "workflowNode",
    position: payload.layout.nodes[node.id] ?? { x: 0, y: 0 },
    data: {
      blockType: node.type,
      label: node.label,
      params: node.params,
      status: "idle"
    }
  }));

  const edges = payload.definition.edges.map<WorkflowCanvasEdge>((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: "smoothstep",
    label: edge.branch,
    data: { branch: edge.branch },
    markerEnd: { type: MarkerType.ArrowClosed },
    style: { stroke: branchColor(edge.branch) }
  }));

  return { nodes, edges };
}

export function canvasToPayload(
  nodes: WorkflowCanvasNode[],
  edges: WorkflowCanvasEdge[],
  viewport: Viewport = { x: 0, y: 0, zoom: 1 }
): WorkflowPayload {
  const definition: WorkflowDefinition = {
    schemaVersion: 1,
    nodes: nodes.map((node) => ({
      id: node.id,
      type: node.data.blockType,
      label: node.data.label,
      params: node.data.params
    })),
    edges: edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      branch: String(edge.data?.branch ?? edge.label ?? "success")
    }))
  };

  const layout: WorkflowLayout = {
    nodes: Object.fromEntries(nodes.map((node) => [node.id, node.position])),
    viewport
  };

  return { definition, layout };
}

export function branchColor(branch: string) {
  if (["opened", "yes", "success", "credentials_submitted"].includes(branch)) return "#25d57c";
  if (["not_opened", "not_submitted", "no", "timeout"].includes(branch)) return "#ffb84d";
  if (branch === "else") return "#8b8f98";
  return "#65d3ff";
}
