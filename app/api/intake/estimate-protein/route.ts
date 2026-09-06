// Package D — a second, narrower instance of the same AI-normalization
// role app/api/intake/parse/route.ts already has: turn free text into the
// structured number the engine needs. Never used by default — the intake
// form always shows a slider first; this only runs when the user
// explicitly says they don't know their protein intake and describes what
// they eat instead. The AI estimates a number, it never decides a
// recommendation, and the result still lands on the same adjustable slider
// so the user has the final say, exactly like the other AI-parsed fields
// (existingSupplementUse, allergies) still get shown back for confirmation
// when confidence is low.
import "@/lib/env";
import { generateObject } from "ai";
import { z } from "zod";
import { getModel } from "@/lib/ai/model-registry";
import { DEFAULT_VENDOR, DEFAULT_MODEL_ID } from "@/config";
import { dietaryPatternSchema } from "@/types/engine";

const requestSchema = z.object({
  dietaryPattern: dietaryPatternSchema,
  bodyWeightKg: z.number(),
  heightCm: z.number(),
  foodDescription: z.string().min(1).max(500),
});

const resultSchema = z.object({
  estimatedDailyProteinG: z.number().min(0).max(250),
  confidence: z.number().min(0).max(1),
});

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
      schema: resultSchema,
      system: [
        "You estimate a person's total daily dietary protein intake in grams from a short,",
        "informal description of what they typically eat. This is a rough ballpark for a",
        "supplement-dosing calculation, not a nutrition analysis — use general knowledge of",
        "protein content in common foods (accounting for the stated diet pattern) to make a",
        "reasonable estimate. Use body weight and height only as context for typical portion",
        "sizes a person of that build would realistically eat — never estimate protein from",
        "body weight/height alone; the food description is what actually drives the number.",
        "",
        "confidence (0-1) reflects how much you can trust this estimate given what was",
        "described — a short or vague description (e.g. just one or two foods, or no portion",
        "sizes) should get LOW confidence (below 0.6); a fuller day's description with several",
        "meals should get higher confidence. Never return confidence 1 — this is always a",
        "rough estimate from free text, not a measurement.",
        "",
        "Return only the number and your confidence — no explanation, no recommendation.",
      ].join("\n"),
      prompt: JSON.stringify({ dietaryPattern, bodyWeightKg, heightCm, foodDescription }),
    });
    return Response.json(object);
  } catch (error) {
    console.error("protein estimate failed:", error);
    return jsonError("Could not estimate from that description. Please try again.", 502);
  }
}
