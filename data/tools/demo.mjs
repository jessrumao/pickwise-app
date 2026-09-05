// Runs the deterministic stages that exist today -- safety gate, eligibility,
// candidate-ingredient substitution, serving plan -- against every sample profile.
// Stages 4/5 (requirement + gap), 11 (ledger) and 12 (budget) are WORK PACKAGE B.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { run, explain, servingPlan, T, U } from './predicate.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const J = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));
const load = (p) => readdirSync(join(ROOT, p)).filter(f => f.endsWith('.json'))
  .map(f => J(`${p}/${f}`)).filter(r => !r.DEPRECATED);

const compounds = J('entities/compounds.json').compounds;
const ingredients = load('ingredients');
const claims = load('claims');
const eligibility = load('policy/eligibility');
const dosing = load('policy/dosing');
const safety = load('policy/safety');
const products = J('products/products.json').products;
const pricing = J('products/pricing.json').entries;

const claimById = Object.fromEntries(claims.map(c => [c.id, c]));
const GRADE_RANK = { Strong: 3, Moderate: 2, Limited: 1, Insufficient: 0 };
const priceOf = (pid) => pricing.find(e => e.productId === pid)?.priceINR;

function deliversCompound(ing, compoundId) {
  const grp = compounds.find(c => c.id === compoundId);
  return (ing.delivers ?? []).some(d =>
    d.compoundId === compoundId || (grp?.members ?? []).includes(d.compoundId));
}

for (const file of readdirSync(join(ROOT, 'tools/samples')).sort()) {
  const profile = J(`tools/samples/${file}`);
  console.log('\n' + '='.repeat(78));
  console.log(file.replace('.json', '').toUpperCase());
  console.log(profile._note);
  console.log('='.repeat(78));

  // --- STEP 6: SAFETY GATE, before eligibility, failing closed on unknown
  const escalations = [];
  for (const s of safety) {
    const r = run(s.trigger, profile);
    if (r.value === T || (r.value === U && s.onUnknown === 'true')) {
      escalations.push({ id: s.id, global: !!s.appliesTo.all, reason: explain(r), unknown: r.value === U });
    }
  }
  const global = escalations.filter(e => e.global);
  if (global.length) {
    console.log(`\n  ESCALATE (global) -> ${global.map(e => e.id).join(', ')}`);
    global.forEach(e => console.log(`    because: ${e.reason}${e.unknown ? '   [fired on UNKNOWN -- fail-closed]' : ''}`));
    console.log('    no automated recommendation is produced for this profile.');
    continue;
  }
  const blockedCompounds = new Set(escalations.flatMap(e =>
    safety.find(s => s.id === e.id).appliesTo.compoundIds ?? []));
  const blockedIngredients = new Set(escalations.flatMap(e =>
    safety.find(s => s.id === e.id).appliesTo.ingredientIds ?? []));
  if (escalations.length) console.log(`\n  targeted escalations: ${escalations.map(e => e.id).join(', ')}`);

  // --- STEP 7: ELIGIBILITY
  console.log('');
  for (const p of eligibility) {
    const rec = run(p.recommendWhen, profile);
    const sup = p.suppressWhen ? run(p.suppressWhen, profile) : { value: 'false', trace: [] };
    const grade = Math.max(...p.citesClaims.map(id => GRADE_RANK[claimById[id]?.grade] ?? 0));
    const label = p.compoundId ?? p.ingredientId;

    let status, why;
    if (blockedCompounds.has(p.compoundId) || blockedIngredients.has(p.ingredientId)) {
      status = 'ESCALATE'; why = 'safety rule matched for this item';
    } else if (sup.value === T) {
      status = p.suppressOutcome === 'already_covered' ? 'ALREADY COVERED' : 'NOT NEEDED';
      why = explain(sup);
    } else if (rec.value === T) {
      status = grade >= 2 ? 'RECOMMENDED' : 'POTENTIALLY USEFUL';
      why = explain(rec);
    } else {
      status = 'not shown'; why = explain(rec);
    }

    if (status === 'not shown' && !p.showWhenSuppressed) continue;
    console.log(`  ${status.padEnd(17)} ${label.padEnd(22)} ${why}`);

    // --- STEP 9: candidate ingredients -- substitution by dietary pattern
    if (['RECOMMENDED', 'POTENTIALLY USEFUL'].includes(status) && p.compoundId) {
      const cands = ingredients.filter(i =>
        deliversCompound(i, p.compoundId) && i.suitableFor.includes(profile.dietaryPattern));
      if (cands.length) console.log(`  ${''.padEnd(17)} via ${cands.map(c => c.id).join(' | ')}  (diet: ${profile.dietaryPattern})`);

      // --- STEP 13: serving plan for the protein case, where a numeric gap exists
      const dp = dosing.find(d => d.compoundId === p.compoundId);
      if (dp?.basis === 'per_kg_bodyweight' && profile.estimatedDailyProteinG != null) {
        const target = +(dp.target.target * profile.bodyWeightKg).toFixed(0);
        const gap = target - profile.estimatedDailyProteinG;
        const sku = products.filter(pr => cands.some(c => c.id === pr.ingredientId))[0];
        if (sku && gap > 0) {
          const per = sku.deliversPerServing.find(d => d.compoundId === p.compoundId);
          const plan = servingPlan({ gapAmount: gap, amountPerServing: per.amount,
            splittable: sku.splittable, minEffectiveDose: dp.minEffectiveDose?.amount });
          console.log(`  ${''.padEnd(17)} target ${target} g/day - ${profile.estimatedDailyProteinG} g food = ${gap} g gap`);
          console.log(`  ${''.padEnd(17)} ${sku.productName} @ ${per.amount} ${per.unit}/serving -> ${plan.raw} -> ${plan.servings} servings (${plan.delivered} g), timing: ${dp.timing.constraint}, Rs ${priceOf(sku.id)}`);
        }
      }
    }
  }
}
console.log('');
