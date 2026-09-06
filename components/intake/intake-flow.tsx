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
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import {
  assembleUserProfile,
  fieldsNeedingConfirmation,
  type ParsedFreeText,
} from "@/lib/intake/assemble-profile";
import {
  intakeFormSchema,
  STEP_FIELDS,
  STEP_TITLES,
  TOTAL_STEPS,
  type IntakeFormValues,
} from "@/lib/intake/schema";
import {
  estimateProteinFromDescription,
  parseFreeText,
  submitProfile,
} from "@/lib/intake/submit-profile";
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
  heightCm: 170,
  dietaryPattern: "omnivore",
  exerciseFrequencyPerWeek: 3,
  exerciseType: [],
  exerciseIntensityTypical: "moderate",
  primaryGoals: [],
  monthlyBudgetINR: undefined,
  budgetIsHardConstraint: true,
  sleepHoursTypical: 7,
  existingSupplementUseText: "",
  estimatedDailyProteinG: 60,
  proteinFoodDescription: "",
  estimatedDailyProteinGConfidence: undefined,
  dietaryOilyFishServingsPerWeek: 0,
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
  const [returnToReview, setReturnToReview] = React.useState(false);
  const [submitState, setSubmitState] = React.useState<SubmitState>({ status: "idle" });
  // Gates the protein-amount question into an explicit binary choice — see
  // step 5's JSX below. null means no choice made yet (neither the slider
  // nor the description box is shown until the user picks one).
  const [proteinKnowsAmount, setProteinKnowsAmount] = React.useState<"yes" | "not_sure" | null>(
    null
  );
  // Once a "not sure" estimate has succeeded, the slider stays revealed
  // (for fine-tuning) even after the user drags it — separate from
  // estimatedDailyProteinGConfidence, which intentionally clears on manual
  // adjustment and would otherwise hide the slider again.
  const [proteinEstimateRevealed, setProteinEstimateRevealed] = React.useState(false);
  const [proteinEstimateState, setProteinEstimateState] = React.useState<
    "idle" | "loading" | { error: string }
  >("idle");

  const form = useForm<IntakeFormValues>({
    resolver: zodResolver(intakeFormSchema),
    defaultValues: DEFAULT_VALUES,
    mode: "onSubmit",
  });

  const sex = form.watch("sex");
  const medicationsHasAny = form.watch("medicationsHasAny");
  const proteinFoodDescription = form.watch("proteinFoodDescription");

  const isReviewStep = step === TOTAL_STEPS - 1;

  async function goNext() {
    const fields = STEP_FIELDS[step];
    if (fields.length > 0) {
      const valid = await form.trigger(fields);
      if (!valid) return;
    }
    if (returnToReview) {
      setReturnToReview(false);
      setStep(TOTAL_STEPS - 1);
    } else {
      setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
    }
  }

  function goBack() {
    setSubmitState({ status: "idle" });
    setReturnToReview(false);
    setStep((s) => Math.max(s - 1, 0));
  }

  function editSection(sectionStep: number) {
    setReturnToReview(true);
    setStep(sectionStep);
  }

  async function estimateProtein() {
    const { dietaryPattern, bodyWeightKg, heightCm, proteinFoodDescription } = form.getValues();
    if (!proteinFoodDescription.trim()) return;
    setProteinEstimateState("loading");
    try {
      const { estimatedDailyProteinG, confidence } = await estimateProteinFromDescription({
        dietaryPattern,
        bodyWeightKg,
        heightCm,
        foodDescription: proteinFoodDescription,
      });
      form.setValue("estimatedDailyProteinG", estimatedDailyProteinG);
      form.setValue("estimatedDailyProteinGConfidence", confidence);
      setProteinEstimateRevealed(true);
      setProteinEstimateState("idle");
    } catch (error) {
      setProteinEstimateState({
        error: error instanceof Error ? error.message : "Something went wrong.",
      });
    }
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
      const needsConfirmation = fieldsNeedingConfirmation(
        parsed,
        values.estimatedDailyProteinGConfidence
      );
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

  function startOver() {
    form.reset(DEFAULT_VALUES);
    setReturnToReview(false);
    setStep(0);
    setSubmitState({ status: "idle" });
    setProteinKnowsAmount(null);
    setProteinEstimateRevealed(false);
    setProteinEstimateState("idle");
  }

  if (submitState.status === "done") {
    return (
      <Card className="mx-auto w-full max-w-xl">
        <CardHeader>
          <CardTitle>You&apos;re all set</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Your profile was recorded. Your personalized recommendations are ready.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href={`/results?profileVersionId=${encodeURIComponent(submitState.profileVersionId)}`}>
                See your recommendations
              </Link>
            </Button>
            <Button type="button" variant="outline" onClick={startOver}>
              Start over
            </Button>
          </div>
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
        <form onSubmit={(e) => e.preventDefault()} className="contents">
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
              <>
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
                      <FormLabel>And your height in centimetres?</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={100}
                          max={250}
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.valueAsNumber)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            {step === 2 && (
              <>
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
                          {["omnivore", "vegetarian", "eggetarian", "vegan", "pescatarian", "other"].map(
                            (opt) => (
                              <SelectItem key={opt} value={opt}>
                                {opt}
                              </SelectItem>
                            )
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
                <FormField
                  control={form.control}
                  name="exerciseType"
                  render={() => (
                    <FormItem>
                      <FormLabel>What kind of exercise, mostly? (optional)</FormLabel>
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
                                        c ? [...values, opt.value] : values.filter((v) => v !== opt.value)
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
                <FormField
                  control={form.control}
                  name="exerciseIntensityTypical"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>On a typical session, how intense is your exercise?</FormLabel>
                      <FormControl>
                        <RadioGroup onValueChange={field.onChange} value={field.value}>
                          {[
                            { value: "light", label: "Light — e.g. walking, easy yoga" },
                            { value: "moderate", label: "Moderate — 15-30 min of elevated heart rate" },
                            { value: "vigorous", label: "Vigorous — 45+ min of elevated heart rate, or high-intensity training" },
                          ].map((opt) => (
                            <div key={opt.value} className="flex items-center gap-2">
                              <RadioGroupItem value={opt.value} id={`intensity-${opt.value}`} />
                              <Label htmlFor={`intensity-${opt.value}`}>{opt.label}</Label>
                            </div>
                          ))}
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            {step === 3 && (
              <>
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
                                        c ? [...values, opt.value] : values.filter((v) => v !== opt.value)
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
                <p className="text-sm text-muted-foreground">
                  Budget is used only to fit recommendations to what you can spend, after
                  they&apos;re decided — it never affects whether something is recommended in
                  the first place.
                </p>
                <FormField
                  control={form.control}
                  name="monthlyBudgetINR"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Roughly what would you be comfortable spending on supplements per
                        month, in rupees? (optional)
                      </FormLabel>
                      <FormDescription>Leave blank for no limit.</FormDescription>
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
                            <Label htmlFor="budget-hard-no">Show slightly over-budget options too</Label>
                          </div>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            {step === 4 && (
              <>
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
                <FormField
                  control={form.control}
                  name="existingSupplementUseText"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Are you currently taking any supplements? If so, which ones? (optional)
                      </FormLabel>
                      <FormControl>
                        <Textarea placeholder="e.g. whey protein, a multivitamin" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            {step === 5 && (
              <>
                <FormField
                  control={form.control}
                  name="estimatedDailyProteinG"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>About how many grams of protein a day do you get from food?</FormLabel>
                      <FormDescription>
                        A rough estimate is fine — this is what turns &ldquo;you may need
                        protein&rdquo; into a real, personalized amount. Most people need roughly
                        1.2–2.0g per kg body weight per day, depending on their goal.
                      </FormDescription>
                      <FormControl>
                        <div className="space-y-3">
                          <RadioGroup
                            value={proteinKnowsAmount ?? undefined}
                            onValueChange={(v) => setProteinKnowsAmount(v as "yes" | "not_sure")}
                          >
                            <div className="flex items-center gap-2">
                              <RadioGroupItem value="yes" id="protein-amount-known" />
                              <Label htmlFor="protein-amount-known">Yes, I know roughly</Label>
                            </div>
                            <div className="flex items-center gap-2">
                              <RadioGroupItem value="not_sure" id="protein-amount-unsure" />
                              <Label htmlFor="protein-amount-unsure">
                                Not sure — help me estimate
                              </Label>
                            </div>
                          </RadioGroup>

                          {proteinKnowsAmount === "not_sure" && (
                            <div className="space-y-2 rounded-md border border-dashed p-3">
                              <Label htmlFor="protein-food-description" className="text-xs">
                                What are the most common foods you eat in a day?
                              </Label>
                              <Textarea
                                id="protein-food-description"
                                placeholder="e.g. 2 eggs, 1 bowl dal, 3 rotis, chicken curry, 1 glass milk"
                                maxLength={500}
                                {...form.register("proteinFoodDescription")}
                              />
                              <p className="text-right text-xs text-muted-foreground">
                                {proteinFoodDescription.length}/500
                              </p>
                              <div className="flex items-center gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  disabled={proteinEstimateState === "loading"}
                                  onClick={estimateProtein}
                                >
                                  {proteinEstimateState === "loading" ? "Estimating…" : "Estimate for me"}
                                </Button>
                                {typeof proteinEstimateState === "object" && (
                                  <span className="text-xs text-destructive">{proteinEstimateState.error}</span>
                                )}
                              </div>
                              {!proteinEstimateRevealed && (
                                <p className="text-xs text-muted-foreground">
                                  We&apos;ll set the amount below from this — you can still adjust it
                                  afterward.
                                </p>
                              )}
                            </div>
                          )}

                          {(proteinKnowsAmount === "yes" ||
                            (proteinKnowsAmount === "not_sure" && proteinEstimateRevealed)) && (
                            <div className="flex items-center gap-3">
                              <Slider
                                min={0}
                                max={250}
                                step={5}
                                value={[field.value]}
                                onValueChange={([v]) => {
                                  field.onChange(v);
                                  // Moving the slider by hand after an AI estimate means the
                                  // final number is the user's own call again, not the estimate.
                                  form.setValue("estimatedDailyProteinGConfidence", undefined);
                                }}
                                className="flex-1"
                              />
                              <span className="w-16 shrink-0 text-right text-sm font-medium">
                                {field.value}g
                              </span>
                            </div>
                          )}
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
                          onChange={(e) => field.onChange(e.target.valueAsNumber)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            {step === 6 && (
              <>
                <FormField
                  control={form.control}
                  name="allergiesText"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Do you have any food allergies or intolerances? (optional)</FormLabel>
                      <FormControl>
                        <Textarea placeholder="e.g. lactose, soy, shellfish, gluten" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
              <ReviewStep
                values={form.getValues()}
                submitState={submitState}
                onConfirm={confirmAndSubmit}
                onSubmit={runParseAndReview}
                onEditSection={editSection}
              />
            )}
          </CardContent>

          <CardFooter className="flex justify-between">
            <Button type="button" variant="outline" onClick={goBack} disabled={step === 0}>
              Back
            </Button>
            {isReviewStep ? null : (
              <Button type="button" onClick={goNext}>
                {returnToReview ? "Save & back to review" : "Next"}
              </Button>
            )}
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}

function goalLabel(value: string): string {
  return PRIMARY_GOAL_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

function exerciseLabel(value: string): string {
  return EXERCISE_TYPE_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

interface SummarySection {
  title: string;
  stepIndex: number;
  rows: { label: string; value: string }[];
}

function buildSummary(values: IntakeFormValues): SummarySection[] {
  return [
    {
      title: STEP_TITLES[1],
      stepIndex: 1,
      rows: [
        { label: "Age", value: String(values.age) },
        { label: "Sex", value: values.sex.replace(/_/g, " ") },
        ...(values.sex === "female"
          ? [{ label: "Pregnant/breastfeeding", value: values.isPregnantOrBreastfeeding ? "Yes" : "No" }]
          : []),
        { label: "Weight", value: `${values.bodyWeightKg} kg` },
        { label: "Height", value: `${values.heightCm} cm` },
      ],
    },
    {
      title: STEP_TITLES[2],
      stepIndex: 2,
      rows: [
        { label: "Diet", value: values.dietaryPattern },
        { label: "Exercise frequency", value: `${values.exerciseFrequencyPerWeek} day(s)/week` },
        {
          label: "Exercise type",
          value: values.exerciseType && values.exerciseType.length > 0
            ? values.exerciseType.map(exerciseLabel).join(", ")
            : "Not specified",
        },
        { label: "Typical intensity", value: values.exerciseIntensityTypical },
      ],
    },
    {
      title: STEP_TITLES[3],
      stepIndex: 3,
      rows: [
        { label: "Goals", value: values.primaryGoals.map(goalLabel).join(", ") || "None selected" },
        {
          label: "Monthly budget",
          value: values.monthlyBudgetINR != null ? `₹${values.monthlyBudgetINR}` : "No limit set",
        },
        { label: "Stay within budget", value: values.budgetIsHardConstraint ? "Yes" : "No, show near-budget options too" },
      ],
    },
    {
      title: STEP_TITLES[4],
      stepIndex: 4,
      rows: [
        { label: "Sleep", value: `${values.sleepHoursTypical} hours/night` },
        { label: "Current supplements", value: values.existingSupplementUseText.trim() || "None mentioned" },
      ],
    },
    {
      title: STEP_TITLES[5],
      stepIndex: 5,
      rows: [
        { label: "Estimated daily protein", value: `${values.estimatedDailyProteinG}g` },
        { label: "Oily fish servings/week", value: String(values.dietaryOilyFishServingsPerWeek) },
      ],
    },
    {
      title: STEP_TITLES[6],
      stepIndex: 6,
      rows: [
        { label: "Allergies", value: values.allergiesText.trim() || "None mentioned" },
        { label: "Other health context", value: values.relevantHealthContext?.trim() || "None" },
        {
          label: "Medications/conditions",
          value: values.medicationsHasAny ? values.medicationsFreeText.trim() || "Yes (not specified)" : "No",
        },
      ],
    },
  ];
}

function ReviewStep({
  values,
  submitState,
  onConfirm,
  onSubmit,
  onEditSection,
}: {
  values: IntakeFormValues;
  submitState: SubmitState;
  onConfirm: () => void;
  onSubmit: () => void;
  onEditSection: (stepIndex: number) => void;
}) {
  if (submitState.status === "parsing" || submitState.status === "submitting") {
    return <p className="text-sm text-muted-foreground">Working on it…</p>;
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
            {profile.existingSupplementUse.length > 0 ? profile.existingSupplementUse.join(", ") : "(none)"}
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
            <strong>Medications/conditions:</strong> {profile.medicationsOrConditionsFlag.freeText || "(none)"}
          </p>
        )}
        {fields.includes("estimatedDailyProteinG") && (
          <p className="text-sm">
            <strong>Estimated daily protein (from what you described):</strong>{" "}
            {profile.estimatedDailyProteinG}g
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

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Here&apos;s everything you told us. Edit any section, or submit if it looks right —
        we&apos;ll quickly normalize your free-text answers first.
      </p>
      {buildSummary(values).map((section) => (
        <div key={section.title} className="rounded-md border p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium">{section.title}</p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onEditSection(section.stepIndex)}
            >
              Edit
            </Button>
          </div>
          <dl className="space-y-1 text-sm">
            {section.rows.map((row) => (
              <div key={row.label} className="flex justify-between gap-4">
                <dt className="text-muted-foreground">{row.label}</dt>
                <dd className="text-right">{row.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
      {submitState.status === "error" && (
        <p className="text-sm text-destructive">{submitState.message}</p>
      )}
      <Button type="button" onClick={onSubmit}>
        Looks good, get my recommendations
      </Button>
    </div>
  );
}
