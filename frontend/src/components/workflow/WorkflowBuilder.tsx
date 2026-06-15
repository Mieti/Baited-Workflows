"use client";

import {
  Background,
  Controls,
  MiniMap,
  MarkerType,
  ReactFlow,
  ReactFlowProvider,
  SelectionMode,
  addEdge,
  getOutgoers,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type OnSelectionChangeFunc,
  type Viewport
} from "@xyflow/react";
import { GripHorizontal, Loader2 } from "lucide-react";
import type { DragEvent, KeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { BottomPanel } from "@/components/workflow/BottomPanel";
import { NodeInspector } from "@/components/workflow/NodeInspector";
import { NodePalette } from "@/components/workflow/NodePalette";
import { TopBar } from "@/components/workflow/TopBar";
import { WorkflowToasts } from "@/components/workflow/WorkflowToasts";
import { WorkflowNode } from "@/components/workflow/nodes/WorkflowNode";
import { useWorkflowToasts } from "@/components/workflow/useWorkflowToasts";
import {
  cloneSelection,
  cloneWorkflowEdges,
  cloneWorkflowNodes,
  useWorkflowHistory,
  type CanvasSelection,
  type SaveState,
  type WorkflowHistorySnapshot
} from "@/components/workflow/useWorkflowHistory";
import {
  getApiErrorMessage,
  getDemoWorkflow,
  getWorkflowBlocks,
  saveWorkflow,
  submitWorkflow,
  validateWorkflow
} from "@/lib/api/client";
import { blockCatalog, blocksByType } from "@/lib/workflow/catalog";
import { branchColor, canvasToPayload, payloadToCanvas } from "@/lib/workflow/transform";
import type {
  BlockDefinition,
  SubmissionRead,
  ValidationIssue,
  ValidationResult,
  WorkflowCanvasEdge,
  WorkflowCanvasNode,
  WorkflowNodeData
} from "@/lib/workflow/types";

const nodeTypes = { workflowNode: WorkflowNode };
type PanelTab = "validation" | "payload" | "submission";
type PendingAction = "loading" | "validating" | "saving" | "submitting" | null;
const DEFAULT_BOTTOM_PANEL_HEIGHT = 260;
const MIN_BOTTOM_PANEL_HEIGHT = 150;
const MIN_CANVAS_HEIGHT = 280;
const RESIZE_KEYBOARD_STEP = 24;

export function WorkflowBuilder() {
  return (
    <ReactFlowProvider>
      <WorkflowBuilderInner />
    </ReactFlowProvider>
  );
}

function WorkflowBuilderInner() {
  const [nodes, setNodes, onNodesChange] = useNodesState<WorkflowCanvasNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<WorkflowCanvasEdge>([]);
  const [blocks, setBlocks] = useState<BlockDefinition[]>(blockCatalog);
  const [workflowId, setWorkflowId] = useState("local-demo");
  const [workflowName, setWorkflowName] = useState("Baited demo workflow");
  const [workflowDescription, setWorkflowDescription] = useState("");
  const [workflowStatus, setWorkflowStatus] = useState("draft");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [selection, setSelection] = useState<CanvasSelection>({ nodeIds: [], edgeIds: [] });
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [submission, setSubmission] = useState<SubmissionRead | null>(null);
  const [activeTab, setActiveTab] = useState<PanelTab>("validation");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>("loading");
  const [viewport, setViewportState] = useState<Viewport>({ x: 0, y: 0, zoom: 1 });
  const [bottomPanelHeight, setBottomPanelHeight] = useState(DEFAULT_BOTTOM_PANEL_HEIGHT);
  const [isResizingBottomPanel, setIsResizingBottomPanel] = useState(false);
  const workspaceColumnRef = useRef<HTMLDivElement | null>(null);
  const resizeStartRef = useRef<{ startY: number; startHeight: number } | null>(null);
  const positionDragSnapshotRef = useRef<WorkflowHistorySnapshot | null>(null);
  const hasLoadedWorkflowRef = useRef(false);
  const { dismissToast, showToast, toasts } = useWorkflowToasts();
  const { fitView, screenToFlowPosition, setViewport } = useReactFlow<
    WorkflowCanvasNode,
    WorkflowCanvasEdge
  >();

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId]
  );

  const selectedEdge = useMemo(
    () => edges.find((edge) => edge.id === selectedEdgeId) ?? null,
    [edges, selectedEdgeId]
  );

  const selectedEdgeSourceNode = useMemo(
    () => nodes.find((node) => node.id === selectedEdge?.source) ?? null,
    [nodes, selectedEdge?.source]
  );

  const selectedEdgeTargetNode = useMemo(
    () => nodes.find((node) => node.id === selectedEdge?.target) ?? null,
    [nodes, selectedEdge?.target]
  );

  const selectionSummary = useMemo(
    () => ({ nodes: selection.nodeIds.length, edges: selection.edgeIds.length }),
    [selection.edgeIds.length, selection.nodeIds.length]
  );

  const selectedIssues = useMemo(() => {
    if (!selectedNodeId || !validation) return [];
    return [...validation.errors, ...validation.warnings].filter((issue) => issue.nodeId === selectedNodeId);
  }, [selectedNodeId, validation]);

  const decoratedNodes = useMemo<WorkflowCanvasNode[]>(() => {
    const errorNodes = new Set(validation?.errors.map((issue) => issue.nodeId).filter(Boolean));
    const warningNodes = new Set(validation?.warnings.map((issue) => issue.nodeId).filter(Boolean));

    return nodes.map((node) => {
      const status: WorkflowNodeData["status"] = errorNodes.has(node.id)
        ? "error"
        : warningNodes.has(node.id)
          ? "warning"
          : validation
            ? "valid"
            : "idle";

      return {
        ...node,
        data: {
          ...node.data,
          status
        }
      };
    });
  }, [nodes, validation]);

  const payload = useMemo(() => canvasToPayload(nodes, edges, viewport), [edges, nodes, viewport]);

  const createHistorySnapshot = useCallback(
    (): WorkflowHistorySnapshot => ({
      nodes: cloneWorkflowNodes(nodes),
      edges: cloneWorkflowEdges(edges),
      workflowName,
      workflowDescription,
      workflowStatus,
      selectedNodeId,
      selectedEdgeId,
      selection: cloneSelection(selection),
      validation,
      submission,
      saveState
    }),
    [
      edges,
      nodes,
      saveState,
      selectedEdgeId,
      selectedNodeId,
      selection,
      submission,
      validation,
      workflowDescription,
      workflowName,
      workflowStatus
    ]
  );

  const restoreHistorySnapshot = useCallback(
    (snapshot: WorkflowHistorySnapshot) => {
      setNodes(cloneWorkflowNodes(snapshot.nodes));
      setEdges(cloneWorkflowEdges(snapshot.edges));
      setWorkflowName(snapshot.workflowName);
      setWorkflowDescription(snapshot.workflowDescription);
      setWorkflowStatus(snapshot.workflowStatus);
      setSelectedNodeId(snapshot.selectedNodeId);
      setSelectedEdgeId(snapshot.selectedEdgeId);
      setSelection(cloneSelection(snapshot.selection));
      setValidation(snapshot.validation);
      setSubmission(snapshot.submission);
      setSaveState(snapshot.saveState);
      setNotice("Change undone.");
    },
    [setEdges, setNodes]
  );

  const resetTransientHistory = useCallback(() => {
    positionDragSnapshotRef.current = null;
  }, []);

  const { canUndo, handleUndo, isRestoringHistoryRef, pushHistorySnapshot, resetHistory } =
    useWorkflowHistory({
      createSnapshot: createHistorySnapshot,
      restoreSnapshot: restoreHistorySnapshot,
      isReadyRef: hasLoadedWorkflowRef,
      beforeUndo: resetTransientHistory
    });

  useEffect(() => {
    let isCancelled = false;
    let viewportTimer: number | undefined;
    let readyTimer: number | undefined;

    async function load() {
      hasLoadedWorkflowRef.current = false;
      setPendingAction("loading");
      resetHistory();
      resetTransientHistory();
      showToast({
        id: "workflow-load",
        message: "Loading workflow from the API...",
        tone: "info",
        busy: true,
        timeout: 0
      });

      try {
        const [remoteBlocks, workflow] = await Promise.all([getWorkflowBlocks(), getDemoWorkflow()]);
        if (isCancelled) return;

        const canvas = payloadToCanvas({
          definition: workflow.definition,
          layout: workflow.layout
        });
        setBlocks(remoteBlocks);
        setWorkflowId(workflow.id);
        setWorkflowName(workflow.name);
        setWorkflowDescription(workflow.description);
        setWorkflowStatus(workflow.status);
        setValidation(workflow.validationResult);
        setViewportState(workflow.layout.viewport);
        setNodes(canvas.nodes);
        setEdges(canvas.edges);
        viewportTimer = window.setTimeout(() => {
          if (isCancelled) return;

          void setViewport(workflow.layout.viewport, { duration: 0 });
          readyTimer = window.setTimeout(() => {
            if (isCancelled) return;

            hasLoadedWorkflowRef.current = true;
            setPendingAction(null);
          }, 0);
        }, 80);
        setNotice("Workflow loaded.");
        showToast({
          id: "workflow-load",
          message: "Workflow loaded.",
          tone: "success"
        });
      } catch (error) {
        if (isCancelled) return;

        const message = getApiErrorMessage(error, "Workflow loading failed.");
        setNotice(message);
        showToast({
          id: "workflow-load",
          message,
          tone: "error",
          timeout: 6500
        });
        hasLoadedWorkflowRef.current = true;
        setPendingAction(null);
      }
    }
    void load();

    return () => {
      isCancelled = true;
      if (viewportTimer) window.clearTimeout(viewportTimer);
      if (readyTimer) window.clearTimeout(readyTimer);
    };
  }, [resetHistory, resetTransientHistory, setEdges, setNodes, setViewport, showToast]);

  const markWorkflowEdited = useCallback(
    ({ semantic = true, notice: nextNotice }: { semantic?: boolean; notice?: string } = {}) => {
      setSaveState("idle");
      if (semantic) {
        setValidation(null);
        setSubmission(null);
        setWorkflowStatus((currentStatus) =>
          currentStatus === "submitted" ? "draft" : currentStatus
        );
      }
      if (nextNotice) {
        setNotice(nextNotice);
      }
    },
    []
  );

  const updateNode = useCallback(
    (nodeId: string, changes: Partial<WorkflowCanvasNode["data"]>) => {
      pushHistorySnapshot();
      markWorkflowEdited();
      setNodes((currentNodes) =>
        currentNodes.map((node) =>
          node.id === nodeId
            ? {
                ...node,
                data: {
                  ...node.data,
                  ...changes,
                  params: changes.params ?? node.data.params
                }
              }
            : node
        )
      );
    },
    [markWorkflowEdited, pushHistorySnapshot, setNodes]
  );

  const deleteNode = useCallback(
    (nodeId: string) => {
      pushHistorySnapshot();
      setNodes((currentNodes) => currentNodes.filter((node) => node.id !== nodeId));
      setEdges((currentEdges) =>
        currentEdges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId)
      );
      setSelectedNodeId((currentSelectedId) => (currentSelectedId === nodeId ? null : currentSelectedId));
      setSelection((currentSelection) => ({
        nodeIds: currentSelection.nodeIds.filter((id) => id !== nodeId),
        edgeIds: currentSelection.edgeIds
      }));
      markWorkflowEdited({ notice: "Node removed from the workflow." });
    },
    [markWorkflowEdited, pushHistorySnapshot, setEdges, setNodes]
  );

  const updateEdgeBranch = useCallback(
    (edgeId: string, branch: string) => {
      pushHistorySnapshot();
      setEdges((currentEdges) =>
        currentEdges.map((edge) =>
          edge.id === edgeId
            ? {
                ...edge,
                label: branch,
                data: { ...edge.data, branch },
                style: { ...edge.style, stroke: branchColor(branch) }
              }
            : edge
        )
      );
      markWorkflowEdited();
    },
    [markWorkflowEdited, pushHistorySnapshot, setEdges]
  );

  const deleteEdge = useCallback(
    (edgeId: string) => {
      pushHistorySnapshot();
      setEdges((currentEdges) => currentEdges.filter((edge) => edge.id !== edgeId));
      setSelectedEdgeId((currentSelectedId) => (currentSelectedId === edgeId ? null : currentSelectedId));
      setSelection((currentSelection) => ({
        nodeIds: currentSelection.nodeIds,
        edgeIds: currentSelection.edgeIds.filter((id) => id !== edgeId)
      }));
      markWorkflowEdited({ notice: "Branch removed from the workflow." });
    },
    [markWorkflowEdited, pushHistorySnapshot, setEdges]
  );

  const deleteSelection = useCallback(() => {
    const selectedNodeIds = new Set(selection.nodeIds);
    const selectedEdgeIds = new Set(selection.edgeIds);

    if (!selectedNodeIds.size && !selectedEdgeIds.size) return;

    pushHistorySnapshot();
    setNodes((currentNodes) => currentNodes.filter((node) => !selectedNodeIds.has(node.id)));
    setEdges((currentEdges) =>
      currentEdges.filter(
        (edge) =>
          !selectedEdgeIds.has(edge.id) &&
          !selectedNodeIds.has(edge.source) &&
          !selectedNodeIds.has(edge.target)
      )
    );
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setSelection({ nodeIds: [], edgeIds: [] });
    markWorkflowEdited({ notice: "Selection removed from the workflow." });
  }, [markWorkflowEdited, pushHistorySnapshot, selection.edgeIds, selection.nodeIds, setEdges, setNodes]);

  const addBlock = useCallback(
    (blockType: string, position?: { x: number; y: number }) => {
      const block = blocks.find((item) => item.type === blockType) ?? blocksByType[blockType];
      if (!block) return;

      pushHistorySnapshot();
      const params = Object.fromEntries(
        block.params.map((param) => [
          param.name,
          param.kind === "select" ? (param.options?.[0] ?? "") : param.kind === "number" ? 1 : ""
        ])
      );

      const node: WorkflowCanvasNode = {
        id: `${blockType}-${crypto.randomUUID?.() ?? Date.now()}`,
        type: "workflowNode",
        position: position ?? { x: nodes.length * 36 + 80, y: nodes.length * 20 + 120 },
        data: {
          blockType,
          label: block.label,
          params,
          status: "idle"
        }
      };

      setNodes((currentNodes) => [...currentNodes, node]);
      setSelectedNodeId(node.id);
      setSelectedEdgeId(null);
      setSelection({ nodeIds: [node.id], edgeIds: [] });
      markWorkflowEdited();
    },
    [blocks, markWorkflowEdited, nodes.length, pushHistorySnapshot, setNodes]
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      if (connection.source === connection.target) return;

      const sourceNode = nodes.find((node) => node.id === connection.source);
      const sourceBlock = sourceNode ? blocksByType[sourceNode.data.blockType] : null;
      if (sourceBlock?.terminal) return;

      if (createsCycle(connection.source, connection.target, nodes, edges)) {
        const message = "Connection blocked: workflows must stay acyclic.";
        setNotice(message);
        showToast({
          message,
          tone: "warning",
          timeout: 5200
        });
        return;
      }

      pushHistorySnapshot();
      const branch = nextBranch(sourceNode?.data.blockType, edges.filter((edge) => edge.source === connection.source));
      const edge: Edge = {
        ...connection,
        id: `edge-${crypto.randomUUID?.() ?? Date.now()}`,
        type: "smoothstep",
        label: branch,
        data: { branch },
        markerEnd: { type: MarkerType.ArrowClosed },
        style: { stroke: branchColor(branch) }
      };

      setEdges((currentEdges) => addEdge(edge, currentEdges) as WorkflowCanvasEdge[]);
      setSelectedEdgeId(edge.id);
      setSelectedNodeId(null);
      setSelection({ nodeIds: [], edgeIds: [edge.id] });
      markWorkflowEdited();
    },
    [edges, markWorkflowEdited, nodes, pushHistorySnapshot, setEdges, showToast]
  );

  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();
      const blockType = event.dataTransfer.getData("application/baited-block");
      if (!blockType) return;
      addBlock(
        blockType,
        screenToFlowPosition({
          x: event.clientX,
          y: event.clientY
        })
      );
    },
    [addBlock, screenToFlowPosition]
  );

  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onSelectionChange = useCallback<OnSelectionChangeFunc<WorkflowCanvasNode, WorkflowCanvasEdge>>(
    ({ nodes: selectedNodes, edges: selectedEdges }) => {
      setSelection({
        nodeIds: selectedNodes.map((node) => node.id),
        edgeIds: selectedEdges.map((edge) => edge.id)
      });

      if (selectedNodes.length === 1 && selectedEdges.length === 0) {
        setSelectedNodeId(selectedNodes[0].id);
        setSelectedEdgeId(null);
        return;
      }

      if (selectedEdges.length === 1 && selectedNodes.length === 0) {
        setSelectedEdgeId(selectedEdges[0].id);
        setSelectedNodeId(null);
        return;
      }

      setSelectedNodeId(null);
      setSelectedEdgeId(null);
    },
    []
  );

  const handleNameChange = useCallback(
    (value: string) => {
      pushHistorySnapshot();
      setWorkflowName(value);
      setSaveState("idle");
    },
    [pushHistorySnapshot]
  );

  const runValidation = useCallback(async ({ source = "manual" }: { source?: "manual" | "submit" } = {}) => {
    if (pendingAction) {
      return (
        validation ?? {
          valid: false,
          errors: [
            {
              code: "operation_in_progress",
              message: "Wait for the current operation to finish."
            }
          ],
          warnings: []
        }
      );
    }

    const toastId = source === "submit" ? "workflow-submit-validation" : "workflow-validation";
    let result: ValidationResult;
    let requestFailed = false;

    setPendingAction("validating");
    showToast({
      id: toastId,
      message: source === "submit" ? "Checking workflow before mock submission..." : "Validating workflow...",
      tone: "info",
      busy: true,
      timeout: 0
    });

    try {
      result = await validateWorkflow(workflowId, payload);
    } catch (error) {
      requestFailed = true;
      result = {
        valid: false,
        errors: [
          {
            code: "api_validation_failed",
            message: getApiErrorMessage(error, "Validation failed.")
          }
        ],
        warnings: []
      };
    }

    setValidation(result);
    setActiveTab("validation");
    const message = requestFailed
      ? "Validation request failed."
      : result.valid
        ? "Validation passed."
        : "Validation found issues. Review the Validation tab.";
    setNotice(message);
    showToast({
      id: toastId,
      message,
      tone: requestFailed ? "error" : result.valid ? "success" : "warning",
      timeout: requestFailed || !result.valid ? 6500 : 4200
    });
    setPendingAction(null);
    return result;
  }, [payload, pendingAction, showToast, validation, workflowId]);

  const handleSave = useCallback(async () => {
    if (pendingAction) return;

    setSaveState("saving");
    setPendingAction("saving");
    showToast({
      id: "workflow-save",
      message: "Saving workflow to PostgreSQL...",
      tone: "info",
      busy: true,
      timeout: 0
    });
    try {
      const saved = await saveWorkflow(workflowId, workflowName, workflowDescription, payload);
      setWorkflowId(saved.id);
      setWorkflowStatus(saved.status);
      setValidation(saved.validationResult);
      setSaveState("saved");
      const message = `Saved version ${saved.version} to PostgreSQL.`;
      setNotice(message);
      showToast({
        id: "workflow-save",
        message,
        tone: "success"
      });
    } catch (error) {
      const message = getApiErrorMessage(error, "Save failed.");
      setSaveState("error");
      setNotice(message);
      showToast({
        id: "workflow-save",
        message,
        tone: "error",
        timeout: 6500
      });
    } finally {
      setPendingAction(null);
    }
  }, [payload, pendingAction, showToast, workflowDescription, workflowId, workflowName]);

  const handleSubmit = useCallback(async () => {
    if (pendingAction) return;

    const result = await runValidation({ source: "submit" });
    if (!result.valid) {
      showToast({
        id: "workflow-submit",
        message: "Mock submission blocked until validation issues are resolved.",
        tone: "warning",
        timeout: 6500
      });
      return;
    }

    setPendingAction("submitting");
    showToast({
      id: "workflow-submit",
      message: "Submitting mock execution payload...",
      tone: "info",
      busy: true,
      timeout: 0
    });
    try {
      const submitted = await submitWorkflow(workflowId, payload);
      setSubmission(submitted);
      setWorkflowStatus("submitted");
      setActiveTab("submission");
      const message = "Mock submission stored in PostgreSQL.";
      setNotice(message);
      showToast({
        id: "workflow-submit",
        message,
        tone: "success"
      });
    } catch (error) {
      const message = getApiErrorMessage(error, "Mock submission failed.");
      setActiveTab("submission");
      setNotice(message);
      showToast({
        id: "workflow-submit",
        message,
        tone: "error",
        timeout: 6500
      });
    } finally {
      setPendingAction(null);
    }
  }, [payload, pendingAction, runValidation, showToast, workflowId]);

  const focusIssue = useCallback(
    (issue: ValidationIssue) => {
      if (!issue.nodeId) return;
      setSelectedNodeId(issue.nodeId);
      setSelectedEdgeId(null);
      setSelection({ nodeIds: [issue.nodeId], edgeIds: [] });
      fitView({ nodes: [{ id: issue.nodeId }], duration: 500, padding: 0.55 });
    },
    [fitView]
  );

  const maxBottomPanelHeight = getMaxBottomPanelHeight(workspaceColumnRef.current);


  const clampBottomPanelHeight = useCallback((height: number) => {
    const maxHeight = getMaxBottomPanelHeight(workspaceColumnRef.current);
    return clamp(height, MIN_BOTTOM_PANEL_HEIGHT, maxHeight);
  }, []);

  const resizeBottomPanel = useCallback(
    (height: number) => {
      setBottomPanelHeight(clampBottomPanelHeight(height));
    },
    [clampBottomPanelHeight]
  );

  const startBottomPanelResize = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      resizeStartRef.current = {
        startY: event.clientY,
        startHeight: bottomPanelHeight
      };
      setIsResizingBottomPanel(true);
    },
    [bottomPanelHeight]
  );

  const handleBottomPanelResizeKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "ArrowUp") {
        event.preventDefault();
        resizeBottomPanel(bottomPanelHeight + RESIZE_KEYBOARD_STEP);
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        resizeBottomPanel(bottomPanelHeight - RESIZE_KEYBOARD_STEP);
      }
      if (event.key === "Home") {
        event.preventDefault();
        resizeBottomPanel(MIN_BOTTOM_PANEL_HEIGHT);
      }
      if (event.key === "End") {
        event.preventDefault();
        resizeBottomPanel(getMaxBottomPanelHeight(workspaceColumnRef.current));
      }
    },
    [bottomPanelHeight, resizeBottomPanel]
  );

  useEffect(() => {
    if (!isResizingBottomPanel) return;

    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";

    function handlePointerMove(event: PointerEvent) {
      const resizeStart = resizeStartRef.current;
      if (!resizeStart) return;
      resizeBottomPanel(resizeStart.startHeight + resizeStart.startY - event.clientY);
    }

    function stopResize() {
      resizeStartRef.current = null;
      setIsResizingBottomPanel(false);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopResize);
    window.addEventListener("pointercancel", stopResize);

    return () => {
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopResize);
      window.removeEventListener("pointercancel", stopResize);
    };
  }, [isResizingBottomPanel, resizeBottomPanel]);

  const isWorkflowLoading = pendingAction === "loading";
  const isValidating = pendingAction === "validating";
  const isSaving = pendingAction === "saving";
  const isSubmitting = pendingAction === "submitting";

  return (
    <main className="flex h-screen min-h-[760px] flex-col overflow-hidden bg-canvas text-baited-ink">
      <TopBar
        name={workflowName}
        status={workflowStatus}
        saveState={saveState}
        canUndo={canUndo}
        isLoading={isWorkflowLoading}
        isValidating={isValidating}
        isSaving={isSaving}
        isSubmitting={isSubmitting}
        onNameChange={handleNameChange}
        onUndo={handleUndo}
        onValidate={runValidation}
        onSave={handleSave}
        onSubmit={handleSubmit}
      />

      <div className="flex min-h-0 flex-1">
        <NodePalette blocks={blocks} onAddBlock={addBlock} />

        <div ref={workspaceColumnRef} className="flex min-w-0 flex-1 flex-col">
          <div className="workflow-grid relative min-h-[280px] flex-1">
            {isWorkflowLoading ? (
              <div className="absolute inset-0 z-20 grid place-items-center bg-canvas/70 backdrop-blur-[1px]">
                <div className="flex items-center gap-3 rounded-md border border-line bg-panel/95 px-4 py-3 text-sm font-semibold text-baited-ink shadow-node">
                  <Loader2 className="h-4 w-4 animate-spin text-baited-green" />
                  Loading workflow
                </div>
              </div>
            ) : null}
            <ReactFlow
              nodes={decoratedNodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodesChange={(changes) => {
                if (isRestoringHistoryRef.current) {
                  onNodesChange(changes);
                  return;
                }

                const affectsDefinition = nodeChangesAffectDefinition(changes);
                const startsLayoutDrag = nodeChangesStartLayoutDrag(changes);
                const affectsLayout = nodeChangesAffectLayout(changes);

                if (affectsDefinition) {
                  pushHistorySnapshot();
                } else if (startsLayoutDrag && !positionDragSnapshotRef.current) {
                  positionDragSnapshotRef.current = createHistorySnapshot();
                } else if (affectsLayout && !positionDragSnapshotRef.current) {
                  pushHistorySnapshot();
                }

                onNodesChange(changes);

                if (affectsDefinition) {
                  markWorkflowEdited();
                } else if (affectsLayout) {
                  if (positionDragSnapshotRef.current) {
                    pushHistorySnapshot(positionDragSnapshotRef.current);
                    positionDragSnapshotRef.current = null;
                  }
                  markWorkflowEdited({ semantic: false });
                }
              }}
              onEdgesChange={(changes) => {
                if (isRestoringHistoryRef.current) {
                  onEdgesChange(changes);
                  return;
                }

                const affectsDefinition = edgeChangesAffectDefinition(changes);
                if (affectsDefinition) {
                  pushHistorySnapshot();
                }

                onEdgesChange(changes);

                if (affectsDefinition) {
                  markWorkflowEdited();
                }
              }}
              onConnect={onConnect}
              onSelectionChange={onSelectionChange}
              onDrop={onDrop}
              onDragOver={onDragOver}
              onNodeClick={(_, node) => {
                setSelectedNodeId(node.id);
                setSelectedEdgeId(null);
                setSelection({ nodeIds: [node.id], edgeIds: [] });
              }}
              onEdgeClick={(_, edge) => {
                setSelectedEdgeId(edge.id);
                setSelectedNodeId(null);
                setSelection({ nodeIds: [], edgeIds: [edge.id] });
              }}
              onNodesDelete={(deletedNodes) => {
                const deletedIds = new Set(deletedNodes.map((node) => node.id));
                setSelectedNodeId((currentSelectedId) =>
                  currentSelectedId && deletedIds.has(currentSelectedId) ? null : currentSelectedId
                );
                setSelection((currentSelection) => ({
                  nodeIds: currentSelection.nodeIds.filter((id) => !deletedIds.has(id)),
                  edgeIds: currentSelection.edgeIds
                }));
                markWorkflowEdited();
              }}
              onEdgesDelete={(deletedEdges) => {
                const deletedIds = new Set(deletedEdges.map((edge) => edge.id));
                setSelectedEdgeId((currentSelectedId) =>
                  currentSelectedId && deletedIds.has(currentSelectedId) ? null : currentSelectedId
                );
                setSelection((currentSelection) => ({
                  nodeIds: currentSelection.nodeIds,
                  edgeIds: currentSelection.edgeIds.filter((id) => !deletedIds.has(id))
                }));
                markWorkflowEdited();
              }}
              onPaneClick={() => {
                setSelectedNodeId(null);
                setSelectedEdgeId(null);
                setSelection({ nodeIds: [], edgeIds: [] });
              }}
              onMoveEnd={(_, nextViewport) => {
                setViewportState(nextViewport);
                if (!hasLoadedWorkflowRef.current) return;
                markWorkflowEdited({ semantic: false });
              }}
              selectionOnDrag
              selectionMode={SelectionMode.Partial}
              panOnDrag={[1, 2]}
              multiSelectionKeyCode={["Control", "Meta", "Shift"]}
              deleteKeyCode={["Backspace", "Delete"]}
              fitView
              minZoom={0.25}
              maxZoom={1.4}
              defaultEdgeOptions={{ type: "smoothstep" }}
            >
              <Background color="rgba(255,255,255,0.04)" gap={22} />
              <Controls position="bottom-left" />
              <MiniMap
                pannable
                zoomable
                position="bottom-right"
                nodeColor={(node) => {
                  const data = node.data as WorkflowCanvasNode["data"];
                  if (data.status === "error") return "#fb7185";
                  if (data.status === "warning") return "#fbbf24";
                  return "#25d57c";
                }}
                maskColor="rgba(18,19,20,0.72)"
              />
            </ReactFlow>
          </div>

          <div
            data-testid="workflow-bottom-panel-resizer"
            role="separator"
            aria-label="Resize workflow canvas and details panel"
            aria-orientation="horizontal"
            aria-valuemin={MIN_BOTTOM_PANEL_HEIGHT}
            aria-valuemax={maxBottomPanelHeight}
            aria-valuenow={bottomPanelHeight}
            tabIndex={0}
            onPointerDown={startBottomPanelResize}
            onDoubleClick={() => resizeBottomPanel(DEFAULT_BOTTOM_PANEL_HEIGHT)}
            onKeyDown={handleBottomPanelResizeKeyDown}
            className={[
              "group relative z-20 flex h-3 shrink-0 cursor-row-resize items-center justify-center border-y border-line bg-panel2 outline-none transition",
              isResizingBottomPanel ? "border-baited-green/70 bg-baited-green/10" : "hover:border-baited-green/60 hover:bg-panel"
            ].join(" ")}
            title="Drag to resize the canvas and lower panel"
          >
            <div className="flex h-5 w-16 items-center justify-center rounded-md border border-line bg-canvas text-zinc-500 transition group-hover:border-baited-green/50 group-hover:text-baited-green group-focus-visible:border-baited-green group-focus-visible:text-baited-green">
              <GripHorizontal className="h-4 w-4" />
            </div>
          </div>

          <BottomPanel
            activeTab={activeTab}
            height={bottomPanelHeight}
            payload={payload}
            validation={validation}
            submission={submission}
            notice={notice}
            onTabChange={setActiveTab}
            onIssueClick={focusIssue}
          />
        </div>

        <NodeInspector
          node={selectedNode}
          edge={selectedEdge}
          edgeSourceNode={selectedEdgeSourceNode}
          edgeTargetNode={selectedEdgeTargetNode}
          selectionSummary={selectionSummary}
          issues={selectedIssues}
          onUpdateNode={updateNode}
          onDeleteNode={deleteNode}
          onUpdateEdgeBranch={updateEdgeBranch}
          onDeleteEdge={deleteEdge}
          onDeleteSelection={deleteSelection}
        />
      </div>
      <WorkflowToasts toasts={toasts} onDismiss={dismissToast} />
    </main>
  );
}

