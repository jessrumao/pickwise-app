# Supplement Recommendation Engine — Core Idea & Discussion Handoff

## 1. Core Idea

We want to build an **India-first, evidence-based personal nutrition and supplement decision engine** for generally healthy adults.

The product is not intended to simply sell supplements or act as a generic AI chatbot. Its purpose is to help users answer:

> **“Given my goals, diet, lifestyle and circumstances, do I actually need any supplements, and if so, which ones and which specific products make sense for me?”**

The platform will eventually allow users to purchase recommended products directly through the portal.

### Core philosophy

> **Recommend what is appropriate—not what is profitable.**

The system must be willing to tell a user:

> **“You don't need this supplement.”**

This is important for building trust and differentiating the product from supplement retailers, influencers and affiliate-driven recommendation engines.

---

# 2. Target User

Initial target:

**Generally healthy adults in India.**

We deliberately do NOT want to restrict users to five predefined goals.

Instead, users provide a broad profile, and the engine determines which recommendation areas are relevant.

Potential user information:

- Age
- Sex
- Dietary pattern
- Exercise/training
- Fitness goals
- General wellness goals
- Sleep/lifestyle
- Existing supplement use
- Dietary intake
- Allergies/preferences
- Relevant health context
- Medications/conditions where appropriate for safety screening

The system should not attempt to diagnose users.

---

# 3. Product Philosophy

The engine should answer questions in this order:

### Step 1 — What does this person need?

Understand their goals, lifestyle, diet and relevant context.

### Step 2 — Is supplementation actually warranted?

The engine should be able to conclude:

- Supplement recommended
- Supplement potentially useful
- Insufficient evidence/reason
- No supplement needed
- Medical/professional review required

### Step 3 — What ingredient/formulation makes sense?

For example:

> Creatine monohydrate

rather than immediately jumping to:

> Brand X creatine.

### Step 4 — What amount/form is appropriate?

The underlying system should reason about the relevant nutrient/ingredient amount.

The user-facing experience should remain simple and practical.

For example:

> **Whey protein — 2 scoops post-workout**

rather than exposing complicated calculations.

However, the architecture should separate:

**recommendation → target amount → specific product → product-specific serving instruction**

so changing brands does not accidentally change the intended dose.

### Step 5 — Which actual products are best?

The engine matches the recommendation to products available through the platform.

Product selection can consider:

- Ingredient/form
- Effective amount per serving
- Product quality
- Third-party testing/certification where relevant
- Formulation
- Additives
- Allergens
- Price/value
- Brand/manufacturer information
- Suitability for the user
- Availability

The engine should explain:

> **Why this product was ranked above the alternatives.**

---

# 4. Recommendation Architecture

We do NOT want a simple vector database + LLM deciding what users should take.

The proposed architecture is closer to:

**User profile**
→ **structured knowledge/evidence**
→ **expert-governed rules**
→ **safety/contraindication checks**
→ **recommendation**
→ **ingredient/form**
→ **product matching**
→ **ranked products**
→ **explanation**
→ **purchase**

The vector database/RAG layer can help retrieve relevant scientific evidence, but it is **infrastructure rather than the moat**.

The recommendation system should combine:

### Evidence layer
Scientific literature, clinical guidance, authoritative nutrition resources, etc.

### Structured knowledge layer
Ingredients, forms, doses, populations, goals, interactions, contraindications, evidence strength, etc.

### Expert governance
Medical/nutrition experts define and review:

- Recommendation rules
- Evidence standards
- Safety boundaries
- Contraindications
- Escalation criteria
- Recommendation updates

### AI layer
AI primarily helps:

- Understand natural-language user input
- Personalize/explain recommendations
- Retrieve relevant evidence
- Communicate uncertainty
- Make the experience conversational

The AI should **not freely invent recommendation logic**.

---

# 5. Evidence Philosophy

Recommendations should not simply say:

> “Take X.”

They should communicate evidence and uncertainty.

Example:

> **Creatine monohydrate**
>
> Why: Your goal is muscle/performance and you train regularly.
>
> Evidence: Strong
>
> Expected benefit: Moderate
>
> Why this product: Appropriate form, serving size and quality characteristics.

The system should distinguish between:

- Strong evidence
- Moderate evidence
- Limited evidence
- Insufficient evidence

The exact evidence methodology still needs to be designed.

Credentials of medical experts can support trust, but **evidence transparency is more important than simply saying “doctors recommend this.”**

Ideally, users can ask:

> **Why am I seeing this recommendation?**

and receive a transparent explanation backed by sources.

---

# 6. Safety Model

“Not medical advice” is not considered sufficient protection.

The system needs an actual safety/risk architecture.

A proposed model:

### Low-risk / automated
Healthy adult + clear goal + sufficient evidence + no relevant contraindications.

→ Automatic recommendation possible.

### Moderate-risk / restricted
Potential interaction, unusual circumstances, higher-dose use, or insufficient information.

→ Additional screening and/or professional review.

