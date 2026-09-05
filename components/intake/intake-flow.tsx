"use client";

import * as React from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  assembleUserProfile,
  fieldsNeedingConfirmation,
  type ParsedFreeText,
} from "@/lib/intake/assemble-profile";
import { intakeFormSchema, STEP_FIELDS, TOTAL_STEPS, type IntakeFormValues } from "@/lib/intake/schema";
import { parseFreeText, submitProfile } from "@/lib/intake/submit-profile";
import { saveProfileForResults } from "@/lib/results/session-handoff";
import type { UserProfile } from "@/types/engine";

const PRIMARY_GOAL_OPTIONS: { value: IntakeFormValues["primaryGoals"][number]; label: string }[] = [
  { value: "muscle_gain", label: "Muscle gain" },
  { value: "strength_performance", label: "Strength / performance" },
  { value: "weight_loss", label: "Weight loss" },
  { value: "general_fitness", label: "General fitness" },
  { value: "general_wellness", label: "General wellness" },
  { value: "energy_fatigue", label: "Energy / fatigue" },
  { value: "digestive_health", label: "Digestive health" },
  { value: "immunity", label: "Immunity" },
  { value: "sleep_quality", label: "Sleep quality" },
  { value: "joint_health", label: "Joint health" },
  { value: "skin_hair_nails", label: "Skin / hair / nails" },
  { value: "endurance_performance", label: "Endurance performance" },
];

const EXERCISE_TYPE_OPTIONS: { value: NonNullable<IntakeFormValues["exerciseType"]>[number]; label: string }[] = [
  { value: "resistance_training", label: "Resistance training" },
  { value: "cardio_endurance", label: "Cardio & endurance" },
  { value: "mixed", label: "Mixed" },
  { value: "yoga_mobility", label: "Yoga & mobility" },
  { value: "sport_specific", label: "Sport-specific" },
  { value: "none", label: "None" },
];

const DEFAULT_VALUES: IntakeFormValues = {
  age: 30,
  sex: "prefer_not_to_say",
  isPregnantOrBreastfeeding: undefined,
  bodyWeightKg: 70,
  heightCm: undefined,
  dietaryPattern: "omnivore",
  exerciseFrequencyPerWeek: 3,
  exerciseType: [],
  primaryGoals: [],
  monthlyBudgetINR: undefined,
  budgetIsHardConstraint: true,
  sleepHoursTypical: 7,
  existingSupplementUseText: "",
  dietaryProteinAdequacy: "unsure",
  estimatedDailyProteinG: undefined,
  dietaryOilyFishServingsPerWeek: undefined,
  allergiesText: "",
  relevantHealthContext: "",
  medicationsHasAny: false,
  medicationsFreeText: "",
};

type SubmitState =
  | { status: "idle" }
  | { status: "parsing" }
  | { status: "needs-confirmation"; profile: UserProfile; fields: string[] }
  | { status: "submitting"; profile: UserProfile }
  | { status: "done"; profile: UserProfile; profileVersionId: string }
  | { status: "error"; message: string };

