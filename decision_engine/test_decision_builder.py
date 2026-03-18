"""
Smoke-tests for decision_builder.  Run with: python -m pytest decision_engine/
Or directly:                                  python decision_engine/test_decision_builder.py
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from decision_engine.decision_builder import (
    ProtoDecision,
    build_decisions,
    group_decisions_by_key,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

RULES = [
    # valid — min
    {
        "classification": "actionable_numeric",
        "property": "Épaisseur isolation",
        "operator": ">=",
        "value": "120",
        "unit": "mm",
        "element": "Mur extérieur",
        "domain": "thermique",
        "confidence_score": 0.92,
        "source_document_id": "doc-001",
    },
    # valid — max
    {
        "classification": "actionable_numeric",
        "property": "U-Value",
        "operator": "<=",
        "value": "0.24",
        "unit": "W/m²K",
        "element": None,
        "domain": "thermique",
        "confidence_score": 0.88,
        "source_document_id": "doc-001",
    },
    # valid — exact
    {
        "classification": "actionable_numeric",
        "property": "hauteur sous plafond",
        "operator": "=",
        "value": "2.5",
        "unit": "m",
        "element": "pièce habitable",
        "domain": "réglementation",
        "confidence_score": 0.95,
        "source_document_id": "doc-002",
    },
    # valid — range
    {
        "classification": "actionable_numeric",
        "property": "température ambiante",
        "operator": "range",
        "value": "19",
        "unit": "°C",
        "element": None,
        "domain": "confort",
        "confidence_score": 0.75,
        "source_document_id": "doc-003",
    },
    # filtered out — wrong classification
    {
        "classification": "informational",
        "property": "hauteur",
        "operator": ">=",
        "value": "2",
        "unit": "m",
        "element": None,
        "domain": "réglementation",
        "confidence_score": 0.5,
        "source_document_id": "doc-004",
    },
    # filtered out — no property
    {
        "classification": "actionable_numeric",
        "property": None,
        "operator": ">=",
        "value": "100",
        "unit": "mm",
        "element": None,
        "domain": "thermique",
        "confidence_score": 0.9,
        "source_document_id": "doc-005",
    },
    # filtered out — no value
    {
        "classification": "actionable_numeric",
        "property": "épaisseur",
        "operator": ">=",
        "value": None,
        "unit": "mm",
        "element": None,
        "domain": "thermique",
        "confidence_score": 0.9,
        "source_document_id": "doc-006",
    },
    # filtered out — unknown operator
    {
        "classification": "actionable_numeric",
        "property": "charge admissible",
        "operator": "~",
        "value": "500",
        "unit": "kg/m²",
        "element": "plancher",
        "domain": "structure",
        "confidence_score": 0.7,
        "source_document_id": "doc-007",
    },
    # duplicate key for grouping test
    {
        "classification": "actionable_numeric",
        "property": "Épaisseur isolation",
        "operator": "<=",
        "value": "200",
        "unit": "mm",
        "element": "Mur extérieur",
        "domain": "thermique",
        "confidence_score": 0.85,
        "source_document_id": "doc-001",
    },
]


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

def test_filter_count():
    decisions = build_decisions(RULES)
    assert len(decisions) == 5, f"Expected 5 decisions, got {len(decisions)}"


def test_normalization():
    decisions = build_decisions(RULES)
    for d in decisions:
        assert d.property == d.property.strip().lower()
        if d.unit:
            assert d.unit == d.unit.strip().lower()
        if d.element:
            assert d.element == d.element.strip().lower()


def test_rule_types():
    decisions = build_decisions(RULES)

    def first(prop: str, rule_type: str) -> bool:
        return any(d.property == prop and d.rule_type == rule_type for d in decisions)

    # Two isolation rules: one min, one max — both must be present
    assert first("épaisseur isolation", "min")
    assert first("épaisseur isolation", "max")
    assert first("u-value", "max")
    assert first("hauteur sous plafond", "exact")
    assert first("température ambiante", "range")


def test_interpretation_hints():
    decisions = build_decisions(RULES)
    hint_map = {d.rule_type: d.interpretation_hint for d in decisions}

    assert hint_map["min"] == "minimum requirement"
    assert hint_map["max"] == "maximum allowed"
    assert hint_map["exact"] == "target value"
    assert hint_map["range"] == "acceptable range"


def test_values_are_float():
    decisions = build_decisions(RULES)
    for d in decisions:
        assert isinstance(d.value, float)


def test_group_by_key():
    decisions = build_decisions(RULES)
    groups = group_decisions_by_key(decisions)

    # (mur extérieur, épaisseur isolation, mm) should have 2 entries (min + max)
    key = ("mur extérieur", "épaisseur isolation", "mm")
    assert key in groups
    assert len(groups[key]) == 2
    rule_types = {d.rule_type for d in groups[key]}
    assert rule_types == {"min", "max"}


def test_sorting():
    decisions = build_decisions(RULES)
    domains = [d.domain for d in decisions]
    assert domains == sorted(domains)


if __name__ == "__main__":
    tests = [
        test_filter_count,
        test_normalization,
        test_rule_types,
        test_interpretation_hints,
        test_values_are_float,
        test_group_by_key,
        test_sorting,
    ]
    passed = 0
    for t in tests:
        try:
            t()
            print(f"  PASS  {t.__name__}")
            passed += 1
        except AssertionError as e:
            print(f"  FAIL  {t.__name__}: {e}")

    print(f"\n{passed}/{len(tests)} tests passed")
