/**
 * Unit tests — Decision Builder + Decision Resolver
 * Run with: pnpm vitest run src/core/decision/decision.test.ts
 */

import { describe, it, expect } from "vitest";
import { buildDecisions, groupDecisionsByKey, type RuleRow } from "./decisionBuilder.js";
import { resolveDecisions } from "./decisionResolver.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const BASE: RuleRow = {
  classification: "actionable_numeric",
  property: "épaisseur isolation",
  operator: ">=",
  value: 120,
  unit: "mm",
  element: "Mur extérieur",
  domain: "thermique",
  confidence_score: 0.92,
  source_document_id: "doc-001",
};

function rule(overrides: Partial<RuleRow> = {}): RuleRow {
  return { ...BASE, ...overrides };
}

// ---------------------------------------------------------------------------
// Decision Builder
// ---------------------------------------------------------------------------

describe("buildDecisions", () => {
  it("filters out non-actionable_numeric rules", () => {
    const results = buildDecisions([
      rule({ classification: "informational" }),
      rule({ classification: "actionable_numeric" }),
    ]);
    expect(results).toHaveLength(1);
  });

  it("filters out rules with null property", () => {
    const results = buildDecisions([rule({ property: null })]);
    expect(results).toHaveLength(0);
  });

  it("filters out rules with null value", () => {
    const results = buildDecisions([rule({ value: null })]);
    expect(results).toHaveLength(0);
  });

  it("filters out rules with unknown operator", () => {
    const results = buildDecisions([rule({ operator: "~=" })]);
    expect(results).toHaveLength(0);
  });

  it("normalizes property to lowercase trimmed", () => {
    const [d] = buildDecisions([rule({ property: "  Épaisseur ISOLATION  " })]);
    expect(d.property).toBe("épaisseur isolation");
  });

  it("normalizes unit to lowercase", () => {
    const [d] = buildDecisions([rule({ unit: "MM" })]);
    expect(d.unit).toBe("mm");
  });

  it("normalizes element to lowercase", () => {
    const [d] = buildDecisions([rule({ element: "MUR EXTÉRIEUR" })]);
    expect(d.element).toBe("mur extérieur");
  });

  it("maps >= to min", () => {
    const [d] = buildDecisions([rule({ operator: ">=" })]);
    expect(d.ruleType).toBe("min");
  });

  it("maps > to min", () => {
    const [d] = buildDecisions([rule({ operator: ">" })]);
    expect(d.ruleType).toBe("min");
  });

  it("maps <= to max", () => {
    const [d] = buildDecisions([rule({ operator: "<=" })]);
    expect(d.ruleType).toBe("max");
  });

  it("maps < to max", () => {
    const [d] = buildDecisions([rule({ operator: "<" })]);
    expect(d.ruleType).toBe("max");
  });

  it("maps = to exact", () => {
    const [d] = buildDecisions([rule({ operator: "=" })]);
    expect(d.ruleType).toBe("exact");
  });

  it("maps range to range", () => {
    const [d] = buildDecisions([rule({ operator: "range" })]);
    expect(d.ruleType).toBe("range");
  });

  it("parses string values to float", () => {
    const [d] = buildDecisions([rule({ value: "120.5" })]);
    expect(d.value).toBe(120.5);
  });

  it("tone is always advisory", () => {
    const [d] = buildDecisions([rule()]);
    expect(d.tone).toBe("advisory");
  });

  it("sets correct interpretation hints", () => {
    const hints = buildDecisions([
      rule({ operator: ">=" }),
      rule({ operator: "<=" }),
      rule({ operator: "=" }),
      rule({ operator: "range" }),
    ]).map((d) => d.interpretationHint);

    expect(hints[0]).toBe("minimum expected value based on standard practices");
    expect(hints[1]).toBe("maximum recommended limit");
    expect(hints[2]).toBe("target value defined by standard");
    expect(hints[3]).toBe("acceptable value range");
  });

  it("uses source_document_id as ruleOrigin", () => {
    const [d] = buildDecisions([rule({ source_document_id: "doc-xyz" })]);
    expect(d.ruleOrigin).toBe("doc-xyz");
    expect(d.source).toBe("doc-xyz");
  });

  it("omits element when null", () => {
    const [d] = buildDecisions([rule({ element: null })]);
    expect(d.element).toBeUndefined();
  });

  it("omits unit when null", () => {
    const [d] = buildDecisions([rule({ unit: null })]);
    expect(d.unit).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Group by key
// ---------------------------------------------------------------------------

describe("groupDecisionsByKey", () => {
  it("groups decisions sharing element+property+unit into the same bucket", () => {
    const decisions = buildDecisions([
      rule({ operator: ">=" }),          // min
      rule({ operator: "<=" }),          // max — same key
      rule({ operator: "=", unit: "cm" }), // different unit → different key
    ]);
    const groups = groupDecisionsByKey(decisions);
    const keys = Object.keys(groups);
    expect(keys).toHaveLength(2);
  });

  it("key format is element|property|unit", () => {
    const [d] = buildDecisions([rule()]);
    const groups = groupDecisionsByKey([d]);
    const key = Object.keys(groups)[0];
    expect(key).toBe(`${d.element ?? ""}|${d.property}|${d.unit ?? ""}`);
  });
});

// ---------------------------------------------------------------------------
// Decision Resolver
// ---------------------------------------------------------------------------

describe("resolveDecisions", () => {
  it("picks highest min when multiple min rules exist", () => {
    const decisions = buildDecisions([
      rule({ operator: ">=", value: 80 }),
      rule({ operator: ">=", value: 120 }),
    ]);
    const [r] = resolveDecisions(groupDecisionsByKey(decisions));
    expect(r.min).toBe(120);
  });

  it("picks lowest max when multiple max rules exist", () => {
    const decisions = buildDecisions([
      rule({ operator: "<=", value: 200 }),
      rule({ operator: "<=", value: 150 }),
    ]);
    const [r] = resolveDecisions(groupDecisionsByKey(decisions));
    expect(r.max).toBe(150);
  });

  it("resolves unanimous exact without conflict", () => {
    const decisions = buildDecisions([
      rule({ operator: "=", value: 100 }),
      rule({ operator: "=", value: 100 }),
    ]);
    const [r] = resolveDecisions(groupDecisionsByKey(decisions));
    expect(r.exact).toBe(100);
    expect(r.conflict).toBeUndefined();
  });

  it("flags conflict when exact values diverge", () => {
    const decisions = buildDecisions([
      rule({ operator: "=", value: 100 }),
      rule({ operator: "=", value: 150 }),
    ]);
    const [r] = resolveDecisions(groupDecisionsByKey(decisions));
    expect(r.conflict).toBe(true);
    expect(r.conflictReason).toMatch(/conflicting exact/);
  });

  it("flags conflict when min > max", () => {
    const decisions = buildDecisions([
      rule({ operator: ">=", value: 200 }),
      rule({ operator: "<=", value: 100 }),
    ]);
    const [r] = resolveDecisions(groupDecisionsByKey(decisions));
    expect(r.conflict).toBe(true);
    expect(r.conflictReason).toMatch(/min.*exceeds.*max/);
  });

  it("averages confidence across inputs", () => {
    const decisions = buildDecisions([
      rule({ operator: ">=", confidence_score: 0.8 }),
      rule({ operator: "<=", confidence_score: 0.6 }),
    ]);
    const [r] = resolveDecisions(groupDecisionsByKey(decisions));
    expect(r.confidence).toBeCloseTo(0.7);
  });

  it("collects unique sources", () => {
    const decisions = buildDecisions([
      rule({ operator: ">=", source_document_id: "doc-001" }),
      rule({ operator: "<=", source_document_id: "doc-002" }),
      rule({ operator: "=",  source_document_id: "doc-001" }), // duplicate
    ]);
    const [r] = resolveDecisions(groupDecisionsByKey(decisions));
    expect(r.sources).toEqual(expect.arrayContaining(["doc-001", "doc-002"]));
    expect(r.sources).toHaveLength(2);
  });

  it("tone is always advisory", () => {
    const decisions = buildDecisions([rule()]);
    const [r] = resolveDecisions(groupDecisionsByKey(decisions));
    expect(r.tone).toBe("advisory");
  });

  it("produces one resolved decision per unique key", () => {
    const decisions = buildDecisions([
      rule({ operator: ">=", unit: "mm" }),
      rule({ operator: "<=", unit: "mm" }),            // same key
      rule({ operator: ">=", unit: "cm" }),            // different unit
      rule({ operator: ">=", element: "plancher" }),   // different element
    ]);
    const resolved = resolveDecisions(groupDecisionsByKey(decisions));
    expect(resolved).toHaveLength(3);
  });
});
