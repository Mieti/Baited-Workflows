from collections import defaultdict
from copy import deepcopy
from typing import Any

from sqlmodel import Session, select

from app.models.workflow import (
    WorkflowBlockDefinition,
    WorkflowBlockOutput,
    WorkflowBlockOutputRule,
    WorkflowBlockParam,
    WorkflowBlockParamOption,
    utcnow,
)


STATIC_BLOCK_CATALOG: list[dict[str, Any]] = [
    {
        "type": "campaign_entrypoint",
        "category": "Entry",
        "label": "Campaign Start",
        "description": "Defines where the automation begins.",
        "icon": "play",
        "color": "emerald",
        "params": [
            {
                "name": "audience",
                "label": "Audience",
                "kind": "select",
                "required": True,
                "options": ["All targets", "Finance group", "Executive group", "Manual selection"],
            }
        ],
        "allowedBranches": ["success"],
    },
    {
        "type": "create_campaign",
        "category": "Campaign Actions",
        "label": "Create Campaign",
        "description": "Creates a phishing or awareness campaign draft.",
        "icon": "mail",
        "color": "sky",
        "params": [
            {"name": "campaignName", "label": "Campaign name", "kind": "text", "required": True},
            {
                "name": "channel",
                "label": "Channel",
                "kind": "select",
                "required": True,
                "options": ["email", "sms", "instant_message"],
            },
            {
                "name": "template",
                "label": "Template",
                "kind": "select",
                "required": True,
                "options": ["Invoice reminder", "Password reset", "HR policy update"],
            },
        ],
        "allowedBranches": ["success"],
    },
    {
        "type": "send_message",
        "category": "Campaign Actions",
        "label": "Send Message",
        "description": "Sends a follow-up message on a selected channel.",
        "icon": "message-square",
        "color": "violet",
        "params": [
            {
                "name": "channel",
                "label": "Channel",
                "kind": "select",
                "required": True,
                "options": ["sms", "instant_message", "email"],
            },
            {"name": "messageTemplate", "label": "Message template", "kind": "text", "required": True},
        ],
        "allowedBranches": ["success"],
    },
    {
        "type": "start_awareness_campaign",
        "category": "Campaign Actions",
        "label": "Start Awareness Campaign",
        "description": "Assigns training content to selected targets.",
        "icon": "graduation-cap",
        "color": "amber",
        "params": [
            {
                "name": "trainingLevel",
                "label": "Training level",
                "kind": "select",
                "required": True,
                "options": ["basic", "intermediate", "advanced"],
            },
            {"name": "dueInDays", "label": "Due in days", "kind": "number", "required": True},
        ],
        "allowedBranches": ["success"],
    },
    {
        "type": "add_target_to_group",
        "category": "Target Management",
        "label": "Add Target To Group",
        "description": "Moves matching targets into a risk or training group.",
        "icon": "users",
        "color": "rose",
        "params": [
            {
                "name": "groupId",
                "label": "Group",
                "kind": "select",
                "required": True,
                "options": ["high-risk", "medium-risk", "low-risk", "training-basic"],
            },
            {
                "name": "reason",
                "label": "Reason",
                "kind": "select",
                "required": True,
                "options": ["credentials_submitted", "link_clicked", "no_response", "manual_review"],
            },
        ],
        "allowedBranches": ["success"],
    },
    {
        "type": "start_osint_on_targets",
        "category": "Target Management",
        "label": "Start OSINT On Targets",
        "description": "Collects public information to prepare a scenario.",
        "icon": "search",
        "color": "cyan",
        "params": [
            {
                "name": "scanType",
                "label": "Scan type",
                "kind": "select",
                "required": True,
                "options": ["social", "company", "breach-exposure"],
            }
        ],
        "allowedBranches": ["success"],
    },
    {
        "type": "wait_for_event",
        "category": "Logic",
        "label": "Wait For Event",
        "description": "Waits for a target event within a time window.",
        "icon": "timer",
        "color": "zinc",
        "params": [
            {
                "name": "event",
                "label": "Event",
                "kind": "select",
                "required": True,
                "options": ["email_opened", "link_clicked", "credentials_submitted", "message_delivered"],
            },
            {"name": "window", "label": "Evaluation window", "kind": "text", "required": True},
        ],
        "allowedBranches": ["success", "timeout"],
    },
    {
        "type": "condition",
        "category": "Logic",
        "label": "Condition",
        "description": "Branches the workflow based on a previous event.",
        "icon": "split",
        "color": "lime",
        "params": [
            {
                "name": "condition",
                "label": "Condition",
                "kind": "select",
                "required": True,
                "options": ["email_opened", "link_clicked", "credentials_submitted"],
            },
        ],
        "branchRule": {
            "param": "condition",
            "branchesByValue": {
                "email_opened": ["opened", "not_opened"],
                "link_clicked": ["clicked", "not_clicked"],
                "credentials_submitted": ["credentials_submitted", "not_submitted"],
            },
        },
    },
    {
        "type": "mark_low_risk",
        "category": "End States",
        "label": "Mark Low Risk",
        "description": "Ends the path and marks the target as low risk.",
        "icon": "shield-check",
        "color": "emerald",
        "params": [],
        "allowedBranches": [],
        "terminal": True,
    },
    {
        "type": "mark_medium_risk",
        "category": "End States",
        "label": "Mark Medium Risk",
        "description": "Ends the path and marks the target as medium risk.",
        "icon": "shield-alert",
        "color": "amber",
        "params": [],
        "allowedBranches": [],
        "terminal": True,
    },
    {
        "type": "mark_high_risk",
        "category": "End States",
        "label": "Mark High Risk",
        "description": "Ends the path and marks the target as high risk.",
        "icon": "shield-x",
        "color": "rose",
        "params": [],
        "allowedBranches": [],
        "terminal": True,
    },
]

