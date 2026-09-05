// Package I owns the final copy for this (tasks/I-regulatory-and-writeup.md
// deliverable 1). Package I hadn't landed yet when this page was built, so
// this is placeholder copy written directly from that brief's own required
// coverage (not medical advice, not a diagnosis, not FDA/FSSAI-evaluated,
// escalation means see a doctor) — swap in Package I's real text here, in
// this one place, once it exists.
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
