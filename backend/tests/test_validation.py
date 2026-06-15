from app.services.demo import DEMO_DEFINITION
from app.services.validation import validate_workflow


def test_demo_workflow_is_valid() -> None:
    result = validate_workflow(DEMO_DEFINITION)

    assert result.valid is True
    assert result.errors == []


def test_invalid_select_param_is_rejected() -> None:
    definition = DEMO_DEFINITION.model_copy(deep=True)
    email_node = next(node for node in definition.nodes if node.id == "email")
    email_node.params["channel"] = "fax"

    result = validate_workflow(definition)

    assert result.valid is False
    assert "invalid_param_option" in _error_codes(result)


def test_invalid_number_param_is_rejected() -> None:
    definition = DEMO_DEFINITION.model_copy(deep=True)
    training_node = next(node for node in definition.nodes if node.id == "training")
    training_node.params["dueInDays"] = "seven"

    result = validate_workflow(definition)

    assert result.valid is False
    assert "invalid_param_type" in _error_codes(result)


def _error_codes(result) -> set[str]:
    return {error.code for error in result.errors}