BLOCK_CATALOG = STATIC_BLOCK_CATALOG
BLOCKS_BY_TYPE = {block["type"]: block for block in STATIC_BLOCK_CATALOG}


def get_static_block_catalog() -> list[dict[str, Any]]:
    return deepcopy(STATIC_BLOCK_CATALOG)


def get_block_catalog(session: Session | None = None) -> list[dict[str, Any]]:
    if session is None:
        return get_static_block_catalog()

    definitions = _active_block_definitions(session)
    if not definitions:
        seed_block_catalog(session)
        definitions = _active_block_definitions(session)

    return [_serialize_block(session, definition) for definition in definitions]


def get_block_versions_by_type(session: Session) -> dict[str, int]:
    definitions = _active_block_definitions(session)
    if not definitions:
        seed_block_catalog(session)
        definitions = _active_block_definitions(session)

    return {definition.type_key: definition.version for definition in definitions}


def seed_block_catalog(session: Session) -> None:
    for index, block in enumerate(STATIC_BLOCK_CATALOG):
        definition = session.exec(
            select(WorkflowBlockDefinition).where(
                WorkflowBlockDefinition.type_key == block["type"],
                WorkflowBlockDefinition.version == block.get("version", 1),
            )
        ).first()

        if not definition:
            definition = WorkflowBlockDefinition(
                type_key=block["type"],
                version=block.get("version", 1),
                category=block["category"],
                label=block["label"],
                description=block.get("description", ""),
                icon=block.get("icon", "split"),
                color=block.get("color", "zinc"),
                sort_order=index,
                terminal=block.get("terminal", False),
            )
            session.add(definition)
            session.flush()
        else:
            definition.category = block["category"]
            definition.label = block["label"]
            definition.description = block.get("description", "")
            definition.icon = block.get("icon", "split")
            definition.color = block.get("color", "zinc")
            definition.sort_order = index
            definition.terminal = block.get("terminal", False)
            definition.active = True
            definition.updated_at = utcnow()

        _replace_block_children(session, definition)
        _seed_block_params(session, definition, block)
        _seed_block_outputs(session, definition, block)

    session.commit()


def _active_block_definitions(session: Session) -> list[WorkflowBlockDefinition]:
    return list(
        session.exec(
            select(WorkflowBlockDefinition)
            .where(WorkflowBlockDefinition.active == True)  # noqa: E712
            .order_by(
                WorkflowBlockDefinition.sort_order,
                WorkflowBlockDefinition.version,
            )
        ).all()
    )


def _replace_block_children(session: Session, definition: WorkflowBlockDefinition) -> None:
    params = session.exec(
        select(WorkflowBlockParam).where(
            WorkflowBlockParam.block_definition_id == definition.id
        )
    ).all()
    outputs = session.exec(
        select(WorkflowBlockOutput).where(
            WorkflowBlockOutput.block_definition_id == definition.id
        )
    ).all()
    rules = session.exec(
        select(WorkflowBlockOutputRule).where(
            WorkflowBlockOutputRule.block_definition_id == definition.id
        )
    ).all()

    for param in params:
        options = session.exec(
            select(WorkflowBlockParamOption).where(
                WorkflowBlockParamOption.param_id == param.id
            )
        ).all()
        for option in options:
            session.delete(option)
    session.flush()

    for rule in rules:
        session.delete(rule)
    session.flush()

    for output in outputs:
        session.delete(output)
    for param in params:
        session.delete(param)
    session.flush()


