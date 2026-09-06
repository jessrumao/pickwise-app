import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/site/site-header";

const PRINCIPLES = [
  {
    label: "01",
    title: "Recommend what's appropriate, not what's profitable",
    body: "The honest answer is sometimes “you don't need anything right now.” Pickwise is built to say that plainly, not bury it under a purchase flow.",
  },
  {
    label: "02",
    title: "Rules decide. Retrieval only explains.",
    body: "Every recommendation comes from a structured, expert-reviewed rule evaluated against your profile — never an AI improvising a dose. The evidence and citations are looked up after a decision is made, only to explain it.",
  },
  {
    label: "03",
    title: "Budget is a filter, never a bias",
    body: "Recommendations are priority-ordered first, price-blind. Your budget is applied after, to decide what's funded this round — it never decides what gets suggested in the first place.",
  },
];

export default function AboutPage() {
  return (
    <main className="flex min-h-svh flex-col">
      <SiteHeader />

      <section className="border-b border-border px-6 py-16 sm:px-10 sm:py-20">
        <p className="font-display text-[9px] font-semibold tracking-[0.2em] text-brand">
          ABOUT PICKWISE
        </p>
        <h1 className="mt-3 max-w-2xl font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
          A decision layer between you and the supplement aisle.
        </h1>
        <p className="mt-6 max-w-xl text-sm leading-relaxed font-light text-muted-foreground sm:text-base">
          Pickwise is an evidence-based supplement and nutrition decision engine, built
          India-first for generally healthy adults. Tell it your goals, diet, and lifestyle —
          it tells you plainly whether a supplement actually makes sense, and which one, backed
          by a real citation rather than an influencer&apos;s opinion.
        </p>
      </section>

      <section className="border-b border-border px-6 py-14 sm:px-10">
        <p className="font-display text-[9px] font-semibold tracking-[0.2em] text-brand">
          WHY THIS EXISTS
        </p>
        <h2 className="mt-3 max-w-2xl font-display text-2xl font-bold tracking-tight sm:text-3xl">
          Most supplement advice is an ad wearing a lab coat.
        </h2>
        <p className="mt-4 max-w-xl text-sm leading-relaxed font-light text-muted-foreground">
          Retailers, affiliates, and influencers all have a reason to tell you to buy something.
          Pickwise doesn&apos;t start from a product to sell — it starts from your actual profile,
          checks it against structured nutrition and safety data, and only then looks at what
          products would deliver the right dose. If nothing clears that bar, it says so.
        </p>
      </section>

      <section className="border-b border-border px-6 py-14 sm:px-10">
        <p className="font-display text-[9px] font-semibold tracking-[0.2em] text-brand">
          HOW A RECOMMENDATION IS MADE
        </p>
        <div className="mt-8 grid gap-px overflow-hidden border border-border bg-border sm:grid-cols-3">
          {PRINCIPLES.map((p) => (
            <div key={p.label} className="bg-card p-6">
              <p className="font-display text-[9px] tracking-[0.15em] text-muted-foreground">
                {p.label}
              </p>
              <h3 className="mt-4 font-display text-base font-bold leading-snug">{p.title}</h3>
              <p className="mt-2 text-sm leading-relaxed font-light text-muted-foreground">
                {p.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-b border-border px-6 py-14 sm:px-10">
        <p className="font-display text-[9px] font-semibold tracking-[0.2em] text-brand">
          WHERE THIS STANDS TODAY
        </p>
        <p className="mt-4 max-w-xl text-sm leading-relaxed font-light text-muted-foreground">
          This is a working build, not a finished product — a small, expert-reviewed knowledge
          base covering a deliberately narrow set of well-studied supplements, real product data
          for what&apos;s recommended, and a safety model that escalates to a real medical
          professional rather than guessing when something looks complicated. It gets more
          capable as the underlying evidence base grows, not by loosening what it&apos;s willing to
          say yes to.
        </p>
      </section>

      <section className="flex flex-1 flex-col items-start justify-center px-6 py-16 sm:px-10">
        <p className="font-display text-xl font-bold tracking-tight sm:text-2xl">
          See what it actually says about you.
        </p>
        <Button asChild size="lg" className="mt-6 font-display text-xs tracking-wide">
          <Link href="/intake">START ANALYSIS →</Link>
        </Button>
      </section>

      <footer className="border-t border-border px-6 py-6 text-center font-display text-[10px] tracking-wide text-muted-foreground sm:px-10">
        <Link href="/terms" className="hover:text-foreground">
          TERMS
        </Link>
      </footer>
    </main>
  );
}