### High-risk
Potential medical condition, medication interaction, pregnancy, concerning symptoms, therapeutic/high-dose recommendation, etc.

→ Do not automatically recommend. Escalate to medical professional.

The medical expert is not merely a customer-service escape hatch.

Experts should help **govern the recommendation system itself**.

The desired philosophy is:

> **AI applies a medically governed evidence framework and explains it.**

Not:

> **AI independently practices medicine.**

---

# 7. Initial Recommendation Universe

The following was proposed as the initial candidate universe.

## Green — candidate for automated recommendation

- Whey Protein
  - Concentrate
  - Isolate
  - Hydrolysate
- Plant Protein / Soy Protein
- Casein Protein
- Protein Blends
- Mass Gainer / Weight Gainer
- Creatine Monohydrate
- BCAA
- EAA
- Electrolytes
- L-Glutamine
- Meal Replacement
- Protein Bars
- Protein Shakes / RTD
- Peanut Butter
- Oats
- Multivitamin — men/women
- Omega-3 / Fish Oil
- Collagen
- Probiotics
- Carb Blends

However, this list is **not yet locked**.

Important critique:

Not everything here should automatically be treated as equally recommendable.

For example:

### BCAA
Should not be recommended merely because someone exercises, particularly when adequate protein intake already makes the incremental benefit questionable.

### EAA
Needs context rather than blanket recommendation.

### L-Glutamine
Should not be treated as equivalent to creatine/whey in evidence strength.

### Collagen
Requires goal-specific reasoning.

### Probiotics
Require more sophisticated, strain-level/product-level reasoning. “Probiotic” is not a sufficiently precise category by itself.

### Multivitamin
Should be relevance/diet gated rather than universally recommended.

### Omega-3
Should consider dietary intake and distinguish fish-derived EPA/DHA from alternatives such as algae-derived products.

The list should therefore be considered an **initial candidate universe**, to be medically/evidence validated before automated recommendations are enabled.

---

# 8. Yellow — Caution / Additional Review

Initial candidates:

- Caffeine-based pre-workout
- Beta-alanine
- Citrulline malate
- Nitric oxide boosters
- Ashwagandha
- Turmeric / Curcumin
- Glucosamine
- Magnesium, especially higher-dose standalone
- Rhodiola rosea
- HMB

The initial thinking was:

> Doctor should confirm dosage/duration.

This was challenged.

A better model is:

> **Recommendation depends on user risk profile and ingredient-specific rules.**

We don't want a healthy person to need a doctor for every moderately complex sports supplement.

The system should use **risk-based escalation**, not simply “yellow = doctor approval.”

---

# 9. Red / High-Risk Candidates

Initial candidates:

- Iron
- Vitamin D3, particularly high-dose standalone
- Vitamin B12, particularly high-dose standalone
- Zinc, particularly high-dose standalone
- Calcium, particularly high-dose standalone
- Folate/Folic Acid, particularly high-dose standalone

The original idea was:

> These require blood tests/diagnostic markers before recommendation.

This was challenged as being too absolute.

Better principle:

> **Require appropriate deficiency/risk assessment before making high-dose or therapeutic recommendations.**

There is an important difference between:

> “This person may have a higher risk of inadequate intake.”

and:

> “This person should take a high-dose standalone supplement.”

The engine should not automatically make the second leap.

---

# 10. Explicit “Do Not Automatically Recommend” Category

We should create a fourth category:

## Black — Outside Automated Recommendation Scope

For cases where recommendation would require substantial medical judgment, diagnosis or treatment.

The system should say something like:

> **“We can't safely make a recommendation based on the information available. We recommend speaking with our medical professional.”**

This is considered a **feature**, not a failure.

---

# 11. Product Marketplace

The business model is:

> **Sell supplements/nutrition products through the platform.**

This creates a major trust risk.

If the platform recommends products that it also sells, users may reasonably wonder:

> “Was this recommended because it's best for me, or because you make money from it?”

Therefore, recommendation ranking should ideally be commercially independent.

Possible conceptual scoring:

> **Recommendation quality = suitability × evidence × safety × product quality × value**

Commerce should happen **after** recommendation logic rather than driving it.

Potential transparency:

> Why this product ranked #1
>
> Evidence: 9/10  
> Ingredient quality: 9/10  
> Formulation: 9/10  
> Value: 8/10  
> Suitability: 10/10  
> Commercial relationship: disclosed

The exact scoring methodology still needs to be developed.

---

# 12. What We Think the Product Really Is

An important realization from the discussion:

This is becoming broader than a traditional supplement recommender.

It is potentially a:

> **Personal nutrition + supplement decision engine.**

For example, a user says:

> “I want to build muscle.”

The engine might conclude:

### Priority 1
Increase protein intake.

→ Whey/plant protein if dietary intake is insufficient.

### Priority 2
Creatine monohydrate.

→ Strong evidence and suitable user profile.

### Not recommended
BCAA.

→ No compelling incremental reason given adequate protein.

