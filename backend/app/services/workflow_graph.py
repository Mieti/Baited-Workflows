from uuid import UUID

from sqlmodel import Session, select

from app.models.workflow import WorkflowVersion, WorkflowVersionEdge, WorkflowVersionNode
from app.schemas.workflow import WorkflowDefinition
from app.services.blocks import get_block_versions_by_type


def replace_workflow_graph_projection(
    session: Session,
    version: WorkflowVersion,
    definition: WorkflowDefinition,
) -> None:
    _delete_graph_projection(session, version.id)
    block_versions = get_block_versions_by_type(session)

    for node in definition.nodes:
        session.add(
            WorkflowVersionNode(
                workflow_version_id=version.id,
                node_key=node.id,
                block_type_key=node.type,
                block_version=block_versions.get(node.type, 1),
                label=node.label,
                params=node.params,
            )
        )

    for edge in definition.edges:
        session.add(
            WorkflowVersionEdge(
                workflow_version_id=version.id,
                edge_key=edge.id,
                source_node_key=edge.source,
                target_node_key=edge.target,
                source_output_key=edge.branch,
            )
        )


def has_workflow_graph_projection(session: Session, version_id: UUID) -> bool:
    node = session.exec(
        select(WorkflowVersionNode).where(WorkflowVersionNode.workflow_version_id == version_id)
    ).first()
    edge = session.exec(
        select(WorkflowVersionEdge).where(WorkflowVersionEdge.workflow_version_id == version_id)
    ).first()
    return node is not None or edge is not None


def ensure_workflow_graph_projection(
    session: Session,
    version: WorkflowVersion,
    *,
    commit: bool = False,
) -> None:
    if has_workflow_graph_projection(session, version.id):
        return

    definition = WorkflowDefinition.model_validate(version.definition)
    replace_workflow_graph_projection(session, version, definition)
    if commit:
        session.commit()


def _delete_graph_projection(session: Session, version_id: UUID) -> None:
    edges = session.exec(
        select(WorkflowVersionEdge).where(WorkflowVersionEdge.workflow_version_id == version_id)
    ).all()
    nodes = session.exec(
        select(WorkflowVersionNode).where(WorkflowVersionNode.workflow_version_id == version_id)
    ).all()

    for edge in edges:
        session.delete(edge)
    for node in nodes:
        session.delete(node)
    session.flush()
