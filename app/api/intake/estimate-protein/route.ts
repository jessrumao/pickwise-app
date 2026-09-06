// Package D — a second, narrower instance of the same AI-normalization
// role app/api/intake/parse/route.ts already has: turn free text into the
// structured data the engine needs. Never used by default — the intake
// form always shows a slider first; this only runs when the user
// explicitly says they don't know their protein intake and describes what
// they eat instead.
//
// The LLM does NOT compute the protein number itself — stress-testing found
// it unreliable at that (e.g. it once put regular curd's protein at 3.5x
// its real value, and didn't reliably differentiate 50g vs 100g of chicken).
// Instead the LLM only *identifies* what was eaten and how much, in grams,
// matching each item against PROTEIN_DATABASE where it reasonably can;
// computeProteinFromItems() then does the actual multiplication against
// real per-100g values. Only genuinely unmatched foods (no reasonable
// database entry) fall back to the LLM's own estimate for that one item,
// and that fallback measurably lowers the returned confidence. The result
// still lands on the same adjustable slider either way — the user has the
// final say, exactly like the other AI-parsed fields (existingSupplementUse,
// allergies) still get shown back for confirmation when confidence is low.
import "@/lib/env";
import { generateObject } from "ai";
import { z } from "zod";
import { getModel } from "@/lib/ai/model-registry";
import { DEFAULT_VENDOR, DEFAULT_MODEL_ID } from "@/config";
import { dietaryPatternSchema } from "@/types/engine";
import { PROTEIN_DATABASE, PROTEIN_DATABASE_IDS } from "@/lib/intake/protein-database";
import { computeProteinFromItems } from "@/lib/intake/compute-protein-from-items";

const requestSchema = z.object({
  dietaryPattern: dietaryPatternSchema,
  bodyWeightKg: z.number(),
  heightCm: z.number(),
  foodDescription: z.string().min(1).max(500),
});

const foodItemSchema = z.object({
  description: z.string(),
  matchedDatabaseId: z.enum([...PROTEIN_DATABASE_IDS, "other"]),
  quantityGrams: z.number().min(0).max(2000),
  // Only meaningful when matchedDatabaseId is "other" — the item's own
  // total protein contribution in grams, since no real database value
  // exists to compute it from.
  selfEstimatedProteinG: z.number().min(0).max(150).optional(),
});

const extractionSchema = z.object({
  items: z.array(foodItemSchema).max(15),
  // How confidently the model could pin down actual QUANTITIES (not food
  // identity) from the description — reflects specificity of the input,
  // combined in code with how much of the total came from real database
  // values vs the model's own per-item guesses.
  quantityConfidence: z.number().min(0).max(1),
});

const databaseReferenceForPrompt = PROTEIN_DATABASE.map((f) => `${f.id}: ${f.label}`).join("\n");

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON in request body.", 400);
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Invalid request body.", 400);
  }
  const { dietaryPattern, bodyWeightKg, heightCm, foodDescription } = parsed.data;

  try {
    const { object } = await generateObject({
      model: getModel(DEFAULT_VENDOR, DEFAULT_MODEL_ID),
      schema: extractionSchema,
      // Low temperature: this is a structured extraction meant to be
      // reproducible for a given description, not a creative task.
      temperature: 0.2,
      system: [
        "You identify the individual foods in a short, informal description of what someone",
        "typically eats in a day, and estimate how much of each (in grams) they ate. You do NOT",
        "calculate protein yourself for any food that reasonably matches one of the reference",
        "foods below — a fixed lookup table converts grams to protein for those, using real",
        "nutrition data, because free-form estimates of protein content have been found",
        "unreliable. Your job is only correct food identification and a realistic gram quantity.",
        "",
        "Reference foods (id: description) — match each item in the description to the closest",
        "one if there's a reasonable match, even if the wording differs (e.g. 'roti' or 'chapati'",
        "both match 'roti'; 'chicken curry' matches 'chicken_curry', not 'chicken_breast', unless",
        "plain boneless breast is clearly meant):",
        databaseReferenceForPrompt,
        "",
        "If a food has no reasonable match above, set matchedDatabaseId to \"other\" and instead",
        "give your own best-guess total protein contribution (selfEstimatedProteinG) for that one",
        "item — bias this guess toward the low end of a plausible range, since it feeds a",
        "downstream calculation where overestimating dietary protein risks under-dosing a",
        "supplement recommendation.",
        "",
        "For quantityGrams: convert any stated unit (pieces, bowls, cups, ml, L, handfuls) into a",
        "realistic gram amount for an Indian-diet context — e.g. 1 roti ≈ 40g, 1 bowl dal ≈ 150g,",
        "1 glass milk ≈ 250ml ≈ 250g, 1 egg ≈ 50g. When an explicit quantity IS stated (grams,",
        "ml/L, or a count), convert it literally and exactly — never flatten a larger stated",
        "quantity toward a 'typical' portion. When no quantity is stated at all, use a modest,",
        "realistic single serving, not a large one, and not zero — every food actually named in",
        "the description was eaten in some real amount.",
        "",
        "Use body weight and height only as soft context for what portion size a person of that",
        "build might realistically eat when a quantity is otherwise unstated — never as a",
        "substitute for the food description itself.",
        "",
        "quantityConfidence (0-1) reflects how precisely you could pin down actual amounts from",
        "what was described — vague descriptions with no portion sizes should score LOW (below",
        "0.5); a description with explicit counts/weights for most items should score higher.",
        "Never return 1 — this is always an estimate from free text, not a measurement.",
      ].join("\n"),
      prompt: JSON.stringify({ dietaryPattern, bodyWeightKg, heightCm, foodDescription }),
    });

    const { estimatedDailyProteinG, matchedProteinFraction } = computeProteinFromItems(
      object.items.map((item) => ({
        matchedDatabaseId: item.matchedDatabaseId === "other" ? null : item.matchedDatabaseId,
        quantityGrams: item.quantityGrams,
        selfEstimatedProteinG: item.selfEstimatedProteinG,
      }))
    );

    // Confidence combines how well quantities were specified with how much
    // of the total rests on real database values vs the model's own guesses
    // for unmatched foods — a fluent-sounding estimate isn't more
    // trustworthy just because the food happened to be one we have no real
    // data for.
    const confidence = Math.round(object.quantityConfidence * matchedProteinFraction * 100) / 100;

    return Response.json({
      estimatedDailyProteinG: Math.min(estimatedDailyProteinG, 250),
      confidence,
    });
  } catch (error) {
    console.error("protein estimate failed:", error);
    return jsonError("Could not estimate from that description. Please try again.", 502);
  }
}