export function IntakeFlow() {
  const [step, setStep] = React.useState(0);
  const [submitState, setSubmitState] = React.useState<SubmitState>({ status: "idle" });

  const form = useForm<IntakeFormValues>({
    resolver: zodResolver(intakeFormSchema),
    defaultValues: DEFAULT_VALUES,
    mode: "onSubmit",
  });

  const sex = form.watch("sex");
  const dietaryProteinAdequacy = form.watch("dietaryProteinAdequacy");
  const medicationsHasAny = form.watch("medicationsHasAny");

  const isReviewStep = step === TOTAL_STEPS - 1;

  async function goNext() {
    const fields = STEP_FIELDS[step];
    if (fields.length > 0) {
      const valid = await form.trigger(fields);
      if (!valid) return;
    }
    setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  }

  function goBack() {
    setSubmitState({ status: "idle" });
    setStep((s) => Math.max(s - 1, 0));
  }

  async function runParseAndReview() {
    setSubmitState({ status: "parsing" });
    const values = form.getValues();
    try {
      const parsed: ParsedFreeText = await parseFreeText({
        existingSupplementUseText: values.existingSupplementUseText,
        allergiesText: values.allergiesText,
        medicationsHasAny: values.medicationsHasAny,
        medicationsFreeText: values.medicationsFreeText,
      });
      const needsConfirmation = fieldsNeedingConfirmation(parsed);
      const profile = assembleUserProfile(values, parsed, []);
      if (needsConfirmation.length > 0) {
        setSubmitState({ status: "needs-confirmation", profile, fields: needsConfirmation });
      } else {
        await doSubmit(profile);
      }
    } catch (error) {
      setSubmitState({
        status: "error",
        message: error instanceof Error ? error.message : "Something went wrong.",
      });
    }
  }

  async function doSubmit(profile: UserProfile) {
    setSubmitState({ status: "submitting", profile });
    try {
      const { profileVersionId } = await submitProfile(profile);
      saveProfileForResults(profile);
      setSubmitState({ status: "done", profile, profileVersionId });
    } catch (error) {
      setSubmitState({
        status: "error",
        message: error instanceof Error ? error.message : "Something went wrong.",
      });
    }
  }

  function confirmAndSubmit() {
    if (submitState.status !== "needs-confirmation") return;
    const confirmedProfile: UserProfile = {
      ...submitState.profile,
      _meta: {
        ...submitState.profile._meta,
        confirmedByUser: submitState.fields,
      },
    };
    void doSubmit(confirmedProfile);
  }

  if (submitState.status === "done") {
    return (
      <Card className="mx-auto w-full max-w-xl">
        <CardHeader>
          <CardTitle>You&apos;re all set</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Your profile was recorded (version <code>{submitState.profileVersionId}</code>).
          </p>
          <Button asChild>
            <Link href="/results">See your recommendations</Link>
          </Button>
          <pre className="max-h-96 overflow-auto rounded-md bg-muted p-3 text-xs">
            {JSON.stringify(submitState.profile, null, 2)}
          </pre>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mx-auto w-full max-w-xl">
      <CardHeader className="space-y-3">
        <CardTitle>Supplement intake</CardTitle>
        <Progress value={((step + 1) / TOTAL_STEPS) * 100} />
      </CardHeader>
      <Form {...form}>
        <form
          onSubmit={(e) => e.preventDefault()}
          className="contents"
        >
          <CardContent className="space-y-6">
            {step === 0 && (
              <p className="text-sm leading-relaxed">
                A few quick questions about your goals, diet and lifestyle. We&apos;ll only
                recommend something if there&apos;s a real, evidence-backed reason for it — and
                we&apos;ll tell you plainly when nothing is needed, or when it&apos;s better to
                check with a doctor first.
              </p>
            )}

            {step === 1 && (
              <FormField
                control={form.control}
                name="age"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>What is your age?</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={18}
                        max={100}
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.valueAsNumber)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {step === 2 && (
              <>
                <FormField
                  control={form.control}
                  name="sex"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>What is your sex?</FormLabel>
                      <FormDescription>
                        Used for nutrient requirement differences, e.g. iron.
                      </FormDescription>
                      <FormControl>
                        <RadioGroup onValueChange={field.onChange} value={field.value}>
                          {[
                            { value: "male", label: "Male" },
                            { value: "female", label: "Female" },
                            { value: "prefer_not_to_say", label: "Prefer not to say" },
                          ].map((opt) => (
                            <div key={opt.value} className="flex items-center gap-2">
                              <RadioGroupItem value={opt.value} id={`sex-${opt.value}`} />
                              <Label htmlFor={`sex-${opt.value}`}>{opt.label}</Label>
                            </div>
                          ))}
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {sex === "female" && (
                  <FormField
                    control={form.control}
                    name="isPregnantOrBreastfeeding"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Are you currently pregnant or breastfeeding?</FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={(v) => field.onChange(v === "yes")}
                            value={
                              field.value === undefined ? undefined : field.value ? "yes" : "no"
                            }
                          >
                            <div className="flex items-center gap-2">
                              <RadioGroupItem value="yes" id="pregnant-yes" />
                              <Label htmlFor="pregnant-yes">Yes</Label>
                            </div>
                            <div className="flex items-center gap-2">
                              <RadioGroupItem value="no" id="pregnant-no" />
                              <Label htmlFor="pregnant-no">No</Label>
                            </div>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </>
            )}

            {step === 3 && (
              <>
                <FormField
                  control={form.control}
                  name="bodyWeightKg"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>What is your current body weight, in kilograms?</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.1"
                          min={30}
                          max={250}
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.valueAsNumber)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="heightCm"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>And your height in centimetres? (optional)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={100}
                          max={250}
                          value={field.value ?? ""}
                          onChange={(e) =>
                            field.onChange(e.target.value === "" ? undefined : e.target.valueAsNumber)
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            {step === 4 && (
              <FormField
                control={form.control}
                name="dietaryPattern"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Which best describes your diet?</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {[
                          "omnivore",
                          "vegetarian",
                          "eggetarian",
                          "vegan",
                          "pescatarian",
                          "other",
                        ].map((opt) => (
                          <SelectItem key={opt} value={opt}>
                            {opt}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {step === 5 && (
              <FormField
                control={form.control}
                name="exerciseFrequencyPerWeek"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>How many days a week do you exercise?</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        max={14}
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.valueAsNumber)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {step === 6 && (
              <FormField
                control={form.control}
                name="exerciseType"
                render={() => (
                  <FormItem>
                    <FormLabel>What kind of exercise, mostly?</FormLabel>
                    <div className="space-y-2">
                      {EXERCISE_TYPE_OPTIONS.map((opt) => (
                        <FormField
                          key={opt.value}
                          control={form.control}
                          name="exerciseType"
                          render={({ field }) => {
                            const values = field.value ?? [];
                            const checked = values.includes(opt.value);
                            return (
                              <div className="flex items-center gap-2">
                                <Checkbox
                                  id={`exercise-${opt.value}`}
                                  checked={checked}
                                  onCheckedChange={(c) => {
                                    field.onChange(
                                      c
                                        ? [...values, opt.value]
                                        : values.filter((v) => v !== opt.value)
                                    );
                                  }}
                                />
                                <Label htmlFor={`exercise-${opt.value}`}>{opt.label}</Label>
                              </div>
                            );
                          }}
                        />
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {step === 7 && (
              <FormField
                control={form.control}
                name="primaryGoals"
                render={() => (
                  <FormItem>
                    <FormLabel>What are you mainly trying to achieve right now?</FormLabel>
                    <FormDescription>Pick up to 3. The first you pick counts most.</FormDescription>
                    <div className="space-y-2">
                      {PRIMARY_GOAL_OPTIONS.map((opt) => (
                        <FormField
                          key={opt.value}
                          control={form.control}
                          name="primaryGoals"
                          render={({ field }) => {
                            const values = field.value ?? [];
                            const checked = values.includes(opt.value);
                            const disableUnchecked = !checked && values.length >= 3;
                            return (
                              <div className="flex items-center gap-2">
                                <Checkbox
                                  id={`goal-${opt.value}`}
                                  checked={checked}
                                  disabled={disableUnchecked}
                                  onCheckedChange={(c) => {
                                    field.onChange(
                                      c
                                        ? [...values, opt.value]
                                        : values.filter((v) => v !== opt.value)
                                    );
                                  }}
                                />
                                <Label htmlFor={`goal-${opt.value}`}>{opt.label}</Label>
                              </div>
                            );
                          }}
                        />
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {step === 8 && (
              <>
                <p className="text-sm text-muted-foreground">
                  This is used only to fit recommendations to a budget after they&apos;re
                  decided — it never affects whether something is recommended in the first
                  place.
                </p>
                <FormField
                  control={form.control}
                  name="monthlyBudgetINR"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Roughly what would you be comfortable spending on supplements per
                        month, in rupees?
                      </FormLabel>
                      <FormDescription>Optional — leave blank for no limit.</FormDescription>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          value={field.value ?? ""}
                          onChange={(e) =>
                            field.onChange(e.target.value === "" ? undefined : e.target.valueAsNumber)
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="budgetIsHardConstraint"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Should we stay strictly within that budget?</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={(v) => field.onChange(v === "yes")}
                          value={field.value ? "yes" : "no"}
                        >
                          <div className="flex items-center gap-2">
                            <RadioGroupItem value="yes" id="budget-hard-yes" />
                            <Label htmlFor="budget-hard-yes">Yes, stay within it</Label>
                          </div>
                          <div className="flex items-center gap-2">
                            <RadioGroupItem value="no" id="budget-hard-no" />
                            <Label htmlFor="budget-hard-no">
                              Show slightly over-budget options too
                            </Label>
                          </div>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            {step === 9 && (
              <FormField
                control={form.control}
                name="sleepHoursTypical"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>On a typical night, how many hours do you sleep?</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.5"
                        min={0}
                        max={14}
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.valueAsNumber)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {step === 10 && (
              <FormField
                control={form.control}
                name="existingSupplementUseText"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Are you currently taking any supplements? If so, which ones?</FormLabel>
                    <FormControl>
                      <Textarea placeholder="e.g. whey protein, a multivitamin" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {step === 11 && (
              <>
                <FormField
                  control={form.control}
                  name="dietaryProteinAdequacy"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Do you feel you consistently get enough protein from food?
                      </FormLabel>
                      <FormDescription>
                        Roughly 1.2–2.0 g per kg body weight per day depending on your goal.
                      </FormDescription>
                      <FormControl>
                        <RadioGroup onValueChange={field.onChange} value={field.value}>
                          {[
                            { value: "likely_adequate", label: "Yes, likely" },
                            { value: "likely_inadequate", label: "No, probably not" },
                            { value: "unsure", label: "Not sure" },
                          ].map((opt) => (
                            <div key={opt.value} className="flex items-center gap-2">
                              <RadioGroupItem value={opt.value} id={`protein-${opt.value}`} />
                              <Label htmlFor={`protein-${opt.value}`}>{opt.label}</Label>
                            </div>
                          ))}
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {dietaryProteinAdequacy !== "likely_adequate" && (
                  <FormField
                    control={form.control}
                    name="estimatedDailyProteinG"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          If you have a rough idea, about how many grams of protein a day do
                          you get from food? (optional)
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            max={400}
                            value={field.value ?? ""}
                            onChange={(e) =>
                              field.onChange(
                                e.target.value === "" ? undefined : e.target.valueAsNumber
                              )
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </>
            )}

            {step === 12 && (
              <FormField
                control={form.control}
                name="dietaryOilyFishServingsPerWeek"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      How many servings of oily fish (salmon, mackerel, sardines, etc.) do
                      you eat per week?
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        max={21}
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(e.target.value === "" ? undefined : e.target.valueAsNumber)
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {step === 13 && (
              <FormField
                control={form.control}
                name="allergiesText"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Do you have any food allergies or intolerances?</FormLabel>
                    <FormControl>
                      <Textarea placeholder="e.g. lactose, soy, shellfish, gluten" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {step === 14 && (
              <FormField
                control={form.control}
                name="relevantHealthContext"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Anything else relevant about your health or lifestyle you&apos;d like
                      us to know? (optional)
                    </FormLabel>
                    <FormControl>
                      <Textarea {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {step === 15 && (
              <>
                <FormField
                  control={form.control}
                  name="medicationsHasAny"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Are you currently taking any prescription medication, or do you have
                        any diagnosed medical condition?
                      </FormLabel>
                      <FormDescription>
                        Used only to check known interactions/contraindications — not a
                        diagnosis, not stored or used for anything else.
                      </FormDescription>
                      <FormControl>
                        <RadioGroup
                          onValueChange={(v) => field.onChange(v === "yes")}
                          value={field.value ? "yes" : "no"}
                        >
                          <div className="flex items-center gap-2">
                            <RadioGroupItem value="yes" id="meds-yes" />
                            <Label htmlFor="meds-yes">Yes</Label>
                          </div>
                          <div className="flex items-center gap-2">
                            <RadioGroupItem value="no" id="meds-no" />
                            <Label htmlFor="meds-no">No</Label>
                          </div>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {medicationsHasAny && (
                  <FormField
                    control={form.control}
                    name="medicationsFreeText"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Please list them.</FormLabel>
                        <FormControl>
                          <Textarea {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </>
            )}

            {isReviewStep && (
              <ReviewStep submitState={submitState} onConfirm={confirmAndSubmit} />
            )}
          </CardContent>

          <CardFooter className="flex justify-between">
            <Button type="button" variant="outline" onClick={goBack} disabled={step === 0}>
              Back
            </Button>
            {isReviewStep ? (
              submitState.status === "idle" || submitState.status === "error" ? (
                <Button type="button" onClick={runParseAndReview}>
                  Review my answers
                </Button>
              ) : null
            ) : (
              <Button type="button" onClick={goNext}>
                Next
              </Button>
            )}
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}

function ReviewStep({
  submitState,
  onConfirm,
}: {
  submitState: SubmitState;
  onConfirm: () => void;
}) {
  if (submitState.status === "idle") {
    return (
      <p className="text-sm text-muted-foreground">
        That&apos;s everything. We&apos;ll quickly normalize your free-text answers, then you
        can review them before submitting.
      </p>
    );
  }
  if (submitState.status === "parsing" || submitState.status === "submitting") {
    return <p className="text-sm text-muted-foreground">Working on it…</p>;
  }
  if (submitState.status === "error") {
    return <p className="text-sm text-destructive">{submitState.message}</p>;
  }
  if (submitState.status === "needs-confirmation") {
    const { profile, fields } = submitState;
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Please double-check a couple of things we weren&apos;t fully sure we parsed
          correctly:
        </p>
        {fields.includes("existingSupplementUse") && (
          <p className="text-sm">
            <strong>Current supplements we understood:</strong>{" "}
            {profile.existingSupplementUse.length > 0
              ? profile.existingSupplementUse.join(", ")
              : "(none)"}
          </p>
        )}
        {fields.includes("allergies") && (
          <p className="text-sm">
            <strong>Allergies/intolerances we understood:</strong>{" "}
            {profile.allergies.length > 0 ? profile.allergies.join(", ") : "(none)"}
          </p>
        )}
        {fields.includes("medicationsOrConditionsFlag.freeText") && (
          <p className="text-sm">
            <strong>Medications/conditions:</strong>{" "}
            {profile.medicationsOrConditionsFlag.freeText || "(none)"}
          </p>
        )}
        <p className="text-sm text-muted-foreground">
          If that looks right, confirm below. If not, go back and adjust your answer.
        </p>
        <Button type="button" onClick={onConfirm}>
          Looks right, submit
        </Button>
      </div>
    );
  }
  return null;
}
