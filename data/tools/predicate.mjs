// Predicate AST evaluator with three-valued (Kleene) logic and an explanation trace.
// No eval, no dependencies. The trace it returns is what the user-facing
// "why am I seeing this" text is generated from -- so the explanation cannot
// drift away from the logic that actually fired.

export const T = 'true', F = 'false', U = 'unknown';

const and = (vs) => vs.includes(F) ? F : vs.includes(U) ? U : T;
const or  = (vs) => vs.includes(T) ? T : vs.includes(U) ? U : F;
const not = (v)  => v === T ? F : v === F ? T : U;
const b   = (x)  => (x ? T : F);

function getField(profile, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), profile);
}

const OPS = new Set(['eq','neq','lt','lte','gt','gte','in','contains_any','contains_all','contains_none','exists','matches']);

export function evaluate(node, profile, path = '$', trace = []) {
  if (!node || typeof node !== 'object') throw new Error(`Malformed predicate at ${path}`);
  const label = node.label;
  const push = (op, field, expected, actual, value) => {
    trace.push({ path, op, field, expected, actual, value, label });
    return value;
  };

  if ('all' in node)   return push('all',   null, null, null, and(node.all.map((c,i) => evaluate(c, profile, `${path}.all[${i}]`, trace))));
  if ('any' in node)   return push('any',   null, null, null, or (node.any.map((c,i) => evaluate(c, profile, `${path}.any[${i}]`, trace))));
  if ('not' in node)   return push('not',   null, null, null, not(evaluate(node.not, profile, `${path}.not`, trace)));
  if ('const' in node) return push('const', null, node.const, null, b(node.const));

  const op = Object.keys(node).find(k => OPS.has(k));
  if (!op) throw new Error(`No known operator at ${path}: ${JSON.stringify(node)}`);
  const arg = node[op];
  const actual = getField(profile, arg.field);

  // The fail-closed hinge: a missing or null field is UNKNOWN, never false.
  // Each policy then declares what unknown means for it via onUnknown.
  if (op !== 'exists' && (actual === undefined || actual === null)) {
    return push(op, arg.field, arg.value ?? arg.values ?? arg.patterns, actual, U);
  }

  const arr = Array.isArray(actual) ? actual : null;
  const lc  = (s) => String(s).toLowerCase();
  let v;
  switch (op) {
    case 'exists':        v = b(actual !== undefined && actual !== null); break;
    case 'eq':            v = b(actual === arg.value); break;
    case 'neq':           v = b(actual !== arg.value); break;
    case 'lt':            v = b(Number(actual) <  arg.value); break;
    case 'lte':           v = b(Number(actual) <= arg.value); break;
    case 'gt':            v = b(Number(actual) >  arg.value); break;
    case 'gte':           v = b(Number(actual) >= arg.value); break;
    case 'in':            v = b(arg.values.includes(actual)); break;
    case 'contains_any':  v = arr ? b(arr.some(x => arg.values.includes(x))) : U; break;
    case 'contains_all':  v = arr ? b(arg.values.every(x => arr.includes(x))) : U; break;
    case 'contains_none': v = arr ? b(!arr.some(x => arg.values.includes(x))) : U; break;
    case 'matches':       v = b(arg.patterns.some(p => lc(actual).includes(lc(p)))); break;
  }
  return push(op, arg.field, arg.value ?? arg.values ?? arg.patterns, actual, v);
}

export function run(node, profile) {
  const trace = [];
  const value = evaluate(node, profile, '$', trace);
  return { value, trace };
}

// Decisive clauses: for a rule that PASSED, the leaf clauses that were true;
// for one that FAILED, the leaf clauses that were false or unknown. These are
// the ones worth showing a user.
export function decisive(result) {
  const leaves = result.trace.filter(t => !['all','any','not'].includes(t.op) && t.label);
  return result.value === T ? leaves.filter(t => t.value === T)
                            : leaves.filter(t => t.value !== T);
}

export function explain(result) {
  const parts = decisive(result).map(t => t.label);
  if (!parts.length) return result.value === T ? 'all conditions met' : 'conditions not met';
  // A failed rule's decisive clauses are the ones that did NOT hold, so their
  // affirmative labels must be framed as unmet requirements -- otherwise the
  // explanation reads as if the reason it was rejected is the reason it applies.
  return result.value === T ? parts.join('; ') : 'would need: ' + parts.join('; ');
}

// Nearest-half rounding, with the settled fallback for products that cannot be split.
export function servingPlan({ gapAmount, amountPerServing, splittable, minEffectiveDose }) {
  const raw = gapAmount / amountPerServing;
  const inc = splittable ? 0.5 : 1;
  let servings = Math.round(raw / inc) * inc;
  const delivered = () => servings * amountPerServing;
  let flooredUp = false;
  if (minEffectiveDose != null && delivered() < minEffectiveDose) {
    servings = Math.ceil(minEffectiveDose / amountPerServing / inc) * inc;
    flooredUp = true;   // rounding down would have gone below the useful dose
  }
  return { raw: +raw.toFixed(3), increment: inc, servings, delivered: +delivered().toFixed(1), flooredUpToMinEffective: flooredUp };
}
