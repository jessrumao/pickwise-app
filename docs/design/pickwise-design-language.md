# Pickwise — Design Language
## For questionnaire & flow implementation

---

## The aesthetic in one sentence
Interstellar / NASA mission control: warm amber on true black, instrument-panel density, monospace data labels, thin-weight display type. Restraint everywhere. No decoration.

---

## Colour tokens

```
Background (page)       #000000   true black — never off-black or dark grey
Background (panels)     #060402   near-black for sidebars, instrument panels
Background (active)     #0A0802   featured card, selected answer background
Background (selected)   #0E0A04   active quiz option fill

Border (default)        #1A1612   all hairlines, grid gaps, card edges
Border (inner)          #0E0C08   subtler dividers inside components

Text (primary)          #E8E0D0   warm white — headings, names, prices, answers
Text (secondary)        #6A5A40   supporting info, sub-labels
Text (muted)            #3A3028   nav, tags, metadata, unselected steps
Text (ghost)            #2E2820   barely visible — step numbers, data keys

Accent                  #C8933A   AMBER — see rules below
Accent (dim)            #6A5A40   secondary amber labels
```

### Amber usage rules — strict
Amber appears on: active/selected states, CTA buttons, score values, progress fills, 
total prices, section eyebrow labels, the logo dot. **Nowhere else.**
Count the amber elements on any screen. If more than 8, remove some.

---

## Typography

### Typefaces
```
Display   DM Sans      — all headlines, body copy, product names, prices
Data      DM Mono      — all labels, buttons, metadata, tags, telemetry
```
Import: `https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500&family=DM+Mono:wght@400;500&display=swap`

### Type scale

| Role | Face | Weight | Size | Letter-spacing |
|---|---|---|---|---|
| Page headline | DM Sans | 300 | 56px | -1px |
| Section title | DM Sans | 300 | 28–32px | -0.5px |
| Question text | DM Sans | 300 | 26–28px | -0.3px |
| Answer option name | DM Sans | 500 | 14px | 0 |
| Body / description | DM Sans | 300 | 13–14px | 0 |
| Price / number | DM Sans | 300 | 28–36px | -0.5px |
| Step label / eyebrow | DM Mono | 400 | 8–9px | 2–2.5px |
| Data key | DM Mono | 400 | 8–9px | 1.5px |
| Data value | DM Mono | 400 | 9–10px | 1px |
| Button text | DM Mono | 500 | 11px | 1.5px |
| Tag / chip | DM Mono | 400 | 8–9px | 0.5px |
| Nav link | DM Mono | 400 | 10px | 1px |

### Typography rules
- Weight 300 for all display type. The thinness is the entire aesthetic.
- Never exceed weight 600 anywhere in the product.
- Headings: letter-spacing negative at large sizes, tightens the composition.
- Section eyebrows: ALL CAPS, DM Mono, amber, e.g. `INPUT 02 OF 04`
- Button labels: ALL CAPS + arrow, e.g. `NEXT INPUT →`, `BEGIN ANALYSIS`
- Data detail lines: ALL CAPS, DM Mono, separated with ` · ` spaced middle dot
- Body copy: sentence case, DM Sans 300, no bold within prose
- Never use italic for emphasis — use amber colour instead
- No exclamation marks anywhere in the product

---

## Spacing & geometry

```
Page horizontal padding    40px
Section vertical padding   48px
Card padding               24px 22px
Data cell padding          18px 16px
Grid gaps                  1px  (shows border colour — creates hairline separators)
```

### Shape rules
- **Zero border-radius on all structural elements** — cards, buttons, inputs, panels
- `border-radius: 4px` only on progress bar fill (the moving bar itself, not the track)
- All grid separators created by `gap: 1px; background: #1A1612` on the grid parent — not explicit borders between every element
- No box-shadow anywhere in the product
- No drop shadows

---

## Quiz / questionnaire UI decisions