function nodeChangesAffectDefinition(changes: NodeChange<WorkflowCanvasNode>[]) {
  return changes.some((change) => ["add", "remove", "replace"].includes(change.type));
}

function nodeChangesStartLayoutDrag(changes: NodeChange<WorkflowCanvasNode>[]) {
  return changes.some((change) => change.type === "position" && "dragging" in change && change.dragging);
}

function nodeChangesAffectLayout(changes: NodeChange<WorkflowCanvasNode>[]) {
  return changes.some(
    (change) => change.type === "position" && (!("dragging" in change) || !change.dragging)
  );
}

function edgeChangesAffectDefinition(changes: EdgeChange<WorkflowCanvasEdge>[]) {
  return changes.some((change) => ["add", "remove", "replace"].includes(change.type));
}

function getMaxBottomPanelHeight(container: HTMLDivElement | null) {
  const containerHeight = container?.getBoundingClientRect().height ?? 720;
  return Math.max(
    MIN_BOTTOM_PANEL_HEIGHT,
    Math.floor(containerHeight - MIN_CANVAS_HEIGHT)
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function nextBranch(blockType: string | undefined, existingEdges: WorkflowCanvasEdge[]) {
  const used = new Set(existingEdges.map((edge) => String(edge.data?.branch ?? edge.label)));
  const preferred =
    blockType === "condition"
      ? ["yes", "no", "else", "opened", "not_opened", "credentials_submitted", "not_submitted"]
      : blockType === "wait_for_event"
        ? ["success", "timeout"]
        : ["success"];

  return preferred.find((branch) => !used.has(branch)) ?? `branch_${existingEdges.length + 1}`;
}

function createsCycle(
  source: string,
  target: string,
  nodes: WorkflowCanvasNode[],
  edges: WorkflowCanvasEdge[]
) {
  const candidateEdges = [...edges, { id: "candidate", source, target } as WorkflowCanvasEdge];
  const targetNode = nodes.find((node) => node.id === target);
  if (!targetNode) return false;

  const visited = new Set<string>();
  const stack = [targetNode];

  while (stack.length) {
    const node = stack.pop();
    if (!node || visited.has(node.id)) continue;
    if (node.id === source) return true;
    visited.add(node.id);
    stack.push(
      ...(getOutgoers(node as Node, nodes as Node[], candidateEdges as Edge[]) as WorkflowCanvasNode[])
    );
  }

  return false;
}
