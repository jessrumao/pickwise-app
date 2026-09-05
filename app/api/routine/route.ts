// Package G — routine text generation. The ONLY place in this product an
// LLM writes free text (see lib/routine/build-routine-prompt.ts for why
// that's safe): everything else here — the recommendation, the dose, the
// safety decision — was already decided by the rules engine before this
// route is ever called. This route only phrases a schedule, fenced by the
// dosing policy's own declared timing constraint.
//
// Non-streaming on purpose: the output is one short paragraph attached to a
// recommendation card, not a chat turn — a single generateObject call (the
// same pattern app/api/intake/parse/route.ts already uses for a similarly
// small, one-shot LLM assist) is simpler than wiring streaming for text
// this short, with no real UX loss.
import "@/lib/env";
import { generateObject } from "ai";
import { z } from "zod";
import { getModel } from "@/lib/ai/model-registry";
import { DEFAULT_VENDOR, DEFAULT_MODEL_ID } from "@/config";
import { dosingTimingSchema } from "@/types/engine";
import { buildRoutinePrompt } from "@/lib/routine/build-routine-prompt";

const requestSchema = z.object({
  compoundName: z.string().min(1),
  timing: dosingTimingSchema,
  servingPlan: z
    .object({
      servings: z.number(),
      delivered: z.number(),
      unit: z.string(),
    })
    .optional(),
  scheduleContext: z
    .object({
      exerciseFrequencyPerWeek: z.number().optional(),
      sleepHoursTypical: z.number().optional(),
    })
    .optional(),
});

const resultSchema = z.object({ routineText: z.string() });

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

  const { system, prompt } = buildRoutinePrompt(parsed.data);

  try {
    const { object } = await generateObject({
      model: getModel(DEFAULT_VENDOR, DEFAULT_MODEL_ID),
      schema: resultSchema,
      system,
      prompt,
    });
    return Response.json(object);
  } catch (error) {
    console.error("routine generation failed:", error);
    return jsonError("Could not generate a routine for this item. Please try again.", 502);
  }
}
