// Package E — profiles for the results-page picker, used when no real
// UserProfile has been handed off from the intake flow (e.g. testing this
// page standalone, or a first-time visit to /results).
//
// The 5 real files are Package A/B's canonical samples (data/tools/samples/)
// — read-only here, never edited (only Package A writes to data/).
//
// escalateDemoProfile below is NOT one of those 5: none of the 5 canonical
// samples exercises a targeted (per-item) "escalate" status — only the
// global unparseable-medications case, which wipes the whole recommendation
// set rather than showing an escalate card alongside other recommendations.
// Package E's done-when needs a real Recommended + Escalate + Not
// Needed/Already Covered all on one screen, so this is
// vegetarian-muscle-gain (a profile already known to produce recommended
// protein/creatine and a not_needed BCAA) plus a real, already-defined
// safety policy's trigger phrase (data/policy/safety/safety-epa-dha-
// anticoagulant.json matches "warfarin" in medicationsOrConditionsFlag.freeText)
// added to its medications field. This isn't invented recommendation
// behavior — it's a real safety policy already in data/, exercised by an
// input built to reach it.
import vegetarianMuscleGain from "@/data/tools/samples/vegetarian-muscle-gain.json";
import veganEndurance from "@/data/tools/samples/vegan-endurance.json";
import unparseableMedications from "@/data/tools/samples/unparseable-medications.json";
import sedentaryWellness from "@/data/tools/samples/sedentary-wellness.json";
import alreadyCovered from "@/data/tools/samples/already-covered.json";
import type { UserProfile } from "@/types/engine";

export interface DemoProfile {
  id: string;
  label: string;
  note: string;
  profile: UserProfile;
}

const asProfile = (x: unknown) => x as UserProfile & { _note?: string };

function fromSample(id: string, label: string, sample: unknown): DemoProfile {
  const p = asProfile(sample);
  const { _note, ...profile } = p;
  return { id, label, note: _note ?? "", profile: profile as UserProfile };
}

const escalateDemo: DemoProfile = (() => {
  const profile = asProfile(vegetarianMuscleGain);
  return {
    id: "escalate-demo",
    label: "Muscle gain, on a blood thinner (demo)",
    note:
      "Package E demo fixture, not one of Package A's 5 canonical samples. Same profile as " +
      "vegetarian-muscle-gain (protein + creatine recommended, BCAA not needed) but with " +
      "medications naming warfarin — triggers the real safety-epa-dha-anticoagulant policy, " +
      "so omega-3 escalates to 'talk to a doctor first' instead of being recommended.",
    profile: {
      ...(profile as UserProfile),
      medicationsOrConditionsFlag: {
        hasAny: true,
        freeText: "warfarin, for a blood clotting condition",
        parseConfidence: 1,
      },
    },
  };
})();

export const DEMO_PROFILES: DemoProfile[] = [
  fromSample("vegetarian-muscle-gain", "Vegetarian, muscle gain", vegetarianMuscleGain),
  escalateDemo,
  fromSample("vegan-endurance", "Vegan, endurance training", veganEndurance),
  fromSample("sedentary-wellness", "Sedentary, general wellness", sedentaryWellness),
  fromSample("already-covered", "Already takes protein + creatine", alreadyCovered),
  fromSample("unparseable-medications", "Unreadable medication list (global escalation)", unparseableMedications),
];
