// Real per-100g protein values for common Indian-diet foods, used to GROUND
// the /api/intake/estimate-protein endpoint's arithmetic in actual nutrition
// data rather than trusting an LLM's memorized (and sometimes badly wrong —
// e.g. it once put regular curd at 3.5x its real protein content) figures.
// The LLM's job is only to identify what was eaten and how much, in grams;
// this table does the multiplication. Server-side only — never shown in the
// UI (see docs/status/ai-protein-estimate-status.md's 2026-09-06 update for
// why the old UI-facing reference table was removed).
//
// Values are rounded, typical figures for the cooked/prepared form implied
// by the id (e.g. "dal" = cooked lentils, not dry) — good enough for a rough
// supplement-dosing estimate, not a lab-verified nutrition database.
export interface ProteinDatabaseEntry {
  id: string;
  label: string;
  proteinPer100g: number;
}

export const PROTEIN_DATABASE: ProteinDatabaseEntry[] = [
  { id: "roti", label: "Roti / chapati", proteinPer100g: 8 },
  { id: "rice", label: "Rice (cooked)", proteinPer100g: 2.7 },
  { id: "dal", label: "Dal / lentils (cooked)", proteinPer100g: 9 },
  { id: "paneer", label: "Paneer", proteinPer100g: 18 },
  { id: "curd_regular", label: "Regular curd / yogurt", proteinPer100g: 3.5 },
  { id: "curd_greek", label: "Greek yogurt / hung curd", proteinPer100g: 10 },
  { id: "milk", label: "Milk (dairy)", proteinPer100g: 3.4 },
  { id: "buttermilk", label: "Buttermilk / chaas", proteinPer100g: 1.5 },
  { id: "egg", label: "Egg (whole, cooked)", proteinPer100g: 13 },
  { id: "chicken_breast", label: "Chicken breast (cooked, plain)", proteinPer100g: 31 },
  { id: "chicken_curry", label: "Chicken curry (mixed cuts, with gravy)", proteinPer100g: 20 },
  { id: "fish", label: "Fish, cooked (rohu/salmon-type)", proteinPer100g: 22 },
  { id: "chickpeas", label: "Chickpeas / chana (cooked)", proteinPer100g: 8 },
  { id: "rajma", label: "Rajma / kidney beans (cooked)", proteinPer100g: 7.5 },
  { id: "chole", label: "Chole (chickpea curry)", proteinPer100g: 8 },
  { id: "sprouts", label: "Sprouts (moong, raw/cooked)", proteinPer100g: 7 },
  { id: "tofu", label: "Tofu", proteinPer100g: 8 },
  { id: "soy_chunks", label: "Soy chunks / nutrela (dry weight, before soaking)", proteinPer100g: 52 },
  { id: "idli", label: "Idli", proteinPer100g: 5 },
  { id: "dosa", label: "Dosa (plain)", proteinPer100g: 5 },
  { id: "poha", label: "Poha", proteinPer100g: 2.5 },
  { id: "upma", label: "Upma", proteinPer100g: 3 },
  { id: "sambar", label: "Sambar", proteinPer100g: 2.5 },
  { id: "oats", label: "Oats (cooked)", proteinPer100g: 2.5 },
  { id: "bread_white", label: "White bread / toast", proteinPer100g: 8 },
  { id: "peanuts", label: "Peanuts / groundnuts", proteinPer100g: 25 },
  { id: "almonds", label: "Almonds", proteinPer100g: 21 },
  { id: "whey_protein_powder", label: "Whey protein powder (per scoop, dry)", proteinPer100g: 80 },
  { id: "vegetables_generic", label: "Mixed vegetables, cooked (generic sabzi)", proteinPer100g: 1.5 },
  { id: "fruit_generic", label: "Fruit (generic)", proteinPer100g: 0.5 },
];

export const PROTEIN_DATABASE_IDS = PROTEIN_DATABASE.map((f) => f.id) as [string, ...string[]];

export const PROTEIN_DATABASE_BY_ID = new Map(PROTEIN_DATABASE.map((f) => [f.id, f]));
