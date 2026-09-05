// Package I's final copy (tasks/I-regulatory-and-writeup.md deliverable 1;
// full context in docs/regulatory-and-deferral-writeup.md §1). Kept
// word-for-word identical to that doc so the two never drift.
export function Disclaimer() {
  return (
    <p className="text-xs text-muted-foreground border-t pt-4">
      <strong>Not medical advice.</strong> This tool suggests supplements based on the
      information you provided and published evidence — it does not diagnose any condition and
      is not a substitute for a doctor. The supplements and claims shown here are not evaluated
      by FSSAI or the FDA for the specific benefits described. Where this tool says to talk to a
      doctor first, that means exactly that — please don&apos;t start or stop anything based on
      this page alone.
    </p>
  );
}
