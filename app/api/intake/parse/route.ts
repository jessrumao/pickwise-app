// Package D — AI's ONLY role in the intake flow: normalize the three
// free-text answers (Q8 current supplements, Q11 allergies, Q13
// medications/conditions) into the structured fields lib/engine reads, with
// a confidence per field. It does not decide anything and never sees
// recommendation logic — see tasks/D-profile-intake-ui.md.
import "@/lib/env";
import { generateObject } from "ai";
import { z } from "zod";
import { getUtilityModel, utilityProviderOptions } from "@/lib/ai/model-registry";
import compoundsData from "@/data/entities/compounds.json";

const requestSchema = z.object({
  existingSupplementUseText: z.string().max(2000).default(""),
  allergiesText: z.string().max(2000).default(""),
  medicationsHasAny: z.boolean().default(false),
  medicationsFreeText: z.string().max(2000).default(""),
});

const parseResultSchema = z.object({
  existingSupplementUse: z.array(z.string()),
  existingSupplementUseConfidence: z.number().min(0).max(1),
  allergies: z.array(z.string()),
  allergiesConfidence: z.number().min(0).max(1),
  medicationsParseConfidence: z.number().min(0).max(1),
});

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

// Known compound ids + aliases, so the model maps "whey protein" to
// "protein-complete" instead of inventing an id that isn't in the KB.
const compoundAliasIndex = (compoundsData as { compounds: { id: string; aliases?: string[] }[] })
  .compounds.map((c) => `${c.id}: ${(c.aliases ?? []).join(", ")}`)
  .join("\n");

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON in request body.", 400);
  }

  const parsedRequest = requestSchema.safeParse(body);
  if (!parsedRequest.success) {
    return jsonError("Invalid request body.", 400);
  }
  const { existingSupplementUseText, allergiesText, medicationsHasAny, medicationsFreeText } =
    parsedRequest.data;

  // Nothing to parse — short-circuit rather than spend an LLM call.
  if (!existingSupplementUseText.trim() && !allergiesText.trim() && !medicationsHasAny) {
    return Response.json({
      existingSupplementUse: [],
      existingSupplementUseConfidence: 1,
      allergies: [],
      allergiesConfidence: 1,
      medicationsParseConfidence: 1,
    });
  }

  try {
    const { object } = await generateObject({
      model: getUtilityModel(),
      schema: parseResultSchema,
      providerOptions: utilityProviderOptions(),
      system:
        "You normalize free-text answers from a supplement-intake questionnaire into " +
        "structured fields. You do not give advice or make recommendations. For " +
        "existingSupplementUse, map each mentioned supplement to one id from this known " +
        "compound list when it clearly matches an alias; if a mentioned item doesn't match " +
        "any known compound, keep it as lowercase free text instead of inventing an id. " +
        "Known compounds (id: aliases):\n" +
        compoundAliasIndex +
        "\n\nFor allergies, return a short lowercase list (e.g. 'lactose', 'shellfish'). " +
        "Confidence fields are your own confidence (0-1) that you understood and correctly " +
        "structured that field's free text — 1 for clear/simple text, lower for vague, " +
        "contradictory, or hard-to-parse text. If a text field is empty, return an empty " +
        "array and confidence 1.",
      prompt: JSON.stringify({
        existingSupplementUseText,
        allergiesText,
        medicationsHasAny,
        medicationsFreeText,
      }),
    });
    return Response.json(object);
  } catch (error) {
    console.error("intake parse failed:", error);
    return jsonError("Could not process that input. Please try again.", 502);
  }
}
