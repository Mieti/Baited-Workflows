from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class WorkflowNode(BaseModel):
    id: str
    type: str
    label: str
    params: dict[str, Any] = Field(default_factory=dict)


class WorkflowEdge(BaseModel):
    id: str
    source: str
    target: str
    branch: str = "success"


class WorkflowDefinition(BaseModel):
    schema_version: int = Field(default=1, alias="schemaVersion")
    nodes: list[WorkflowNode] = Field(default_factory=list)
    edges: list[WorkflowEdge] = Field(default_factory=list)

    model_config = ConfigDict(populate_by_name=True)


class WorkflowLayout(BaseModel):
    nodes: dict[str, dict[str, float]] = Field(default_factory=dict)
    viewport: dict[str, float] = Field(default_factory=lambda: {"x": 0, "y": 0, "zoom": 1})


class WorkflowPayload(BaseModel):
    definition: WorkflowDefinition
    layout: WorkflowLayout


class ValidationIssue(BaseModel):
    code: str
    message: str
    node_id: str | None = Field(default=None, alias="nodeId")
    edge_id: str | None = Field(default=None, alias="edgeId")

    model_config = ConfigDict(populate_by_name=True)


class ValidationResult(BaseModel):
    valid: bool
    errors: list[ValidationIssue] = Field(default_factory=list)
    warnings: list[ValidationIssue] = Field(default_factory=list)


class WorkflowCreate(BaseModel):
    name: str = "Untitled workflow"
    description: str = ""
    definition: WorkflowDefinition
    layout: WorkflowLayout


class WorkflowUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    definition: WorkflowDefinition
    layout: WorkflowLayout


class WorkflowRead(BaseModel):
    id: UUID
    name: str
    description: str
    status: str
    version: int
    definition: dict[str, Any]
    layout: dict[str, Any]
    validation_result: dict[str, Any] = Field(alias="validationResult")
    created_at: datetime = Field(alias="createdAt")
    updated_at: datetime = Field(alias="updatedAt")

    model_config = ConfigDict(populate_by_name=True)


class SubmissionRead(BaseModel):
    id: UUID
    workflow_id: UUID = Field(alias="workflowId")
    version_id: UUID = Field(alias="versionId")
    payload: dict[str, Any]
    status: str
    created_at: datetime = Field(alias="createdAt")

    model_config = ConfigDict(populate_by_name=True)
