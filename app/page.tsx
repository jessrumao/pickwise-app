import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const STEPS = [
  {
    title: "Answer a few questions",
    body: "A short questionnaire about your goals, diet, and lifestyle — most people finish in a couple of minutes.",
  },
  {
    title: "Get evidence-backed recommendations",
    body: "Every suggestion traces back to a real dosing rule and cited research — including a clear, calm \"not needed\" when that's the honest answer.",
  },
  {
    title: "See what fits your budget",
    body: "Recommendations are prioritized first; your budget only decides what's funded this month, never what gets suggested.",
  },
];

export default function LandingPage() {
  return (
    <main className="flex min-h-svh flex-col items-center">
      <div className="w-full max-w-2xl flex-1 px-6 py-16">
        <header className="mb-12 text-center">
          <p className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
            Pickwise
          </p>
          <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">
            Supplement advice that isn&apos;t trying to sell you something
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Tell us about your goals and diet. We&apos;ll tell you plainly what&apos;s worth
            taking, what isn&apos;t, and when it&apos;s better to just talk to a doctor.
          </p>
          <Button asChild size="lg" className="mt-8">
            <Link href="/intake">Get your recommendations</Link>
          </Button>
        </header>

        <section className="grid gap-4 sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <Card key={step.title}>
              <CardHeader>
                <p className="text-xs font-medium text-muted-foreground">Step {i + 1}</p>
                <CardTitle className="text-base">{step.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{step.body}</p>
              </CardContent>
            </Card>
          ))}
        </section>
      </div>

      <footer className="w-full border-t py-6 text-center text-xs text-muted-foreground">
        <Link href="/terms" className="underline">
          Terms
        </Link>
      </footer>
    </main>
  );
}
