"""
Package F -- turn each data/claims/*.json record into a clean markdown document
under RAGloader/content/claims/, ready for the RAGloader pipeline. Re-run this
whenever a claim's statement, rationale, or citations change (typically after
Package A adds/edits a claim), then re-run ingest_claims.py to re-embed and
refresh Pinecone + that claim's vectorRefs.

No credentials needed -- this is a pure local JSON -> markdown transform.
"""
import json
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
CLAIMS_DIR = REPO_ROOT / "data" / "claims"
OUT_DIR = Path(__file__).resolve().parent / "content" / "claims"


def render(claim: dict) -> str:
    lines = [f"# {claim['id']}", ""]
    lines.append(f"**Subject:** {claim['subject']['type']} -- {claim['subject']['id']}  ")
    lines.append(f"**Outcome:** {claim['outcomeId']}  ")
    lines.append(f"**Population:** {claim['population']['description']}  ")
    direction = claim.get("direction", "")
    magnitude = claim.get("magnitude", "")
    lines.append(f"**Direction / magnitude:** {direction} / {magnitude}  ")
    lines.append(f"**Evidence grade:** {claim['grade']}")
    lines.append("")
    lines.append("## Statement")
    lines.append("")
    lines.append(claim["statement"])
    lines.append("")

    rationale = claim.get("gradeRationale") or {}
    if rationale:
        lines.append("## Grade rationale")
        lines.append("")
        if rationale.get("designs"):
            lines.append(f"- Study designs: {', '.join(rationale['designs'])}")
        if rationale.get("consistency"):
            lines.append(f"- Consistency: {rationale['consistency']}")
        if rationale.get("directness"):
            lines.append(f"- Directness: {rationale['directness']}")
        if rationale.get("note"):
            lines.append(f"- Note: {rationale['note']}")
        lines.append("")

    dose = claim.get("doseResponse") or {}
    if dose.get("summary"):
        lines.append("## Dose response")
        lines.append("")
        lines.append(dose["summary"])
        lines.append("")

    lines.append("## Citations")
    lines.append("")
    for c in claim.get("citations", []):
        year = f", {c['year']}" if c.get("year") else ""
        lines.append(f"- {c['title']} -- {c['source']}{year}. {c['url']}")
    lines.append("")
    return "\n".join(lines)


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    claim_files = sorted(CLAIMS_DIR.glob("*.json"))
    if not claim_files:
        raise SystemExit(f"No claim files found in {CLAIMS_DIR}")

    for path in claim_files:
        claim = json.loads(path.read_text())
        out_path = OUT_DIR / f"{claim['id']}.md"
        out_path.write_text(render(claim))
        print(f"wrote {out_path.relative_to(REPO_ROOT)}")

    print(f"\n{len(claim_files)} claim documents written to {OUT_DIR.relative_to(REPO_ROOT)}")


if __name__ == "__main__":
    main()
