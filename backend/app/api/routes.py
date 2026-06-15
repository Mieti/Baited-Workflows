from typing import Any
from uuid import UUID

from fastapi import APIRouter, HTTPException
from sqlmodel import Session, desc, select

from app.db.session import engine
from app.models.workflow import (
    Workflow,
    WorkflowSubmission,
    WorkflowVersion,
    WorkflowVersionEdge,
    WorkflowVersionNode,
    utcnow,
)
from app.schemas.workflow import (
    SubmissionRead,
    ValidationResult,
    WorkflowCreate,
    WorkflowGraphRead,
    WorkflowPayload,
    WorkflowRead,
    WorkflowUpdate,
)
from app.services.blocks import get_block_catalog
from app.services.demo import (
    DEMO_DEFINITION,
    DEMO_LAYOUT,
    DEMO_WORKFLOW_DESCRIPTION,
    DEMO_WORKFLOW_ID,
    DEMO_WORKFLOW_NAME,
)
from app.services.validation import validate_workflow
from app.services.workflow_graph import (
    ensure_workflow_graph_projection,
    replace_workflow_graph_projection,
)

router = APIRouter(prefix="/api")


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/workflow-blocks")
def workflow_blocks() -> list[dict[str, Any]]:
    with Session(engine) as session:
        return get_block_catalog(session)


@router.post("/workflows/validate", response_model=ValidationResult)
def validate_unsaved_workflow(payload: WorkflowPayload) -> ValidationResult:
    with Session(engine) as session:
        return validate_workflow(payload.definition, get_block_catalog(session))


@router.get("/workflows/demo", response_model=WorkflowRead)
def get_demo_workflow() -> WorkflowRead:
    with Session(engine) as session:
        existing = session.get(Workflow, DEMO_WORKFLOW_ID)
        if not existing:
            existing = session.exec(
                select(Workflow)
                .where(Workflow.description == DEMO_WORKFLOW_DESCRIPTION)
                .order_by(desc(Workflow.created_at))
            ).first()
        if not existing:
            existing = session.exec(
                select(Workflow)
                .where(Workflow.name == DEMO_WORKFLOW_NAME)
                .order_by(desc(Workflow.created_at))
            ).first()
        if existing:
            return _workflow_read(session, existing)

        workflow = Workflow(
            id=DEMO_WORKFLOW_ID,
            name=DEMO_WORKFLOW_NAME,
            description=DEMO_WORKFLOW_DESCRIPTION,
        )
        catalog = get_block_catalog(session)
        validation = validate_workflow(DEMO_DEFINITION, catalog)
        version = WorkflowVersion(
            workflow_id=workflow.id,
            version=1,
            definition=DEMO_DEFINITION.model_dump(by_alias=True),
            layout=DEMO_LAYOUT.model_dump(),
            validation_result=validation.model_dump(by_alias=True),
        )
        session.add(workflow)
        session.add(version)
        session.flush()
        replace_workflow_graph_projection(session, version, DEMO_DEFINITION)
        session.commit()
        session.refresh(workflow)
        return _workflow_read(session, workflow)


@router.get("/workflows", response_model=list[WorkflowRead])
def list_workflows() -> list[WorkflowRead]:
    with Session(engine) as session:
        workflows = session.exec(select(Workflow).order_by(desc(Workflow.updated_at))).all()
        return [_workflow_read(session, workflow) for workflow in workflows]


@router.post("/workflows", response_model=WorkflowRead)
def create_workflow(payload: WorkflowCreate) -> WorkflowRead:
    with Session(engine) as session:
        catalog = get_block_catalog(session)
        validation = validate_workflow(payload.definition, catalog)
        workflow = Workflow(name=payload.name, description=payload.description)
        version = WorkflowVersion(
            workflow_id=workflow.id,
            version=1,
            definition=payload.definition.model_dump(by_alias=True),
            layout=payload.layout.model_dump(),
            validation_result=validation.model_dump(by_alias=True),
        )
        session.add(workflow)
        session.add(version)
        session.flush()
        replace_workflow_graph_projection(session, version, payload.definition)
        session.commit()
        session.refresh(workflow)
        return _workflow_read(session, workflow)


