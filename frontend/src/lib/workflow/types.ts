import type { Edge, Node } from "@xyflow/react";

export type WorkflowStatus = "draft" | "submitted" | "archived";

export type ParamKind = "text" | "number" | "select";

export type BlockParam = {
  name: string;
  label: string;
  kind: ParamKind;
  required: boolean;
  options?: string[];
};

export type BlockDefinition = {
  type: string;
  version?: number;
  category: string;
  label: string;
  description: string;
  icon: string;
  color: string;
  params: BlockParam[];
  outputs?: { key: string; label: string }[];
  allowedBranches?: string[];
  branchRule?: {
    param: string;
    branchesByValue: Record<string, string[]>;
  };
  terminal?: boolean;
};

export type WorkflowNodeDefinition = {
  id: string;
  type: string;
  label: string;
  params: Record<string, string | number | boolean | null>;
};

export type WorkflowEdgeDefinition = {
  id: string;
  source: string;
  target: string;
  branch: string;
};

export type WorkflowDefinition = {
  schemaVersion: number;
  nodes: WorkflowNodeDefinition[];
  edges: WorkflowEdgeDefinition[];
};

export type WorkflowLayout = {
  nodes: Record<string, { x: number; y: number }>;
  viewport: { x: number; y: number; zoom: number };
};

export type WorkflowPayload = {
  definition: WorkflowDefinition;
  layout: WorkflowLayout;
};

export type ValidationIssue = {
  code: string;
  message: string;
  nodeId?: string | null;
  edgeId?: string | null;
};

export type ValidationResult = {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
};

export type SubmissionRead = {
  id: string;
  workflowId: string;
  versionId: string;
  payload: WorkflowPayload & { submittedBy?: string };
  status: string;
  createdAt: string;
};

export type WorkflowRead = {
  id: string;
  name: string;
  description: string;
  status: WorkflowStatus;
  version: number;
  definition: WorkflowDefinition;
  layout: WorkflowLayout;
  validationResult: ValidationResult;
  createdAt: string;
  updatedAt: string;
};

export type WorkflowNodeData = {
  blockType: string;
  label: string;
  params: Record<string, string | number | boolean | null>;
  block?: BlockDefinition;
  status?: "valid" | "warning" | "error" | "idle";
};

export type WorkflowCanvasNode = Node<WorkflowNodeData, "workflowNode">;

export type WorkflowCanvasEdge = Edge<{ branch: string }>;
