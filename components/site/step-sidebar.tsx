// Shared between the intake flow and /results — the whole profile ->
// recommendations journey is one continuous stepped flow, not "the app"
// (intake) followed by a differently-styled page (results). /results uses
// this with currentIndex pointing at its own appended "Recommendations"
// step, one past intake's own labels (lib/intake/schema.ts's SIDEBAR_LABELS),
// with every earlier step showing as done.

// Segmented progress row — one tick per step, filled up to the current one.
export function StepProgressBar({ total, currentIndex }: { total: number; currentIndex: number }) {
  return (
    <div className="flex gap-[3px] border-b border-border px-6 py-3 sm:px-10">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-[3px] flex-1 rounded-sm ${
            i < currentIndex ? "bg-brand" : i === currentIndex ? "bg-brand/40" : "bg-border"
          }`}
        />
      ))}
    </div>
  );
}

export function StepSidebar({ labels, currentIndex }: { labels: string[]; currentIndex: number }) {
  return (
    <aside className="hidden border-r border-border bg-[#0F0F0F] px-6 py-8 text-[#F2F2F0] md:block">
      <p className="mb-6 font-display text-[9px] tracking-[0.2em] text-[#2A3A4A]">
        ANALYSIS STEPS
      </p>
      <ol className="space-y-0">
        {labels.map((label, i) => {
          const state = i === currentIndex ? "current" : i < currentIndex ? "done" : "upcoming";
          return (
            <li
              key={i}
              className="flex items-center gap-3 border-b border-[#141414] py-3 last:border-b-0"
            >
              <span
                className={`font-display text-[10px] tracking-wide ${
                  state === "current" ? "text-brand" : state === "done" ? "text-[#3A4A5A]" : "text-[#2A3A4A]"
                }`}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <span
                className={`font-display text-xs ${
                  state === "current" ? "text-[#F2F2F0]" : "text-[#2A3A4A]"
                }`}
              >
                {label}
              </span>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}
