// Referential-integrity and policy checks for the git-as-database knowledge base.
// Run in CI on every pull request: `node tools/validate.mjs`
// Exits non-zero on error. This is what makes versioned JSON safe to treat as a database.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const J = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));
const dir = (p) => existsSync(join(ROOT, p)) ? readdirSync(join(ROOT, p)).filter(f => f.endsWith('.json')) : [];
const load = (p) => dir(p).map(f => ({ file: `${p}/${f}`, ...J(`${p}/${f}`) })).filter(r => !r.DEPRECATED);

const errors = [], warnings = [];
const err  = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

const compounds   = J('entities/compounds.json').compounds;
const outcomes    = J('entities/outcomes.json').outcomes;
const goals       = J('entities/goals.json').goals;
const reference   = J('reference/nutrient-requirements.json');
const ingredients = load('ingredients');
const claims      = load('claims');
const eligibility = load('policy/eligibility');
const dosing      = load('policy/dosing');
const safety      = load('policy/safety');
const products    = J('products/products.json').products;
const pricing     = J('products/pricing.json');
const profileSchema = J('schema/user-profile.schema.json');

const cId = new Set(compounds.map(c => c.id));
const oId = new Set(outcomes.map(o => o.id));
const iId = new Set(ingredients.map(i => i.id));
const clId = new Set(claims.map(c => c.id));
const pId = new Set(products.map(p => p.id));

// ---- 1. compound groups resolve
for (const c of compounds)
  for (const m of c.members ?? [])
    if (!cId.has(m)) err(`compound ${c.id}: group member "${m}" is not a compound`);

// ---- 2. goals map onto the profile enum and onto real outcomes
const goalEnum = new Set(profileSchema.properties.primaryGoals.items.enum);
for (const g of goals) {
  if (!goalEnum.has(g.id)) err(`goals.json: "${g.id}" is not in the profile primaryGoals enum`);
  for (const o of g.outcomes) if (!oId.has(o.outcomeId)) err(`goal ${g.id}: unknown outcome "${o.outcomeId}"`);
}
for (const e of goalEnum) if (!goals.some(g => g.id === e)) err(`primaryGoals enum value "${e}" has no row in goals.json`);

// ---- 3. ingredients deliver real compounds
for (const i of ingredients)
  for (const d of i.delivers ?? [])
    if (!cId.has(d.compoundId)) err(`ingredient ${i.id}: unknown compound "${d.compoundId}"`);

// ---- 4. claims point at real subjects and outcomes
for (const c of claims) {
  const set = c.subject.type === 'compound' ? cId : iId;
  if (!set.has(c.subject.id)) err(`claim ${c.id}: unknown ${c.subject.type} "${c.subject.id}"`);
  if (!oId.has(c.outcomeId))  err(`claim ${c.id}: unknown outcome "${c.outcomeId}"`);
  if (!(c.citations?.length))  err(`claim ${c.id}: has no citations`);
}

// ---- 5. reference table
for (const u of reference.upperLimits ?? [])
  if (!cId.has(u.compoundId)) err(`nutrient-requirements upperLimit: unknown compound "${u.compoundId}"`);
for (const r of reference.requirements ?? [])
  if (!cId.has(r.compoundId)) err(`nutrient-requirements requirement: unknown compound "${r.compoundId}"`);

// ---- 6. every predicate field path exists on the profile
function schemaPaths(schema, prefix = '') {
  const out = new Set();
  for (const [k, v] of Object.entries(schema.properties ?? {})) {
    const p = prefix ? `${prefix}.${k}` : k;
    out.add(p);
    if (v.type === 'object' || v.properties) for (const s of schemaPaths(v, p)) out.add(s);
  }
  return out;
}
const validPaths = schemaPaths(profileSchema);
const LOGICAL = new Set(['all','any','not']);
function walk(node, fn) {
  if (!node || typeof node !== 'object') return;
  if ('all' in node) return node.all.forEach(n => walk(n, fn));
  if ('any' in node) return node.any.forEach(n => walk(n, fn));
  if ('not' in node) return walk(node.not, fn);
  for (const [op, arg] of Object.entries(node)) {
    if (op === 'label' || op === 'const' || LOGICAL.has(op)) continue;
    if (arg && typeof arg === 'object' && 'field' in arg) fn(arg.field, op);
  }
}
const checkPredicate = (node, where) => walk(node, (field) => {
  if (!validPaths.has(field)) err(`${where}: predicate references "${field}", which is not a field on UserProfile`);
});

// ---- 7. THE COMMERCIAL FIREWALL, machine-enforced.
// Price must never reach the decision. Eligibility and dosing may not read budget.
const FORBIDDEN_IN_DECISION = ['monthlyBudgetINR', 'budgetIsHardConstraint'];
const checkFirewall = (node, where) => walk(node, (field) => {
  if (FORBIDDEN_IN_DECISION.includes(field))
    err(`COMMERCIAL FIREWALL VIOLATION -- ${where} reads "${field}". Budget may only be read by the allocator, which runs after the recommendation set is fixed. See data-layer-decisions-v2.md.`);
});

