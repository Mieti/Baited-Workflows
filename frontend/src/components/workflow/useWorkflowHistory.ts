"use client";

import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";

import type {
  SubmissionRead,
  ValidationResult,
  WorkflowCanvasEdge,
  WorkflowCanvasNode
} from "@/lib/workflow/types";

const HISTORY_LIMIT = 80;

export type SaveState = "idle" | "saving" | "saved" | "error";

export type CanvasSelection = {
  nodeIds: string[];
  edgeIds: string[];
};

export type WorkflowHistorySnapshot = {
  nodes: WorkflowCanvasNode[];
  edges: WorkflowCanvasEdge[];
  workflowName: string;
  workflowDescription: string;
  workflowStatus: string;
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  selection: CanvasSelection;
  validation: ValidationResult | null;
  submission: SubmissionRead | null;
  saveState: SaveState;
};

type UseWorkflowHistoryOptions = {
  createSnapshot: () => WorkflowHistorySnapshot;
  restoreSnapshot: (snapshot: WorkflowHistorySnapshot) => void;
  isReadyRef: MutableRefObject<boolean>;
  beforeUndo?: () => void;
};

export function useWorkflowHistory({
  createSnapshot,
  restoreSnapshot,
  isReadyRef,
  beforeUndo
}: UseWorkflowHistoryOptions) {
  const [canUndo, setCanUndo] = useState(false);
  const historyRef = useRef<WorkflowHistorySnapshot[]>([]);
  const isRestoringHistoryRef = useRef(false);

  const resetHistory = useCallback(() => {
    historyRef.current = [];
    setCanUndo(false);
  }, []);

  const pushHistorySnapshot = useCallback(
    (snapshot: WorkflowHistorySnapshot = createSnapshot()) => {
      if (!isReadyRef.current || isRestoringHistoryRef.current) return;

      const previousSnapshot = historyRef.current.at(-1);
      if (previousSnapshot && historySnapshotsEqual(previousSnapshot, snapshot)) return;

      historyRef.current = [...historyRef.current, snapshot].slice(-HISTORY_LIMIT);
      setCanUndo(true);
    },
    [createSnapshot, isReadyRef]
  );

  const handleUndo = useCallback(() => {
    const snapshot = historyRef.current.pop();
    if (!snapshot) return;

    beforeUndo?.();
    isRestoringHistoryRef.current = true;
    restoreSnapshot(snapshot);
    setCanUndo(historyRef.current.length > 0);
    window.setTimeout(() => {
      isRestoringHistoryRef.current = false;
    }, 0);
  }, [beforeUndo, restoreSnapshot]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const key = event.key.toLowerCase();
      const isUndoShortcut =
        (event.ctrlKey || event.metaKey) && key === "z" && !event.shiftKey && !event.altKey;

      if (!isUndoShortcut || isEditableUndoTarget(event.target)) return;
      if (!historyRef.current.length) return;

      event.preventDefault();
      handleUndo();
    }

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [handleUndo]);

  return {
    canUndo,
    handleUndo,
    isRestoringHistoryRef,
    pushHistorySnapshot,
    resetHistory
  };
}

export function cloneSelection(selection: CanvasSelection): CanvasSelection {
  return {
    nodeIds: [...selection.nodeIds],
    edgeIds: [...selection.edgeIds]
  };
}

export function cloneWorkflowNodes(nodes: WorkflowCanvasNode[]): WorkflowCanvasNode[] {
  return nodes.map((node) => ({
    ...node,
    position: { ...node.position },
    data: {
      ...node.data,
      params: { ...node.data.params }
    }
  }));
}

export function cloneWorkflowEdges(edges: WorkflowCanvasEdge[]): WorkflowCanvasEdge[] {
  return edges.map((edge) => ({
    ...edge,
    data: edge.data ? { ...edge.data } : edge.data,
    markerEnd:
      edge.markerEnd && typeof edge.markerEnd === "object" ? { ...edge.markerEnd } : edge.markerEnd,
    markerStart:
      edge.markerStart && typeof edge.markerStart === "object"
        ? { ...edge.markerStart }
        : edge.markerStart,
    style: edge.style ? { ...edge.style } : edge.style
  }));
}

function historySnapshotsEqual(first: WorkflowHistorySnapshot, second: WorkflowHistorySnapshot) {
  return (
    JSON.stringify({
      nodes: first.nodes,
      edges: first.edges,
      workflowName: first.workflowName,
      workflowDescription: first.workflowDescription,
      workflowStatus: first.workflowStatus,
      selectedNodeId: first.selectedNodeId,
      selectedEdgeId: first.selectedEdgeId,
      selection: first.selection,
      validation: first.validation,
      submission: first.submission,
      saveState: first.saveState
    }) ===
    JSON.stringify({
      nodes: second.nodes,
      edges: second.edges,
      workflowName: second.workflowName,
      workflowDescription: second.workflowDescription,
      workflowStatus: second.workflowStatus,
      selectedNodeId: second.selectedNodeId,
      selectedEdgeId: second.selectedEdgeId,
      selection: second.selection,
      validation: second.validation,
      submission: second.submission,
      saveState: second.saveState
    })
  );
}

function isEditableUndoTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;

  const tagName = target.tagName.toLowerCase();
  return target.isContentEditable || ["input", "textarea", "select"].includes(tagName);
}
