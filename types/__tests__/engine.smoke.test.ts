// types/__tests__/engine.smoke.test.ts
//
// B0 deliverable check: confirms the published zod schemas in types/engine.ts
// actually accept the real data/ records they're supposed to describe, not
// just that the TypeScript types compile. Not a test of engine logic (that's
// Package B's job) — purely "does the contract match the data".

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  userProfileSchema,
  policySchema,
  compoundSchema,
  ingredientSchema,
  claimSchema,
  productSchema,
  pricingFeedSchema,
  predicateNodeSchema,
} from "@/types/engine";

const DATA_ROOT = join(__dirname, "..", "..", "data");
const readJson = (relPath: string) => JSON.parse(readFileSync(join(DATA_ROOT, relPath), "utf8"));
const readJsonDir = (relDir: string) =>
  readdirSync(join(DATA_ROOT, relDir))
    .filter((f) => f.endsWith(".json"))
    .map((f) => readJson(join(relDir, f)))
    .filter((r) => !r.DEPRECATED);

describe("types/engine.ts schemas vs real data/ records", () => {
  it("accepts every sample UserProfile", () => {
    for (const f of readdirSync(join(DATA_ROOT, "tools/samples"))) {
      const profile = readJson(join("tools/samples", f));
      const result = userProfileSchema.safeParse(profile);
      expect(result.success, `${f}: ${JSON.stringify(!result.success && result.error.issues)}`).toBe(
        true
      );
    }
  });

  it("accepts every eligibility, dosing and safety policy via the discriminated union", () => {
    for (const dir of ["policy/eligibility", "policy/dosing", "policy/safety"]) {
      for (const record of readJsonDir(dir)) {
        const result = policySchema.safeParse(record);
        expect(
          result.success,
          `${dir}/${record.id}: ${JSON.stringify(!result.success && result.error.issues)}`
        ).toBe(true);
      }
    }
  });

  it("accepts every compound, ingredient, claim, product and the pricing feed", () => {
    for (const c of readJson("entities/compounds.json").compounds) {
      expect(compoundSchema.safeParse(c).success, c.id).toBe(true);
    }
    for (const i of readJsonDir("ingredients")) {
      expect(ingredientSchema.safeParse(i).success, i.id).toBe(true);
    }
    for (const c of readJsonDir("claims")) {
      expect(claimSchema.safeParse(c).success, c.id).toBe(true);
    }
    for (const p of readJson("products/products.json").products) {
      expect(productSchema.safeParse(p).success, p.id).toBe(true);
    }
    const pricing = readJson("products/pricing.json");
    expect(pricingFeedSchema.safeParse(pricing).success).toBe(true);
  });

  it("round-trips a nested predicate AST (all/any/not/const alongside leaf ops)", () => {
    const node = {
      all: [
        { gte: { field: "exerciseFrequencyPerWeek", value: 2 }, label: "trains often enough" },
        {
          any: [
            { eq: { field: "dietaryPattern", value: "vegan" } },
            { not: { const: false } },
          ],
        },
      ],
    };
    expect(predicateNodeSchema.safeParse(node).success).toBe(true);
  });
});