### Screen anatomy
```
┌─────────────────────────────────────────────────┐
│ NAV: PICK·WISE logo          [progress segments] │
├──────────────┬──────────────────────────────────┤
│              │                                  │
│  STEP        │   QUESTION AREA                  │
│  SIDEBAR     │                                  │
│  (220px)     │   Step label (DM Mono amber)     │
│              │   Question (DM Sans 300, 28px)   │
│  01 ✓        │   Sub-text (DM Sans 300, 13px)   │
│  02 ← YOU    │                                  │
│  03          │   ┌─────────┐  ┌─────────┐       │
│  04          │   │ Option  │  │ Option  │       │
│              │   └─────────┘  └─────────┘       │
│              │   ┌─────────┐  ┌─────────┐       │
│              │   │ Option  │  │ Option  │       │
│              │   └─────────┘  └─────────┘       │
│              │                                  │
│              │   [NEXT INPUT →]                 │
└──────────────┴──────────────────────────────────┘
```

### Progress bar (top of screen, inside nav)
```
4 segments side by side, gap 3px
Each segment: width 40px, height 2px, no border-radius
Completed step:  background #C8933A (amber)
Current step:    background #C8933A, opacity 0.4
Upcoming step:   background #1A1612 (border colour)
```

### Step sidebar
```
Background: #060402
Border-right: 1px solid #1A1612
Padding: 32px 24px
Width: 220px

Label above list: DM Mono 8px, #2E2820, letter-spacing 2px — "ANALYSIS SEQUENCE"

Each step item:
  Layout: flex, gap 14px, padding 14px 0
  Border-bottom: 1px solid #0E0C08
  Step number: DM Mono 9px, letter-spacing 1px
  Step name: DM Sans 400, 12px

  State — completed:   number #3A3028, name #3A3028
  State — current:     number #C8933A, name #C8933A
  State — upcoming:    number #2E2820, name #2E2820
```

### Question area
```
Background: #000000
Padding: 48px 40px

Step ID label:   DM Mono 8px, #C8933A, letter-spacing 2.5px — "INPUT 02 OF 04"
                 margin-bottom 16px

Question text:   DM Sans 300, 28px, #E8E0D0, letter-spacing -0.3px, line-height 1.2
                 margin-bottom 8px

Sub-text:        DM Sans 300, 13px, #5A5040, line-height 1.8, margin-bottom 36px
                 Explains WHY the system needs this data — this is important copy
```

### Answer options (2×2 grid)
```
Grid: 1fr 1fr, gap 1px, background #1A1612 (creates hairline separators)
margin-bottom 32px

Each option:
  Padding: 18px 20px
  Cursor: pointer

  Default state:
    Background: #000000
    Option name: DM Sans 500, 14px, #5A5040 (muted)
    Option sub-label: DM Mono 9px, #2E2820, letter-spacing 0.5px, ALL CAPS

  Selected state:
    Background: #0E0A04
    Option name: DM Sans 500, 14px, #C8933A (amber)
    Option sub-label: DM Mono 9px, #6A5A40

  Hover state (unselected):
    Background: #080604
    Option name: #6A5A40

No border on individual options — the grid gap creates the separator
No border-radius
```

### Next / submit button
```
Background: #C8933A
Color: #000
Border: none
Padding: 13px 28px
Font: DM Mono 500, 11px, letter-spacing 1.5px
Text: "NEXT INPUT →" / "GET MY STACK →" on final step
No border-radius
```

### Budget input (if using a slider or number input)
```
If slider:
  Track: height 1px, background #1A1612, full width
  Fill (left of thumb): height 1px, background #C8933A
  Thumb: 14px × 14px, background #C8933A, border-radius 0 (square)
  No default browser styling — fully custom

If number field:
  Background: #000
  Border: 1px solid #1A1612
  Border (focused): 1px solid #C8933A
  Font: DM Mono 400, 14px, #E8E0D0
  Padding: 10px 14px
  No border-radius
  Prefix ₹: DM Mono, #6A5A40, inline left
```

### Multi-select chips (for "existing supplements" or restriction options)
```
Each chip: DM Mono 9px, border 1px solid #1A1612, padding 5px 12px, letter-spacing 0.5px
  Default:  color #3A3028, background #000
  Selected: color #C8933A, border-color #C8933A, background #0E0A04
  No border-radius
  Gap between chips: 6px, flex-wrap
```

