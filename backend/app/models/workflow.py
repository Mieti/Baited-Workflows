from datetime import datetime, timezone
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import Boolean, Column, DateTime, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, SQLModel


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Workflow(SQLModel, table=True):
    __tablename__ = "workflows"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    name: str = Field(index=True, max_length=160)
    description: str = Field(default="", max_length=1000)
    status: str = Field(default="draft", index=True, max_length=32)
    created_at: datetime = Field(
        default_factory=utcnow,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
    updated_at: datetime = Field(
        default_factory=utcnow,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )


class WorkflowVersion(SQLModel, table=True):
    __tablename__ = "workflow_versions"
    __table_args__ = (
        UniqueConstraint("workflow_id", "version", name="uq_workflow_versions_workflow_version"),
    )

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    workflow_id: UUID = Field(foreign_key="workflows.id", index=True)
    version: int = Field(index=True)
    definition: dict[str, Any] = Field(sa_column=Column(JSONB, nullable=False))
    layout: dict[str, Any] = Field(sa_column=Column(JSONB, nullable=False))
    validation_result: dict[str, Any] = Field(
        default_factory=dict,
        sa_column=Column(JSONB, nullable=False),
    )
    created_at: datetime = Field(
        default_factory=utcnow,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )


class WorkflowBlockDefinition(SQLModel, table=True):
    __tablename__ = "workflow_block_definitions"
    __table_args__ = (
        UniqueConstraint("type_key", "version", name="uq_workflow_block_type_version"),
    )

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    type_key: str = Field(index=True, max_length=80)
    version: int = Field(default=1, index=True)
    category: str = Field(index=True, max_length=80)
    label: str = Field(max_length=120)
    description: str = Field(default="", max_length=500)
    icon: str = Field(default="split", max_length=60)
    color: str = Field(default="zinc", max_length=40)
    sort_order: int = Field(default=0, index=True)
    terminal: bool = Field(
        default=False,
        sa_column=Column(Boolean, nullable=False, default=False),
    )
    active: bool = Field(
        default=True,
        sa_column=Column(Boolean, nullable=False, default=True),
    )
    created_at: datetime = Field(
        default_factory=utcnow,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
    updated_at: datetime = Field(
        default_factory=utcnow,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )


class WorkflowBlockParam(SQLModel, table=True):
    __tablename__ = "workflow_block_params"
    __table_args__ = (
        UniqueConstraint("block_definition_id", "key", name="uq_workflow_block_param_key"),
    )

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    block_definition_id: UUID = Field(foreign_key="workflow_block_definitions.id", index=True)
    key: str = Field(max_length=80)
    label: str = Field(max_length=120)
    kind: str = Field(max_length=40)
    required: bool = Field(
        default=False,
        sa_column=Column(Boolean, nullable=False, default=False),
    )
    sort_order: int = Field(default=0, index=True)


class WorkflowBlockParamOption(SQLModel, table=True):
    __tablename__ = "workflow_block_param_options"
    __table_args__ = (
        UniqueConstraint("param_id", "value", name="uq_workflow_block_param_option_value"),
    )

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    param_id: UUID = Field(foreign_key="workflow_block_params.id", index=True)
    value: str = Field(max_length=160)
    label: str = Field(max_length=160)
    sort_order: int = Field(default=0, index=True)


class WorkflowBlockOutput(SQLModel, table=True):
    __tablename__ = "workflow_block_outputs"
    __table_args__ = (
        UniqueConstraint("block_definition_id", "key", name="uq_workflow_block_output_key"),
    )

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    block_definition_id: UUID = Field(foreign_key="workflow_block_definitions.id", index=True)
    key: str = Field(max_length=80)
    label: str = Field(max_length=120)
    sort_order: int = Field(default=0, index=True)


class WorkflowBlockOutputRule(SQLModel, table=True):
    __tablename__ = "workflow_block_output_rules"
    __table_args__ = (
        UniqueConstraint(
            "block_definition_id",
            "param_key",
            "param_value",
            "output_key",
            name="uq_workflow_block_output_rule",
        ),
    )

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    block_definition_id: UUID = Field(foreign_key="workflow_block_definitions.id", index=True)
    param_key: str = Field(max_length=80)
    param_value: str = Field(max_length=160)
    output_key: str = Field(max_length=80)
    sort_order: int = Field(default=0, index=True)


class WorkflowVersionNode(SQLModel, table=True):
    __tablename__ = "workflow_version_nodes"
    __table_args__ = (
        UniqueConstraint("workflow_version_id", "node_key", name="uq_workflow_version_node_key"),
    )

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    workflow_version_id: UUID = Field(foreign_key="workflow_versions.id", index=True)
    node_key: str = Field(max_length=160)
    block_type_key: str = Field(index=True, max_length=80)
    block_version: int = Field(default=1, index=True)
    label: str = Field(max_length=160)
    params: dict[str, Any] = Field(sa_column=Column(JSONB, nullable=False))


class WorkflowVersionEdge(SQLModel, table=True):
    __tablename__ = "workflow_version_edges"
    __table_args__ = (
        UniqueConstraint("workflow_version_id", "edge_key", name="uq_workflow_version_edge_key"),
    )

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    workflow_version_id: UUID = Field(foreign_key="workflow_versions.id", index=True)
    edge_key: str = Field(max_length=160)
    source_node_key: str = Field(index=True, max_length=160)
    target_node_key: str = Field(index=True, max_length=160)
    source_output_key: str = Field(index=True, max_length=80)


class WorkflowSubmission(SQLModel, table=True):
    __tablename__ = "workflow_submissions"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    workflow_id: UUID = Field(foreign_key="workflows.id", index=True)
    version_id: UUID = Field(foreign_key="workflow_versions.id", index=True)
    payload: dict[str, Any] = Field(sa_column=Column(JSONB, nullable=False))
    status: str = Field(default="mocked_success", index=True, max_length=32)
    created_at: datetime = Field(
        default_factory=utcnow,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
