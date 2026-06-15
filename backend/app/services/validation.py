from collections import defaultdict, deque
from math import isfinite
from typing import Any

from app.schemas.workflow import (
    ValidationIssue,
    ValidationResult,
    WorkflowDefinition,
    WorkflowNode,
)
from app.services.blocks import get_static_block_catalog


def _blocks_by_type(block_catalog: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    return {block["type"]: block for block in block_catalog}


def validate_workflow(
    definition: WorkflowDefinition,
    block_catalog: list[dict[str, Any]] | None = None,
) -> ValidationResult:
    errors: list[ValidationIssue] = []
    warnings: list[ValidationIssue] = []
    blocks_by_type = _blocks_by_type(block_catalog or get_static_block_catalog())
    terminal_node_types = {
        block_type
        for block_type, block in blocks_by_type.items()
        if block.get("terminal") is True
    }

    nodes = definition.nodes
    edges = definition.edges
    node_ids = [node.id for node in nodes]
    node_id_set = set(node_ids)
    nodes_by_id = {node.id: node for node in nodes}

    if not nodes:
        errors.append(
            ValidationIssue(
                code="empty_workflow",
                message="The workflow needs at least one node.",
            )
        )
        return ValidationResult(valid=False, errors=errors, warnings=warnings)

    if len(node_ids) != len(node_id_set):
        errors.append(
            ValidationIssue(
                code="duplicate_node_id",
                message="Every workflow node must have a unique id.",
            )
        )

    unknown_nodes = [node for node in nodes if node.type not in blocks_by_type]
    for node in unknown_nodes:
        errors.append(
            ValidationIssue(
                code="unknown_node_type",
                message=f"Unknown node type '{node.type}'.",
                nodeId=node.id,
            )
        )

    start_nodes = [node for node in nodes if node.type == "campaign_entrypoint"]
    if len(start_nodes) != 1:
        errors.append(
            ValidationIssue(
                code="invalid_start_count",
                message="The workflow must contain exactly one Campaign Start node.",
            )
        )

    terminal_nodes = [node for node in nodes if node.type in terminal_node_types]
    if not terminal_nodes:
        errors.append(
            ValidationIssue(
                code="missing_terminal_node",
                message="At least one risk end-state node is required.",
            )
        )

    outgoing: dict[str, list[str]] = defaultdict(list)
    incoming: dict[str, list[str]] = defaultdict(list)
    edge_branches_by_source: dict[str, list[str]] = defaultdict(list)

    for edge in edges:
        if edge.source not in node_id_set:
            errors.append(
                ValidationIssue(
                    code="missing_edge_source",
                    message="An edge references a missing source node.",
                    edgeId=edge.id,
                )
            )
            continue
        if edge.target not in node_id_set:
            errors.append(
                ValidationIssue(
                    code="missing_edge_target",
                    message="An edge references a missing target node.",
                    edgeId=edge.id,
                )
            )
            continue

        outgoing[edge.source].append(edge.target)
        incoming[edge.target].append(edge.source)
        edge_branches_by_source[edge.source].append(edge.branch)

        source_node = nodes_by_id[edge.source]
        block = blocks_by_type.get(source_node.type, {})
        allowed_branches = set(_allowed_branches_for_node(source_node, blocks_by_type))
        if allowed_branches and edge.branch not in allowed_branches:
            errors.append(
                ValidationIssue(
                    code="invalid_branch",
                    message=f"Branch '{edge.branch}' is not valid for {source_node.label}.",
                    nodeId=edge.source,
                    edgeId=edge.id,
                )
            )
        if block.get("terminal"):
            errors.append(
                ValidationIssue(
                    code="terminal_node_has_output",
                    message="Risk end-state nodes cannot have outgoing edges.",
                    nodeId=edge.source,
                    edgeId=edge.id,
                )
            )

    for node in nodes:
        block = blocks_by_type.get(node.type)
        if not block:
            continue

        for param in block.get("params", []):
            value = node.params.get(param["name"])
            if _is_empty_param_value(value):
                if not param.get("required"):
                    continue
                errors.append(
                    ValidationIssue(
                        code="missing_required_param",
                        message=f"'{param['label']}' is required.",
                        nodeId=node.id,
                    )
                )
                continue

            param_issue = _validate_param_value(param, value, node.id)
            if param_issue:
                errors.append(param_issue)

        branch_names = edge_branches_by_source[node.id]
        if len(branch_names) != len(set(branch_names)):
            errors.append(
                ValidationIssue(
                    code="duplicate_branch",
                    message="A node cannot use the same branch label more than once.",
                    nodeId=node.id,
                )
            )

        if node.type == "condition":
            allowed_branches = _allowed_branches_for_node(node, blocks_by_type)
            missing_branches = [
                branch for branch in allowed_branches if branch not in branch_names
            ]
            if allowed_branches and missing_branches:
                errors.append(
                    ValidationIssue(
                        code="condition_missing_outcome",
                        message=(
                            "Condition is missing outcome branch: "
                            f"{', '.join(missing_branches)}."
                        ),
                        nodeId=node.id,
                    )
                )
            if not allowed_branches and len(branch_names) < 2:
                errors.append(
                    ValidationIssue(
                        code="condition_needs_branches",
                        message="Condition nodes need at least two outgoing branches.",
                        nodeId=node.id,
                    )
                )

        if node.type != "condition" and not block.get("terminal") and len(branch_names) > 1:
            warnings.append(
                ValidationIssue(
                    code="multi_output_action",
                    message="Action nodes usually have a single outgoing edge.",
                    nodeId=node.id,
                )
            )

        if node.type != "campaign_entrypoint" and not incoming[node.id]:
            warnings.append(
                ValidationIssue(
                    code="missing_incoming_edge",
                    message="This node is not connected from any previous step.",
                    nodeId=node.id,
                )
            )

    if start_nodes:
        reachable = _reachable_from(start_nodes[0].id, outgoing)
        for node in nodes:
            if node.id not in reachable:
                warnings.append(
                    ValidationIssue(
                        code="unreachable_node",
                        message="This node is not reachable from Campaign Start.",
                        nodeId=node.id,
                    )
                )

    if _has_cycle(node_id_set, outgoing):
        errors.append(
            ValidationIssue(
                code="cycle_detected",
                message="The workflow graph must be acyclic.",
            )
        )

    return ValidationResult(valid=not errors, errors=errors, warnings=warnings)


def _validate_param_value(
    param: dict[str, Any],
    value: Any,
    node_id: str,
) -> ValidationIssue | None:
    kind = param.get("kind")
    label = param.get("label", param.get("name", "Parameter"))

    if kind == "select":
        options = param.get("options") or []
        if not isinstance(value, str) or (options and value not in options):
            return ValidationIssue(
                code="invalid_param_option",
                message=f"'{label}' must be one of: {', '.join(options)}.",
                nodeId=node_id,
            )

    if kind == "number":
        if isinstance(value, bool) or not isinstance(value, (int, float)) or not isfinite(value):
            return ValidationIssue(
                code="invalid_param_type",
                message=f"'{label}' must be a finite number.",
                nodeId=node_id,
            )

    if kind == "text" and not isinstance(value, str):
        return ValidationIssue(
            code="invalid_param_type",
            message=f"'{label}' must be text.",
            nodeId=node_id,
        )

    return None


def _allowed_branches_for_node(
    node: WorkflowNode,
    blocks_by_type: dict[str, dict[str, Any]],
) -> list[str]:
    block = blocks_by_type.get(node.type, {})
    branch_rule = block.get("branchRule")
    if branch_rule:
        value = node.params.get(branch_rule["param"])
        if not isinstance(value, str):
            return []
        return branch_rule.get("branchesByValue", {}).get(value, [])

    return block.get("allowedBranches", [])


def _is_empty_param_value(value: Any) -> bool:
    return value is None or value == ""


def _reachable_from(start_id: str, outgoing: dict[str, list[str]]) -> set[str]:
    visited: set[str] = set()
    queue: deque[str] = deque([start_id])
    while queue:
        node_id = queue.popleft()
        if node_id in visited:
            continue
        visited.add(node_id)
        queue.extend(outgoing[node_id])
    return visited


def _has_cycle(node_ids: set[str], outgoing: dict[str, list[str]]) -> bool:
    visiting: set[str] = set()
    visited: set[str] = set()

    def visit(node_id: str) -> bool:
        if node_id in visiting:
            return True
        if node_id in visited:
            return False

        visiting.add(node_id)
        for target_id in outgoing[node_id]:
            if visit(target_id):
                return True
        visiting.remove(node_id)
        visited.add(node_id)
        return False

    return any(visit(node_id) for node_id in node_ids if node_id not in visited)