### Back navigation
```
DM Mono 10px, #3A3028, letter-spacing 1px
"← PREVIOUS" — no button chrome, just text, left-aligned
Above the question, or bottom-left of question area
```

---

## Results page UI decisions

### Screen anatomy
```
┌─────────────────────────────────────────────────┐
│ NAV: PICK·WISE          ANALYSIS COMPLETE        │
│                         3 RESULTS · ₹2,897/₹3k  │
├──────────────┬──────────────────────────────────┤
│ USER PROFILE │  RANKED OUTPUT                   │
│ sidebar      │                                  │
│ (240px)      │  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │
│              │  01  Product name     ₹X,XXX     │
│ GOAL         │      Detail line      SCORE XX   │
│ LEVEL        │  ─────────────────────────────── │
│ FREQ         │  02  Product name     ₹X,XXX     │
│ DIET         │  ─────────────────────────────── │
│ BUDGET ←ₐ   │  03  Product name     ₹X,XXX     │
│              │                                  │
│ ▓▓▓▓▓▓▓ 96% │                                  │
└──────────────┴──────────────────────────────────┘
```

### Results card list
```
Stacked cards, gap 1px, background #1A1612

Each card: grid, columns 40px 1fr auto, gap 20px, align-items center, padding 20px 24px

Rank 01 (featured):
  Background: #0A0802
  Rank number: DM Sans 300, 24px, #C8933A
  
Other ranks:
  Background: #000
  Rank number: DM Sans 300, 24px, #1A1612 (nearly invisible)

Product name: DM Sans 500, 14px, #E8E0D0
Detail line: DM Mono 9px, #3A3028, letter-spacing 0.5px, ALL CAPS, line-height 1.7

Price (right): DM Sans 300, 20px, #E8E0D0
Score (below price): DM Mono 8px, #C8933A, letter-spacing 1px — "SCORE 94 / 100"
```

### "Why this product" reasoning (optional expansion)
```
Expandable below each result card
Trigger: DM Mono 9px, #3A3028 — "VIEW REASONING ↓"
Expanded area: background #060402, padding 14px 24px, border-top 1px solid #0E0C08
Text: DM Sans 300, 12px, #5A5040, line-height 1.8
```

---

## Navigation bar (all screens)

```
Height: 52px
Background: #000
Border-bottom: 1px solid #1A1612
Padding: 0 40px
Position: sticky, top 0, z-index 10

Logo: "PICK·WISE"
  Font: DM Mono 500, 13px, letter-spacing 3px
  Body: #E8E0D0
  Middle dot: #C8933A

Right side (landing): links + CTA button
Right side (quiz):    progress bar segments
Right side (results): completion status text
```

---

## Micro-interactions & motion

```
Option selection:   instant — background + colour swap, no transition
Progress fill:      instant segment colour change
Button hover:       background #A07830 (slightly darker amber), 80ms ease
Back link hover:    color #6A5A40, 80ms ease
Result card hover:  background #080604, 80ms ease
```

**No other motion.** No entrance animations, no scroll effects, no skeleton loaders with pulses. If loading is needed, show a single line: `CALCULATING STACK_` in DM Mono amber with a blinking cursor.

---

## Error & empty states

```
Validation error (no option selected, button pressed):
  Below the options grid
  DM Mono 9px, #8A3030 (muted red), letter-spacing 1px
  Text: "SELECT AN OPTION TO CONTINUE"
  No icon, no border flash

Empty results:
  DM Sans 300, 18px, #5A5040
  "No results match your constraints."
  Below: DM Mono 9px, #3A3028 — "ADJUST BUDGET ← GO BACK"
```

---

## What this design language is NOT

- Not dark mode of a normal app — true black `#000` is intentional, not `#111` or `#1A1A1A`
- Not cyberpunk — no neon, no glow, no scan lines
- Not minimal-modern — the data density and monospace labels give it weight
- Not clinical — the amber warmth prevents it from feeling cold
- The aesthetic reference is a spacecraft instrument panel, not a SaaS dashboard

