import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/site/site-header";

const STEPS = [
  {
    n: "01",
    title: "Answer a few questions",
    body: "A short questionnaire about your goals, diet, and lifestyle — most people finish in a couple of minutes.",
  },
  {
    n: "02",
    title: "Get evidence-backed recommendations",
    body: "Every suggestion traces back to a real dosing rule and cited research — including a clear, calm “not needed” when that's the honest answer.",
  },
  {
    n: "03",
    title: "See what fits your budget",
    body: "Recommendations are prioritized first; your budget only decides what's funded this month, never what gets suggested.",
  },
];

const TRUST_ITEMS = [
  "No sponsored placements",
  "Budget applied after recommendations, never before",
  "Says no when nothing's needed",
  "Every “why” traces to a real citation",
];

export default function LandingPage() {
  return (
    <main className="flex min-h-svh flex-col">
      <SiteHeader />

      <section className="grid border-b border-border md:grid-cols-5">
        <div className="border-b border-border px-6 py-14 sm:px-10 sm:py-20 md:col-span-3 md:border-b-0 md:border-r">
          <p className="flex items-center gap-2 font-display text-[9px] font-medium tracking-[0.2em] text-muted-foreground">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand" />
            PICKWISE · RECOMMENDATION ENGINE ACTIVE
          </p>
          <h1 className="mt-6 font-display text-4xl font-extrabold leading-[0.95] tracking-tight sm:text-6xl">
            SUPPLEMENT ADVICE
            <br />
            THAT ISN&apos;T <span className="text-brand">SELLING YOU</span>
            <br />
            SOMETHING.
          </h1>
          <p className="mt-7 max-w-md text-sm leading-relaxed font-light text-muted-foreground sm:text-base">
            Tell us about your goals and diet. We&apos;ll tell you plainly what&apos;s worth
            taking, what isn&apos;t, and when it&apos;s better to just talk to a doctor.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Button asChild size="lg" className="font-display text-xs tracking-wide">
              <Link href="/intake">GET YOUR RECOMMENDATIONS →</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="font-display text-xs tracking-wide">
              <Link href="/about">HOW IT WORKS</Link>
            </Button>
          </div>
        </div>

        <div className="flex flex-col justify-between gap-8 bg-[#0A0A0A] px-8 py-10 text-[#F2F2F0] md:col-span-2">
          <div className="space-y-1 font-mono text-[11px] leading-loose">
            <p>
              <span className="text-brand">SYS</span>&nbsp;&nbsp;Engine status:{" "}
              <span className="text-brand">ONLINE</span>
            </p>
            <p>
              <span className="text-brand">ALG</span>&nbsp;&nbsp;Budget-blind scoring:{" "}
              <span className="text-brand">ACTIVE</span>
            </p>
            <p>
              <span className="text-brand">SAFE</span>&nbsp;Escalation gate:{" "}
              <span className="text-brand">ACTIVE</span>
            </p>
            <p className="text-[#3A4A5A]">
              <span className="text-brand">USR</span>&nbsp;&nbsp;Profile: AWAITING INPUT
            </p>
            <p className="text-[#3A4A5A]">
              <span className="text-brand">REC</span>&nbsp;&nbsp;Recommendations: PENDING_
            </p>
          </div>
          <p className="font-display text-[9px] tracking-[0.15em] text-[#3A4A5A]">
            NO SPONSORED PLACEMENTS · RULES, NOT AN LLM, DECIDE
          </p>
        </div>
      </section>

      <div className="flex flex-col divide-y divide-border border-b border-border sm:flex-row sm:divide-x sm:divide-y-0">
        {TRUST_ITEMS.map((item) => (
          <div
            key={item}
            className="flex flex-1 items-center gap-2 px-6 py-3 font-display text-[11px] tracking-wide text-muted-foreground sm:px-5"
          >
            <span className="h-[5px] w-[5px] shrink-0 rounded-full bg-brand" />
            {item}
          </div>
        ))}
      </div>

      <section className="px-6 py-14 sm:px-10">
        <div className="mb-9 flex items-end justify-between">
          <div>
            <p className="font-display text-[9px] font-semibold tracking-[0.2em] text-brand">
              HOW IT WORKS
            </p>
            <h2 className="mt-2 font-display text-2xl font-bold tracking-tight sm:text-3xl">
              Three steps, no guesswork
            </h2>
          </div>
        </div>
        <div className="grid gap-px overflow-hidden border border-border bg-border sm:grid-cols-3">
          {STEPS.map((step) => (
            <div key={step.n} className="bg-card p-6">
              <p className="font-display text-[9px] tracking-[0.2em] text-muted-foreground">
                STEP {step.n}
              </p>
              <h3 className="mt-4 font-display text-base font-bold leading-snug">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed font-light text-muted-foreground">
                {step.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border px-6 py-6 text-center font-display text-[10px] tracking-wide text-muted-foreground sm:px-10">
        <Link href="/terms" className="hover:text-foreground">
          TERMS
        </Link>
      </footer>
    </main>
  );
}
