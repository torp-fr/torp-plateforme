"""
Decision Builder — first module of the TORP Decision Engine.

Converts extracted rules into normalized "proto-decisions" ready for
downstream insight generation.  No LLMs, no external dependencies.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple


# ---------------------------------------------------------------------------
# Domain types
# ---------------------------------------------------------------------------

RuleRow = Dict[str, Any]  # raw row from the rules table


@dataclass(frozen=True)
class ProtoDecision:
    element: Optional[str]
    domain: str
    property: str
    rule_type: str           # "min" | "max" | "exact" | "range"
    value: float
    unit: Optional[str]
    confidence: float
    source: str
    interpretation_hint: str


GroupKey = Tuple[Optional[str], str, Optional[str]]  # (element, property, unit)


# ---------------------------------------------------------------------------
# Filtering
# ---------------------------------------------------------------------------

def _is_actionable(rule: RuleRow) -> bool:
    """Keep only actionable numeric rules with a property and a value."""
    return (
        rule.get("classification") == "actionable_numeric"
        and rule.get("property") is not None
        and rule.get("value") is not None
    )


# ---------------------------------------------------------------------------
# Normalization helpers
# ---------------------------------------------------------------------------

def _normalize_str(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    return value.strip().lower()


def _parse_value(raw: Any) -> Optional[float]:
    try:
        return float(raw)
    except (TypeError, ValueError):
        return None


# ---------------------------------------------------------------------------
# Operator → rule_type mapping
# ---------------------------------------------------------------------------

_OPERATOR_MAP: Dict[str, str] = {
    ">=": "min",
    ">":  "min",
    "<=": "max",
    "<":  "max",
    "=":  "exact",
    "==": "exact",
    "range": "range",
}


def _map_operator(operator: Optional[str]) -> Optional[str]:
    if operator is None:
        return None
    return _OPERATOR_MAP.get(operator.strip())


# ---------------------------------------------------------------------------
# Interpretation hint
# ---------------------------------------------------------------------------

_HINT_MAP: Dict[str, str] = {
    "min":   "minimum requirement",
    "max":   "maximum allowed",
    "exact": "target value",
    "range": "acceptable range",
}


def _interpretation_hint(rule_type: str) -> str:
    return _HINT_MAP.get(rule_type, "advisory value")


# ---------------------------------------------------------------------------
# Single-rule conversion
# ---------------------------------------------------------------------------

def _build_decision(rule: RuleRow) -> Optional[ProtoDecision]:
    """Convert one raw rule row into a ProtoDecision.  Returns None on error."""

    rule_type = _map_operator(rule.get("operator"))
    if rule_type is None:
        return None

    value = _parse_value(rule.get("value"))
    if value is None:
        return None

    prop = _normalize_str(rule.get("property"))
    if not prop:
        return None

    domain = _normalize_str(rule.get("domain")) or "unknown"
    source = str(rule.get("source_document_id") or "")

    try:
        confidence = float(rule.get("confidence_score") or 0.0)
    except (TypeError, ValueError):
        confidence = 0.0

    return ProtoDecision(
        element=_normalize_str(rule.get("element")),
        domain=domain,
        property=prop,
        rule_type=rule_type,
        value=value,
        unit=_normalize_str(rule.get("unit")),
        confidence=confidence,
        source=source,
        interpretation_hint=_interpretation_hint(rule_type),
    )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def build_decisions(rules: List[RuleRow]) -> List[ProtoDecision]:
    """
    Filter, normalize, and convert a list of rule rows into ProtoDecisions.

    Args:
        rules: Raw rule rows from the database (dicts).

    Returns:
        Sorted list of ProtoDecisions (by domain, element, property).
    """
    decisions: List[ProtoDecision] = []

    for rule in rules:
        if not _is_actionable(rule):
            continue
        decision = _build_decision(rule)
        if decision is not None:
            decisions.append(decision)

    decisions.sort(key=lambda d: (d.domain, d.element or "", d.property))
    return decisions


def group_decisions_by_key(
    decisions: List[ProtoDecision],
) -> Dict[GroupKey, List[ProtoDecision]]:
    """
    Group proto-decisions by (element, property, unit).

    Useful for detecting multiple rules covering the same measurable
    attribute — e.g. competing min/max bounds on the same property.

    Args:
        decisions: Output of build_decisions().

    Returns:
        Dict mapping (element, property, unit) → [ProtoDecision, ...].
    """
    groups: Dict[GroupKey, List[ProtoDecision]] = {}
    for d in decisions:
        key: GroupKey = (d.element, d.property, d.unit)
        groups.setdefault(key, []).append(d)
    return groups