@router.get("/workflows/{workflow_id}", response_model=WorkflowRead)
def get_workflow(workflow_id: UUID) -> WorkflowRead:
    with Session(engine) as session:
        workflow = session.get(Workflow, workflow_id)
        if not workflow:
            raise HTTPException(status_code=404, detail="Workflow not found")
        return _workflow_read(session, workflow)


@router.get("/workflows/{workflow_id}/graph", response_model=WorkflowGraphRead)
def get_workflow_graph(workflow_id: UUID) -> WorkflowGraphRead:
    with Session(engine) as session:
        workflow = session.get(Workflow, workflow_id)
        if not workflow:
            raise HTTPException(status_code=404, detail="Workflow not found")

        latest = _latest_version(session, workflow.id)
        if not latest:
            raise HTTPException(status_code=404, detail="Workflow version not found")
        ensure_workflow_graph_projection(session, latest, commit=True)

        nodes = session.exec(
            select(WorkflowVersionNode)
            .where(WorkflowVersionNode.workflow_version_id == latest.id)
            .order_by(WorkflowVersionNode.node_key)
        ).all()
        edges = session.exec(
            select(WorkflowVersionEdge)
            .where(WorkflowVersionEdge.workflow_version_id == latest.id)
            .order_by(WorkflowVersionEdge.edge_key)
        ).all()

        return WorkflowGraphRead.model_validate(
            {
                "workflowId": workflow.id,
                "versionId": latest.id,
                "version": latest.version,
                "nodes": [
                    {
                        "id": node.id,
                        "nodeKey": node.node_key,
                        "blockType": node.block_type_key,
                        "blockVersion": node.block_version,
                        "label": node.label,
                        "params": node.params,
                    }
                    for node in nodes
                ],
                "edges": [
                    {
                        "id": edge.id,
                        "edgeKey": edge.edge_key,
                        "source": edge.source_node_key,
                        "target": edge.target_node_key,
                        "sourceOutput": edge.source_output_key,
                    }
                    for edge in edges
                ],
            }
        )


@router.put("/workflows/{workflow_id}", response_model=WorkflowRead)
def update_workflow(workflow_id: UUID, payload: WorkflowUpdate) -> WorkflowRead:
    with Session(engine) as session:
        workflow = session.get(Workflow, workflow_id)
        if not workflow:
            raise HTTPException(status_code=404, detail="Workflow not found")

        latest = _latest_version(session, workflow.id)
        catalog = get_block_catalog(session)
        validation = validate_workflow(payload.definition, catalog)

        workflow.name = payload.name if payload.name is not None else workflow.name
        workflow.description = (
            payload.description if payload.description is not None else workflow.description
        )
        workflow.status = "draft"
        workflow.updated_at = utcnow()

        version = WorkflowVersion(
            workflow_id=workflow.id,
            version=(latest.version + 1 if latest else 1),
            definition=payload.definition.model_dump(by_alias=True),
            layout=payload.layout.model_dump(),
            validation_result=validation.model_dump(by_alias=True),
        )
        session.add(workflow)
        session.add(version)
        session.flush()
        replace_workflow_graph_projection(session, version, payload.definition)
        session.commit()
        session.refresh(workflow)
        return _workflow_read(session, workflow)


@router.post("/workflows/{workflow_id}/validate", response_model=ValidationResult)
def validate_saved_workflow(workflow_id: UUID, payload: WorkflowPayload | None = None) -> ValidationResult:
    with Session(engine) as session:
        workflow = session.get(Workflow, workflow_id)
        if not workflow:
            raise HTTPException(status_code=404, detail="Workflow not found")

        if payload is not None:
            return validate_workflow(payload.definition, get_block_catalog(session))

        latest = _latest_version(session, workflow.id)
        if not latest:
            raise HTTPException(status_code=404, detail="Workflow version not found")
        definition = WorkflowPayload(definition=latest.definition, layout=latest.layout).definition
        return validate_workflow(definition, get_block_catalog(session))


