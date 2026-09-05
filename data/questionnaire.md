# Onboarding Questionnaire — v1 (Day 1 draft)

Plain-language wording for the intake flow. Each question maps 1:1 to a field in `user-profile-schema.json` (see `questionnaireText` on each field — this file is the same text laid out for a human to review, e.g. your friend, before it's wired into the UI).

Ordering follows the profile schema (`Step 1 — What does this person need?` from the handoff doc): easy demographic questions first, goals in the middle, sensitive/safety questions last so the user is warmed up before being asked about medications.

1. What is your age? *(number, 18+)*
2. What is your sex? *(male / female / prefer not to say)*
   - If female: Are you currently pregnant or breastfeeding? *(yes/no)*
3. Which best describes your diet? *(omnivore / vegetarian / eggetarian / vegan / pescatarian / other)*
4. How many days per week do you currently exercise? *(0-14)*
5. What kind of exercise do you mostly do? *(resistance training / cardio & endurance / mixed / yoga & mobility / sport-specific / none — multi-select)*
6. What are you mainly trying to achieve right now? *(muscle gain, strength/performance, weight loss, general fitness, general wellness, energy/fatigue, digestive health, immunity, sleep quality, joint health, skin/hair/nails, endurance performance — pick up to 3)*
7. On a typical night, how many hours do you sleep?
8. Are you currently taking any supplements? If so, which ones? *(free text — AI-parsed into a normalized list)*
9. Do you feel you consistently get enough protein from food? *(yes, likely / no, probably not / not sure)* — short helper text: "roughly 1.2-2.0 g per kg body weight per day depending on your goal."
10. How many servings of oily fish (salmon, mackerel, sardines, etc.) do you eat per week? *(0-21)*
11. Do you have any food allergies or intolerances? *(free text, e.g. lactose, soy, shellfish, gluten)*
12. Anything else relevant about your health or lifestyle you'd like us to know? *(optional, free text)*
13. Are you currently taking any prescription medication, or do you have any diagnosed medical condition? *(yes/no)*
    - If yes: Please list them. *(free text — used only to check known interactions/contraindications; not a diagnosis, not stored or used for anything else)*

## Framing copy (shown once, before Q1)

> A few quick questions about your goals, diet and lifestyle. We'll only recommend something if there's a real, evidence-backed reason for it — and we'll tell you plainly when nothing is needed, or when it's better to check with a doctor first.

## Explicit non-goals for this questionnaire (Day 1 decision)

- No diagnostic or symptom-checker questions ("do you have condition X") beyond the single yes/no + free-text medications/conditions flag — per the handoff's "system should not attempt to diagnose users."
- No blood-test/lab-value inputs in the MVP (relevant to Vitamin D/B12/iron-type Red-tier items) — those ingredients are simply out of the ~20-item MVP list's auto-recommend path for now (see Section 6 of the ingredient KB template).
- Free-text fields (existing supplement use, allergies, medications) are intentionally short-answer, not conversational, to keep Day-1/Day-2 parsing simple; the AI layer's job is just to normalize these into the enum/array fields above.