### Potentially useful
Carbohydrate product.

→ Depending on training volume and dietary intake.

### Insufficient information
Vitamin D.

→ Do not automatically recommend high-dose standalone supplementation.

This is much more valuable than a quiz that simply outputs five products.

---

# 13. User Experience Concept

A possible experience:

### User enters profile

> Male, 29  
> Vegetarian  
> Gym 4×/week  
> ~7 hours sleep  
> Wants muscle gain  
> No medications  
> No known medical conditions  
> Currently takes whey

### Engine outputs something like:

**Your recommendations**

🟢 **Protein**
Your current goal and training make adequate protein intake important. Based on your dietary pattern, a protein supplement may be useful if you are not consistently reaching your target through food.

**Creatine monohydrate**
Strong evidence for supporting strength/performance in resistance training.

**BCAA**
Not recommended based on your current profile because you already use a complete protein source.

**Vitamin D**
Not automatically recommended without additional information.

Each recommendation should provide:

- Why it is relevant
- Evidence strength
- Expected benefit
- Product recommendation
- Serving guidance
- Safety considerations
- Evidence/source links

---

# 14. Initial UX Principle

The platform should not overwhelm the user with scientific complexity.

The backend can be sophisticated.

The user experience should be simple.

For example:

> **Take 2 scoops of this whey after training.**

with a “Why?” button that expands into the evidence and reasoning.

The user shouldn't have to understand the underlying decision tree.

---

# 15. Long-Term Moat

We rejected:

> “Our vector database is our moat.”

That's not defensible.

A competitor can build:

LLM + RAG + supplement literature + product catalogue.

Potential long-term defensibility comes from:

### 1. Structured evidence graph
A proprietary structured representation of ingredients, forms, goals, populations and evidence.

### 2. Expert-governed decision framework
A carefully maintained recommendation/safety system.

### 3. Product intelligence
A deep database of Indian supplement/nutrition products, formulations, quality characteristics, effective doses and value.

### 4. User feedback/outcome data
Potentially:

**User characteristics → recommendation → product → adherence → reported outcome**

This could improve personalization over time.

However, user data must be handled appropriately, and observational feedback should not be presented as proof of clinical efficacy.

---

# 16. Strategic Positioning

Avoid positioning it as:

> “Nobody is doing this.”

Avoid positioning it as:

> “AI trained on scientific research.”

Stronger positioning:

> **“We are building the trusted decision layer between people and the supplement market.”**

Or:

> **“Tell us what you're trying to achieve. We'll tell you what, if anything, is actually worth taking—and why.”**

The second positioning emphasizes the ability to recommend **nothing**, which is strategically important for trust.

---

# 17. Regulatory Considerations

The company will be India-first, so regulatory review must be built into product development from the beginning.

Relevant areas include:

- FSSAI requirements for health supplements/nutraceuticals
- Permitted ingredients/forms
- Dosage restrictions
- Product labelling
- Health claims
- Advertising claims
- Disease-treatment claims
- Product quality/testing
- Medical-professional involvement
- Data/privacy considerations

Do not treat regulatory/legal work as something to solve after the MVP is built.

---

# 18. Current Business Model

Primary model:

**Sell recommended supplements/nutrition products through the portal.**

Potential future models could include:

- Premium personalization
- Medical consultation
- Subscription
- B2B/API
- Partnerships
- Personalized nutrition programs

But the initial business model is **commerce**.

---

# 19. Core Product Principle

The most important principle emerging from the discussion is:

> **The platform's job is not to sell a supplement. Its job is to make the best recommendation for the user.**

If that recommendation results in a purchase, great.

If the correct recommendation is:

> **“You don't need anything right now.”**

the system should be comfortable saying that.

That is how the platform can differentiate itself from a conventional supplement marketplace.

---

# 20. Current Status

The **core concept is considered sufficiently defined for now.**

We do NOT need to keep brainstorming the concept indefinitely.

The next stage should be turning the idea into something buildable.

Recommended next workstreams:

1. **Define the MVP**
2. Design the **user questionnaire**
3. Define the **recommendation decision tree**
4. Design the **evidence framework**
5. Design the **medical/safety governance layer**
6. Define the **initial ingredient universe**
7. Define the **product database schema**
8. Design the **product-ranking algorithm**
9. Design the **results/recommendation UX**
10. Define the **medical escalation workflow**
11. Define the **commerce architecture**
12. Define the **data/feedback loop**
13. Define the **regulatory requirements for India**
14. Identify what must be built internally vs. sourced externally

## The biggest questions to solve next

- What exactly should the onboarding questionnaire ask?
- How does the engine translate answers into recommendations?
- What is the evidence hierarchy/scoring system?
- What makes a recommendation safe enough to automate?
- How do we rank products objectively?
- How do we prevent commercial incentives from corrupting recommendations?
- What does the MVP contain—and deliberately exclude?
- What data should be collected from every user?
- What is the smallest version we can launch and learn from?