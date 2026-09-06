// UI-only reference data to help someone ballpark the "protein from food"
// slider — never read by the engine, never validated against anything.
// Indian-diet-relevant since the rest of the product (pricing, marketplace
// links) already assumes an Indian user. Figures are typical/rounded, not
// lab-verified per-brand values — good enough for a rough estimate, not a
// nutrition database.
export interface ProteinFoodReference {
  food: string;
  proteinPer100g: number;
  typicalServing: string;
}

export const PROTEIN_FOOD_REFERENCE: ProteinFoodReference[] = [
  { food: "Chicken breast (cooked)", proteinPer100g: 31, typicalServing: "1 palm-sized piece (~100g) ≈ 31g" },
  { food: "Fish (rohu/salmon, cooked)", proteinPer100g: 22, typicalServing: "1 medium piece (~120g) ≈ 26g" },
  { food: "Eggs", proteinPer100g: 13, typicalServing: "1 egg (~50g) ≈ 6-7g" },
  { food: "Paneer", proteinPer100g: 18, typicalServing: "1 cup cubed (~100g) ≈ 18g" },
  { food: "Tofu", proteinPer100g: 8, typicalServing: "1 cup cubed (~150g) ≈ 12g" },
  { food: "Dal / lentils (cooked)", proteinPer100g: 9, typicalServing: "1 bowl (~150g) ≈ 13-14g" },
  { food: "Chickpeas / rajma (cooked)", proteinPer100g: 8, typicalServing: "1 bowl (~150g) ≈ 12g" },
  { food: "Greek yogurt / hung curd", proteinPer100g: 10, typicalServing: "1 cup (~200g) ≈ 20g" },
  { food: "Regular curd/yogurt", proteinPer100g: 4, typicalServing: "1 cup (~200g) ≈ 8g" },
  { food: "Milk", proteinPer100g: 3.4, typicalServing: "1 glass (~250ml) ≈ 8.5g" },
  { food: "Roti / chapati", proteinPer100g: 8, typicalServing: "1 piece (~40g) ≈ 3g" },
  { food: "Rice (cooked)", proteinPer100g: 2.7, typicalServing: "1 bowl (~150g) ≈ 4g" },
  { food: "Almonds / peanuts", proteinPer100g: 21, typicalServing: "1 small handful (~30g) ≈ 6g" },
];
