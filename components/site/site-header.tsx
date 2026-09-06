import Link from "next/link";
import { Button } from "@/components/ui/button";

// Shared top nav for Pickwise's product surfaces (landing, about, intake,
// results) -- not used by /chat or /terms, which keep their original look.
// Deliberately slim: logo + two links + one CTA, matching the reference
// mockup's nav (docs/design/pickwise_exmachina_v6.html) rather than a full
// app shell -- intake/results keep their own in-flow progress/status chrome
// beneath this.
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-border bg-background px-6 sm:px-10">
      <Link href="/" className="font-display text-lg font-extrabold tracking-widest">
        PICK<span className="text-brand">WISE</span>
      </Link>
      <nav className="flex items-center gap-6">
        <Link
          href="/about"
          className="hidden font-display text-xs tracking-wide text-muted-foreground hover:text-foreground sm:inline"
        >
          ABOUT
        </Link>
        <Button asChild size="sm" className="font-display text-xs tracking-wide">
          <Link href="/intake">START →</Link>
        </Button>
      </nav>
    </header>
  );
}