@router.post("/workflows/{workflow_id}/submit", response_model=SubmissionRead)
def submit_workflow(workflow_id: UUID, payload: WorkflowPayload) -> SubmissionRead:
    with Session(engine) as session:
        workflow = session.get(Workflow, workflow_id)
        if not workflow:
            raise HTTPException(status_code=404, detail="Workflow not found")

        catalog = get_block_catalog(session)
        validation = validate_workflow(payload.definition, catalog)
        if not validation.valid:
            raise HTTPException(
                status_code=422,
                detail=validation.model_dump(by_alias=True),
            )

        latest = _latest_version(session, workflow.id)
        if (
            not latest
            or latest.definition != payload.definition.model_dump(by_alias=True)
            or latest.layout != payload.layout.model_dump()
        ):
            latest = WorkflowVersion(
                workflow_id=workflow.id,
                version=(latest.version + 1 if latest else 1),
                definition=payload.definition.model_dump(by_alias=True),
                layout=payload.layout.model_dump(),
                validation_result=validation.model_dump(by_alias=True),
            )
            session.add(latest)
            session.flush()
            replace_workflow_graph_projection(session, latest, payload.definition)
        else:
            ensure_workflow_graph_projection(session, latest)

        workflow.status = "submitted"
        workflow.updated_at = utcnow()
        submission = WorkflowSubmission(
            workflow_id=workflow.id,
            version_id=latest.id,
            payload={
                "definition": payload.definition.model_dump(by_alias=True),
                "layout": payload.layout.model_dump(),
                "submittedBy": "poc-user",
            },
        )
        session.add(workflow)
        session.add(submission)
        session.commit()
        session.refresh(submission)
        return SubmissionRead.model_validate(
            {
                "id": submission.id,
                "workflowId": submission.workflow_id,
                "versionId": submission.version_id,
                "payload": submission.payload,
                "status": submission.status,
                "createdAt": submission.created_at,
            }
        )


@router.get("/workflows/{workflow_id}/submissions", response_model=list[SubmissionRead])
def list_submissions(workflow_id: UUID) -> list[SubmissionRead]:
    with Session(engine) as session:
        workflow = session.get(Workflow, workflow_id)
        if not workflow:
            raise HTTPException(status_code=404, detail="Workflow not found")

        submissions = session.exec(
            select(WorkflowSubmission)
            .where(WorkflowSubmission.workflow_id == workflow_id)
            .order_by(desc(WorkflowSubmission.created_at))
        ).all()
        return [
            SubmissionRead.model_validate(
                {
                    "id": submission.id,
                    "workflowId": submission.workflow_id,
                    "versionId": submission.version_id,
                    "payload": submission.payload,
                    "status": submission.status,
                    "createdAt": submission.created_at,
                }
            )
            for submission in submissions
        ]


def _latest_version(session: Session, workflow_id: UUID) -> WorkflowVersion | None:
    return session.exec(
        select(WorkflowVersion)
        .where(WorkflowVersion.workflow_id == workflow_id)
        .order_by(desc(WorkflowVersion.version))
    ).first()


def _workflow_read(session: Session, workflow: Workflow) -> WorkflowRead:
    latest = _latest_version(session, workflow.id)
    if not latest:
        raise HTTPException(status_code=404, detail="Workflow version not found")
    ensure_workflow_graph_projection(session, latest, commit=True)

    return WorkflowRead.model_validate(
        {
            "id": workflow.id,
            "name": workflow.name,
            "description": workflow.description,
            "status": workflow.status,
            "version": latest.version,
            "definition": latest.definition,
            "layout": latest.layout,
            "validationResult": latest.validation_result,
            "createdAt": workflow.created_at,
            "updatedAt": workflow.updated_at,
        }
    )