// ---- 8. policies
for (const p of eligibility) {
  checkPredicate(p.recommendWhen, p.file); checkFirewall(p.recommendWhen, p.file);
  if (p.suppressWhen) { checkPredicate(p.suppressWhen, p.file); checkFirewall(p.suppressWhen, p.file); }
  if (!(p.citesClaims?.length)) err(`${p.file}: eligibility policy cites no claim -- that makes it an opinion, not a policy`);
  for (const c of p.citesClaims ?? []) if (!clId.has(c)) err(`${p.file}: unknown claim "${c}"`);
  if (p.compoundId && !cId.has(p.compoundId))   err(`${p.file}: unknown compound "${p.compoundId}"`);
  if (p.ingredientId && !iId.has(p.ingredientId)) err(`${p.file}: unknown ingredient "${p.ingredientId}"`);
  if (p.onUnknown !== 'false') err(`${p.file}: eligibility must set onUnknown:"false" (fail closed to not recommending)`);
  // grade laundering guard
  const grades = (p.citesClaims ?? []).map(id => claims.find(c => c.id === id)?.grade);
  if (grades.includes('Strong') && grades.includes('Limited'))
    warn(`${p.file}: cites both a Strong and a Limited claim. Confirm the Strong one really describes THIS dose and population -- otherwise the derived grade is laundered.`);
}
for (const d of dosing) {
  checkPredicate(d.appliesWhen, d.file); checkFirewall(d.appliesWhen, d.file);
  if (!cId.has(d.compoundId) && !iId.has(d.compoundId)) err(`${d.file}: unknown compound "${d.compoundId}"`);
  for (const c of d.citesClaims ?? []) if (!clId.has(c)) err(`${d.file}: unknown claim "${c}"`);
  for (const s of d.timing?.separateFromCompoundIds ?? []) if (!cId.has(s)) err(`${d.file}: separateFrom unknown compound "${s}"`);
  if (d.rounding?.mode !== 'nearest') err(`${d.file}: rounding mode must be "nearest" (settled decision)`);
  if (d.rounding && d.rounding.fallbackIncrementIfNotSplittable == null)
    err(`${d.file}: rounding must declare fallbackIncrementIfNotSplittable, or non-splittable products get half-serving prescriptions`);
}
for (const s of safety) {
  checkPredicate(s.trigger, s.file);
  if (s.onUnknown !== 'true') err(`${s.file}: safety must set onUnknown:"true" (fail closed to escalating)`);
  if (s.action !== 'escalate') err(`${s.file}: MVP supports action "escalate" only`);
  for (const c of s.appliesTo?.compoundIds ?? []) if (!cId.has(c)) err(`${s.file}: unknown compound "${c}"`);
  for (const i of s.appliesTo?.ingredientIds ?? []) if (!iId.has(i)) err(`${s.file}: unknown ingredient "${i}"`);
}

// ---- 9. every ingredient with a policy, and every policy with an ingredient
for (const i of ingredients) {
  const covered = eligibility.some(p => p.ingredientId === i.id ||
    (p.compoundId && (i.delivers ?? []).some(d => d.compoundId === p.compoundId ||
      (compounds.find(c => c.id === p.compoundId)?.members ?? []).includes(d.compoundId))));
  if (!covered) warn(`ingredient ${i.id}: no eligibility policy resolves to it -- it can never be recommended`);
}

// ---- 10. products
for (const p of products) {
  if (!iId.has(p.ingredientId)) { err(`product ${p.id}: unknown ingredient "${p.ingredientId}"`); continue; }
  const ing = ingredients.find(i => i.id === p.ingredientId);
  const declared = new Set((ing.delivers ?? []).map(d => d.compoundId));
  for (const d of p.deliversPerServing) {
    if (!cId.has(d.compoundId)) { err(`product ${p.id}: unknown compound "${d.compoundId}"`); continue; }
    const grp = compounds.find(c => c.id === d.compoundId);
    const viaGroup = (grp?.members ?? []).some(m => declared.has(m)) ||
                     compounds.some(c => c.members?.includes(d.compoundId) && declared.has(c.id));
    if (!declared.has(d.compoundId) && !viaGroup)
      err(`product ${p.id}: delivers "${d.compoundId}" which ingredient ${ing.id} does not declare`);
    if (grp?.strainSpecific && !d.strain)
      err(`product ${p.id}: compound "${d.compoundId}" is strain-specific but the product declares no strain`);
  }
  if (typeof p.splittable !== 'boolean') err(`product ${p.id}: splittable must be set -- the rounding rule depends on it`);
  if (!pricing.entries.some(e => e.productId === p.id)) err(`product ${p.id}: no pricing entry`);
}
for (const e of pricing.entries) if (!pId.has(e.productId)) err(`pricing: unknown product "${e.productId}"`);

// ---- 11. reporting
const unverified = pricing.entries.filter(e => !e.urlVerified);
const unreviewed = [...claims, ...eligibility, ...dosing, ...safety, ...ingredients]
  .filter(r => r.review?.status !== 'expert_reviewed');

console.log(`\nknowledge base: ${compounds.length} compounds  ${ingredients.length} ingredients  ${claims.length} claims  ${eligibility.length + dosing.length + safety.length} policies  ${products.length} products`);
console.log(`expert sign-off: ${unreviewed.length} of ${unreviewed.length} records still draft_needs_expert_review`);
console.log(`marketplace links: ${unverified.length} of ${pricing.entries.length} unverified${unverified.length ? ' -> ' + unverified.map(e => e.productId).join(', ') : ''}`);

if (warnings.length) { console.log(`\n${warnings.length} warning(s):`); warnings.forEach(w => console.log('  ! ' + w)); }
if (errors.length)   { console.log(`\n${errors.length} ERROR(S):`);     errors.forEach(e => console.log('  x ' + e)); }
else console.log('\nreferential integrity: OK');
process.exit(errors.length ? 1 : 0);