def _seed_block_params(
    session: Session,
    definition: WorkflowBlockDefinition,
    block: dict[str, Any],
) -> None:
    for index, param in enumerate(block.get("params", [])):
        db_param = WorkflowBlockParam(
            block_definition_id=definition.id,
            key=param["name"],
            label=param["label"],
            kind=param["kind"],
            required=param.get("required", False),
            sort_order=index,
        )
        session.add(db_param)
        session.flush()

        for option_index, option in enumerate(param.get("options", [])):
            session.add(
                WorkflowBlockParamOption(
                    param_id=db_param.id,
                    value=option,
                    label=option,
                    sort_order=option_index,
                )
            )


def _seed_block_outputs(
    session: Session,
    definition: WorkflowBlockDefinition,
    block: dict[str, Any],
) -> None:
    for index, output_key in enumerate(_output_keys_for_block(block)):
        session.add(
            WorkflowBlockOutput(
                block_definition_id=definition.id,
                key=output_key,
                label=output_key,
                sort_order=index,
            )
        )

    branch_rule = block.get("branchRule")
    if not branch_rule:
        return

    sort_order = 0
    for param_value, output_keys in branch_rule.get("branchesByValue", {}).items():
        for output_key in output_keys:
            session.add(
                WorkflowBlockOutputRule(
                    block_definition_id=definition.id,
                    param_key=branch_rule["param"],
                    param_value=param_value,
                    output_key=output_key,
                    sort_order=sort_order,
                )
            )
            sort_order += 1


def _output_keys_for_block(block: dict[str, Any]) -> list[str]:
    keys: list[str] = []
    for key in block.get("allowedBranches", []):
        if key not in keys:
            keys.append(key)

    branch_rule = block.get("branchRule")
    if branch_rule:
        for output_keys in branch_rule.get("branchesByValue", {}).values():
            for key in output_keys:
                if key not in keys:
                    keys.append(key)

    return keys


def _serialize_block(
    session: Session,
    definition: WorkflowBlockDefinition,
) -> dict[str, Any]:
    params = session.exec(
        select(WorkflowBlockParam)
        .where(WorkflowBlockParam.block_definition_id == definition.id)
        .order_by(WorkflowBlockParam.sort_order)
    ).all()
    outputs = session.exec(
        select(WorkflowBlockOutput)
        .where(WorkflowBlockOutput.block_definition_id == definition.id)
        .order_by(WorkflowBlockOutput.sort_order)
    ).all()
    rules = session.exec(
        select(WorkflowBlockOutputRule)
        .where(WorkflowBlockOutputRule.block_definition_id == definition.id)
        .order_by(WorkflowBlockOutputRule.sort_order)
    ).all()

    serialized = {
        "type": definition.type_key,
        "version": definition.version,
        "category": definition.category,
        "label": definition.label,
        "description": definition.description,
        "icon": definition.icon,
        "color": definition.color,
        "params": [_serialize_param(session, param) for param in params],
        "outputs": [{"key": output.key, "label": output.label} for output in outputs],
        "terminal": definition.terminal,
    }

    if rules:
        param_key = rules[0].param_key
        branches_by_value: dict[str, list[str]] = defaultdict(list)
        for rule in rules:
            branches_by_value[rule.param_value].append(rule.output_key)
        serialized["branchRule"] = {
            "param": param_key,
            "branchesByValue": dict(branches_by_value),
        }
    else:
        serialized["allowedBranches"] = [output.key for output in outputs]

    return serialized


def _serialize_param(session: Session, param: WorkflowBlockParam) -> dict[str, Any]:
    options = session.exec(
        select(WorkflowBlockParamOption)
        .where(WorkflowBlockParamOption.param_id == param.id)
        .order_by(WorkflowBlockParamOption.sort_order)
    ).all()

    serialized = {
        "name": param.key,
        "label": param.label,
        "kind": param.kind,
        "required": param.required,
    }
    if options:
        serialized["options"] = [option.value for option in options]

    return serialized
