// lib/engine/__tests__/knowledge-base.manifest.test.ts
//
// knowledge-base.ts uses static ES imports instead of fs.readdirSync
// specifically so every data file the engine reads is visible to the
// bundler at build/deploy time (see that file's header comment). The
// tradeoff it accepts is that adding a new ingredient/claim/policy/product
// JSON file requires also adding an import line here -- easy to forget.
// This test is the safety net: it does its own fs.readdirSync of data/ and
// fails loudly if the on-disk count and the statically-imported
// MANIFEST_COUNTS count ever diverge, for any of the five categories.
//
// Ingredients is the one category with an intentional, permanent gap: two
// DEPRECATED stub files (omega-3-fish-oil.json, probiotics.json) were
// superseded during the v3 compound-tier migration and are deliberately
// excluded from the import list. Both are asserted by id below so a
// disappearing deprecation marker (i.e. someone "undeprecating" a file
// without updating knowledge-base.ts) is also caught, not just silently
// absorbed into a wrong-but-matching count.

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { MANIFEST_COUNTS, products } from "../knowledge-base";

const DATA_ROOT = path.resolve(__dirname, "../../../data");

function jsonFilesIn(dir: string): string[] {
  return fs
    .readdirSync(path.join(DATA_ROOT, dir))
    .filter((f) => f.endsWith(".json"));
}

function isDeprecated(dir: string, file: string): boolean {
  const content = JSON.parse(fs.readFileSync(path.join(DATA_ROOT, dir, file), "utf-8"));
  return content.DEPRECATED === true;
}

describe("knowledge-base manifest freshness (catches a data file added without a matching import)", () => {
  it("ingredients: 2 deprecated stubs on disk are excluded on purpose, everything else is imported", () => {
    const files = jsonFilesIn("ingredients");
    const deprecated = files.filter((f) => isDeprecated("ingredients", f));
    const live = files.filter((f) => !isDeprecated("ingredients", f));

    expect(deprecated.sort()).toEqual(["omega-3-fish-oil.json", "probiotics.json"]);
    expect(live).toHaveLength(MANIFEST_COUNTS.ingredients);
  });

  it("claims: every file on disk has a matching import", () => {
    expect(jsonFilesIn("claims")).toHaveLength(MANIFEST_COUNTS.claims);
  });

  it("eligibility policies: every file on disk has a matching import", () => {
    expect(jsonFilesIn("policy/eligibility")).toHaveLength(MANIFEST_COUNTS.eligibilityPolicies);
  });

  it("dosing policies: every file on disk has a matching import", () => {
    expect(jsonFilesIn("policy/dosing")).toHaveLength(MANIFEST_COUNTS.dosingPolicies);
  });

  it("safety policies: every file on disk has a matching import", () => {
    expect(jsonFilesIn("policy/safety")).toHaveLength(MANIFEST_COUNTS.safetyPolicies);
  });

  it("products: the single products.json array length matches what the engine loaded", () => {
    const productsFile = JSON.parse(fs.readFileSync(path.join(DATA_ROOT, "products/products.json"), "utf-8"));
    expect(products).toHaveLength(productsFile.products.length);
    expect(products).toHaveLength(MANIFEST_COUNTS.products);
  });
});
