// lib/engine/predicate.ts
//
// TypeScript port of data/tools/predicate.mjs's evaluator. Three-valued
// (Kleene) logic: TRUE / FALSE / UNKNOWN. A node whose referenced field is
// absent or null evaluates to UNKNOWN and propagates. Each policy declares
// what UNKNOWN means for IT via onUnknown — this module only computes the
// value and the trace; deciding what to do with onUnknown is the caller's job
// (safety.ts, eligibility.ts), exactly as in the reference implementation.
//
// Kept behaviourally identical to predicate.mjs on purpose: same trace shape,
// same decisive()/explain() semantics, so the LLM explanation layer (out of
// scope here) can be built directly on this without translation.

import type { PredicateNode, TraceEntry, EvaluationResult, TriState, FieldPath } from "@/types/engine";
import { TRUE, FALSE, UNKNOWN } from "@/types/engine";

function and(vs: TriState[]): TriState {
  if (vs.includes(FALSE)) return FALSE;
  if (vs.includes(UNKNOWN)) return UNKNOWN;
  return TRUE;
}
function or(vs: TriState[]): TriState {
  if (vs.includes(TRUE)) return TRUE;
  if (vs.includes(UNKNOWN)) return UNKNOWN;
  return FALSE;
}
function not(v: TriState): TriState {
  if (v === TRUE) return FALSE;
  if (v === FALSE) return TRUE;
  return UNKNOWN;
}
function b(x: boolean): TriState {
  return x ? TRUE : FALSE;
}

function getField(profile: unknown, path: FieldPath): unknown {
  return path.split(".").reduce<unknown>((o, k) => {
    if (o == null || typeof o !== "object") return undefined;
    return (o as Record<string, unknown>)[k];
  }, profile);
}

export function evaluate(
  node: PredicateNode,
  profile: unknown,
  path = "$",
  trace: TraceEntry[] = []
): TriState {
  const label = node.label;
  const push = (
    op: TraceEntry["op"],
    field: FieldPath | null,
    expected: unknown,
    actual: unknown,
    value: TriState
  ): TriState => {
    trace.push({ path, op, field, expected, actual, value, label });
    return value;
  };

  if ("all" in node) {
    return push(
      "all",
      null,
      null,
      null,
      and(node.all.map((c, i) => evaluate(c, profile, `${path}.all[${i}]`, trace)))
    );
  }
  if ("any" in node) {
    return push(
      "any",
      null,
      null,
      null,
      or(node.any.map((c, i) => evaluate(c, profile, `${path}.any[${i}]`, trace)))
    );
  }
  if ("not" in node) {
    return push("not", null, null, null, not(evaluate(node.not, profile, `${path}.not`, trace)));
  }
  if ("const" in node) {
    return push("const", null, node.const, null, b(node.const));
  }

  // Exactly one of the leaf operator keys is present (enforced by
  // PredicateNode's discriminated-union type, not re-checked here).
  if ("exists" in node) {
    const actual = getField(profile, node.exists.field);
    return push("exists", node.exists.field, null, actual, b(actual !== undefined && actual !== null));
  }

  const [op, arg] = (() => {
    if ("eq" in node) return ["eq", node.eq] as const;
    if ("neq" in node) return ["neq", node.neq] as const;
    if ("lt" in node) return ["lt", node.lt] as const;
    if ("lte" in node) return ["lte", node.lte] as const;
    if ("gt" in node) return ["gt", node.gt] as const;
    if ("gte" in node) return ["gte", node.gte] as const;
    if ("in" in node) return ["in", node.in] as const;
    if ("contains_any" in node) return ["contains_any", node.contains_any] as const;
    if ("contains_all" in node) return ["contains_all", node.contains_all] as const;
    if ("contains_none" in node) return ["contains_none", node.contains_none] as const;
    if ("matches" in node) return ["matches", node.matches] as const;
    throw new Error(`No known operator at ${path}: ${JSON.stringify(node)}`);
  })();

  const field = arg.field;
  const actual = getField(profile, field);
  const expected =
    "value" in arg ? arg.value : "values" in arg ? arg.values : "patterns" in arg ? arg.patterns : null;

  // The fail-closed hinge: a missing or null field is UNKNOWN, never false.
  if (actual === undefined || actual === null) {
    return push(op, field, expected, actual, UNKNOWN);
  }

  const arr = Array.isArray(actual) ? (actual as unknown[]) : null;
  const lc = (s: unknown) => String(s).toLowerCase();
  let v: TriState;

  switch (op) {
    case "eq":
      v = b(actual === arg.value);
      break;
    case "neq":
      v = b(actual !== arg.value);
      break;
    case "lt":
      v = b(Number(actual) < arg.value);
      break;
    case "lte":
      v = b(Number(actual) <= arg.value);
      break;
    case "gt":
      v = b(Number(actual) > arg.value);
      break;
    case "gte":
      v = b(Number(actual) >= arg.value);
      break;
    case "in":
      v = b(arg.values.includes(actual as never));
      break;
    case "contains_any":
      v = arr ? b(arr.some((x) => arg.values.includes(x as never))) : UNKNOWN;
      break;
    case "contains_all":
      v = arr ? b(arg.values.every((x) => arr.includes(x as never))) : UNKNOWN;
      break;
    case "contains_none":
      v = arr ? b(!arr.some((x) => arg.values.includes(x as never))) : UNKNOWN;
      break;
    case "matches":
      v = b(arg.patterns.some((p) => lc(actual).includes(lc(p))));
      break;
  }
  return push(op, field, expected, actual, v);
}

export function run(node: PredicateNode, profile: unknown): EvaluationResult {
  const trace: TraceEntry[] = [];
  const value = evaluate(node, profile, "$", trace);
  return { value, trace };
}

/**
 * Decisive clauses: for a rule that PASSED, the leaf clauses that were true;
 * for one that FAILED, the leaf clauses that were false or unknown. These
 * are the ones worth showing a user (or handing to the LLM to phrase).
 */
export function decisive(result: EvaluationResult): TraceEntry[] {
  const leaves = result.trace.filter((t) => !["all", "any", "not"].includes(t.op) && t.label);
  return result.value === TRUE ? leaves.filter((t) => t.value === TRUE) : leaves.filter((t) => t.value !== TRUE);
}

export function explain(result: EvaluationResult): string {
  const parts = decisive(result).map((t) => t.label as string);
  if (!parts.length) return result.value === TRUE ? "all conditions met" : "conditions not met";
  // A failed rule's decisive clauses are the ones that did NOT hold, so
  // their affirmative labels must be framed as unmet requirements.
  return result.value === TRUE ? parts.join("; ") : "would need: " + parts.join("; ");
}
