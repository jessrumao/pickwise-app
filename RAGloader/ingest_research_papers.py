"""
Package F extension -- ingest the vetted, general supporting research papers
(RAGloader/content/research_papers/*.pdf) into Pinecone, alongside the
narrow, per-claim evidence ingest_claims.py handles.

WHY THIS IS A SEPARATE SCRIPT, NOT A MODE OF ingest_claims.py:
The claims corpus (data/claims/*.json) is the exact evidence a recommendation
policy cites -- lib/evidence.ts fetches it by exact vectorRefs id, never by
semantic search, because a recommendation's "why" must only ever show what
actually justified it (see the grade-laundering note in
tasks/F-pinecone-evidence-ingestion.md). This script ingests a DIFFERENT,
broader pool: real, vetted papers that were NOT necessarily what any policy
cited, meant to answer follow-up questions a user asks beyond the card's own
"why" panel (e.g. "is there other research on this").

THE evidenceTier TAG:
Every record this script creates (children, parents, and propositions
namespaces) gets one extra metadata field: evidenceTier="supplementary".
ingest_claims.py now tags its records evidenceTier="cited" the same way (see
that script's own change). A future Q&A retrieval tool can then filter
Pinecone queries by this field -- defaulting to "cited" only, widening to
include "supplementary" only when the cited-only search doesn't answer the
question or the user explicitly asks for more -- so a real, vetted, but
UNRELATED paper can never silently be presented as if it were the reason a
recommendation fired. This script does not build that retrieval tool; it
only makes the tag exist so that tool can rely on it.

DocumentConfig has no field for this (it's a fixed dataclass shared by every
package that touches myAI6_RAG.py, and changing it would ripple into every
existing ingested record's shape). So instead of touching the shared engine
file, this script does the normal process_and_upsert() ingest first, then
does a second, cheap pass per source using the SAME prefix-listing helper
(_collect_source_ids with deep=False) the codebase's own maintenance
utilities already use (see move_images_to_short_paths / index_stats in
myAI6_RAG.py) to find just-created record ids by "<source_name>::" prefix,
and calls index.update(..., set_metadata={"evidenceTier": "supplementary"})
on each -- a metadata-only patch, no re-embedding, no risk to the shared
pipeline other packages depend on.

Usage:
    cd RAGloader
    python ingest_research_papers.py                 # ingest every paper below
    python ingest_research_papers.py Kreider_2017_ISSN_Position_Stand_Creatine_Safety
                                                       # one paper only, by source_name

Required env vars (same as ingest_claims.py):
    PINECONE_API_KEY
    ANTHROPIC_API_KEY
    UNSTRUCTURED_API_KEY
Optional:
    PINECONE_INDEX_HOST, PINECONE_INDEX_NAME (defaults to "myai6")

Place the 25 PDFs in RAGloader/content/research_papers/ before running --
see the source_path in each DocumentConfig entry below.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from myAI6_RAG import PipelineConfig, DocumentConfig, process_and_upsert, _collect_source_ids
from pinecone import Pinecone

EVIDENCE_TIER = "supplementary"


def load_pipeline_config() -> PipelineConfig:
    required = ("PINECONE_API_KEY", "ANTHROPIC_API_KEY", "UNSTRUCTURED_API_KEY")
    missing = [v for v in required if not os.environ.get(v)]
    if missing:
        raise SystemExit(f"Missing required env var(s): {', '.join(missing)}.")

    index_name = os.environ.get("PINECONE_INDEX_NAME", "myai6")
    index_host = os.environ.get("PINECONE_INDEX_HOST")
    if not index_host:
        pc = Pinecone(api_key=os.environ["PINECONE_API_KEY"])
        try:
            index_host = pc.describe_index(index_name).host
        except Exception as e:
            raise SystemExit(f"Could not resolve host for Pinecone index '{index_name}': {e}")

    return PipelineConfig(
        pinecone_api_key=os.environ["PINECONE_API_KEY"],
        pinecone_index_host=index_host,
        pinecone_index_name=index_name,
        anthropic_api_key=os.environ["ANTHROPIC_API_KEY"],
        unstructured_api_key=os.environ["UNSTRUCTURED_API_KEY"],
    )


# ── Documents (source path + citation metadata for each vetted paper) ─────
# Carried over as-is from Claude outputs/documents_block.py, generated
# earlier from the PDFs in this folder. One duplicate PDF
# ("s12970-019-0270-2 (1).pdf") is intentionally excluded -- same paper as
# "s12970-019-0270-2.pdf".

documents = [

    ("./content/research_papers/1-s2.0-S0899900704001169-main.pdf",
     DocumentConfig(
         source_name="Jeukendrup_2004_Carbohydrate_Intake_During_Exercise",
         source_description="Jeukendrup, A.E. (2004). Carbohydrate Intake During Exercise and Performance. Nutrition, 20(7-8), 669-677.",
         source_url="",
         content_type="research_paper",
     )),

    ("./content/research_papers/1-s2.0-S1568163725003113-main.pdf",
     DocumentConfig(
         source_name="Wang_2026_Multivitamin_Mineral_Rapid_Review",
         source_description="Wang, W., Wazny, V.K., Mahadzir, M.D.A., Maier, A.B. (2026). Multivitamin and mineral use: A rapid review of meta-analyses on health outcomes. Ageing Research Reviews, 114, 102965.",
         source_url="",
         content_type="research_paper",
     )),

    ("./content/research_papers/1-s2.0-S2451847620300968-main.pdf",
     DocumentConfig(
         source_name="Mohammadpour_2020_Glucomannan_Weight_Loss_MetaAnalysis",
         source_description="Mohammadpour, S. et al. (2020). Effects of glucomannan supplementation on weight loss in overweight and obese adults: A systematic review and meta-analysis of RCTs. Obesity Medicine, 19, 100276.",
         source_url="",
         content_type="research_paper",
     )),

    ("./content/research_papers/12970_2015_Article_104.pdf",
     DocumentConfig(
         source_name="Wankhede_2015_Ashwagandha_Muscle_Strength_Recovery",
         source_description="Wankhede, S., Langade, D., Joshi, K., Sinha, S.R., Bhattacharyya, S. (2015). Examining the effect of Withania somnifera supplementation on muscle strength and recovery: a randomized controlled trial. JISSN, 12:43.",
         source_url="https://doi.org/10.1186/s12970-015-0104-9",
         content_type="research_paper",
     )),

    ("./content/research_papers/12970_2017_Article_173.pdf",
     DocumentConfig(
         source_name="Kreider_2017_ISSN_Position_Stand_Creatine_Safety",
         source_description="Kreider, R.B. et al. (2017). International Society of Sports Nutrition position stand: safety and efficacy of creatine supplementation in exercise, sport, and medicine. JISSN, 14:18.",
         source_url="https://doi.org/10.1186/s12970-017-0173-z",
         content_type="research_paper",
     )),

    ("./content/research_papers/40279_2023_Article_1822.pdf",
     DocumentConfig(
         source_name="Trommelen_2023_PreSleep_Protein_Mitochondrial_Synthesis",
         source_description="Trommelen, J. et al. (2023). Pre-sleep Protein Ingestion Increases Mitochondrial Protein Synthesis Rates During Overnight Recovery from Endurance Exercise: A RCT. Sports Medicine, 53, 1445-1455.",
         source_url="https://doi.org/10.1007/s40279-023-01822-3",
         content_type="research_paper",
     )),

    ("./content/research_papers/726_2021_Article_3072.pdf",
     DocumentConfig(
         source_name="Khatri_2021_Collagen_Peptide_Body_Composition_Recovery",
         source_description="Khatri, M., Naughton, R.J., Clifford, T., Harper, L.D., Corr, L. (2021). The effects of collagen peptide supplementation on body composition, collagen synthesis, and recovery from joint injury and exercise: a systematic review. Amino Acids, 53, 1493-1506.",
         source_url="https://doi.org/10.1007/s00726-021-03072-x",
         content_type="research_paper",
     )),

    ("./content/research_papers/726_2024_Article_3420.pdf",
     DocumentConfig(
         source_name="Abbasi_2024_Glutamine_Gut_Permeability_MetaAnalysis",
         source_description="Abbasi, F. et al. (2024). A systematic review and meta-analysis of clinical trials on the effects of glutamine supplementation on gut permeability in adults. Amino Acids, 56, 60.",
         source_url="https://doi.org/10.1007/s00726-024-03420-7",
         content_type="research_paper",
     )),

    ("./content/research_papers/Creatine_Supplementation_Increases_Total_Body_Wate.pdf",
     DocumentConfig(
         source_name="Powers_2003_Creatine_Total_Body_Water",
         source_description="Powers, M.E., Arnold, B.L., Weltman, A.L., Perrin, D.H., Mistry, D., Kahler, D.M., Kraemer, W., Volek, J. (2003). Creatine Supplementation Increases Total Body Water Without Altering Fluid Distribution. Journal of Athletic Training, 38(1), 44-50.",
         source_url="",
         content_type="research_paper",
     )),

    ("./content/research_papers/Effects_of_Citrulline_Malate_Supplementation_on_Ex.pdf",
     DocumentConfig(
         source_name="Wang_2026_Citrulline_Malate_Exercise_Performance",
         source_description="Wang, X. et al. (2026). Effects of Citrulline Malate Supplementation on Exercise Performance: A Systematic Review and Three-Level Meta-Analysis.",
         source_url="",
         content_type="research_paper",
     )),

    ("./content/research_papers/Effects_of_plant-_versus_animal-based_proteins_on_.pdf",
     DocumentConfig(
         source_name="Mendes_2025_Plant_vs_Animal_Protein_Muscle_Synthesis",
         source_description="Mendes, B.R., Correia, J.M., Santos, I., Schoenfeld, B.J., Swinton, P.A., Mendonca, G.V. (2025). Effects of plant- versus animal-based proteins on muscle protein synthesis: A systematic review with meta-analysis. SportRxiv preprint (not peer reviewed).",
         source_url="",
         content_type="research_paper",
     )),

    ("./content/research_papers/Journal of Pineal Research - 2024 - Cruz‐Sanabria - Optimizing the Time and Dose of Melatonin as a Sleep‐Promoting Drug  A.pdf",
     DocumentConfig(
         source_name="Cruz_Sanabria_2024_Melatonin_Time_Dose_Sleep",
         source_description="Cruz-Sanabria, F. et al. (2024). Optimizing the Time and Dose of Melatonin as a Sleep-Promoting Drug: A Systematic Review of RCTs and Dose-Response Meta-Analysis. Journal of Pineal Research.",
         source_url="",
         content_type="research_paper",
     )),

    ("./content/research_papers/RSSN_20_2263409.pdf",
     DocumentConfig(
         source_name="Ferrando_2023_ISSN_Position_Stand_EAA_Skeletal_Muscle",
         source_description="Ferrando, A.A. et al. (2023). International Society of Sports Nutrition position stand: essential amino acid supplementation on skeletal muscle and performance. JISSN, 20(1), 2263409.",
         source_url="https://doi.org/10.1080/15502783.2023.2263409",
         content_type="research_paper",
     )),

    ("./content/research_papers/fnut-11-1424972.pdf",
     DocumentConfig(
         source_name="Xu_2024_Creatine_Cognitive_Function_MetaAnalysis",
         source_description="Xu, C., Bi, S., Zhang, W., Luo, L. (2024). The effects of creatine supplementation on cognitive function in adults: a systematic review and meta-analysis. Frontiers in Nutrition, 11:1424972.",
         source_url="https://doi.org/10.3389/fnut.2024.1424972",
         content_type="research_paper",
     )),

    ("./content/research_papers/fnut-12-1645346.pdf",
     DocumentConfig(
         source_name="Wang_2025_Rhodiola_Rosea_Endurance_Performance",
         source_description="Wang, X., Yang, X., Gao, Z., Zeng, J., Liu, Y. (2025). The effect of Rhodiola rosea supplementation on endurance performance and related biomarkers: a systematic review and meta-analysis. Frontiers in Nutrition, 12:1645346.",
         source_url="https://doi.org/10.3389/fnut.2025.1645346",
         content_type="research_paper",
     )),

    ("./content/research_papers/i1062-6050-56-11-1213.pdf",
     DocumentConfig(
         source_name="Lagowska_2021_Probiotic_Supplementation_Athletes_URTI",
         source_description="Lagowska, K., Bajerska, J. (2021). Probiotic Supplementation and Respiratory Infection and Immune Function in Athletes: Systematic Review and Meta-Analysis of RCTs. Journal of Athletic Training, 56(11), 1213-1223.",
         source_url="https://doi.org/10.4085/592-20",
         content_type="research_paper",
     )),

    ("./content/research_papers/nss-17-2027.pdf",
     DocumentConfig(
         source_name="Schuster_2025_Magnesium_Bisglycinate_Sleep_RCT",
         source_description="Schuster, J., Cycelskij, I., Lopresti, A., Hahn, A. Magnesium Bisglycinate Supplementation in Healthy Adults Reporting Poor Sleep: A Randomized, Placebo-Controlled Trial. Nature and Science of Sleep.",
         source_url="",
         content_type="research_paper",
     )),

    ("./content/research_papers/nutrients-16-02044.pdf",
     DocumentConfig(
         source_name="Fernandez_Lazaro_2024_Omega3_PostExercise_Inflammation",
         source_description="Fernandez-Lazaro, D. et al. Omega-3 Fatty Acid Supplementation on Post-Exercise Inflammation, Muscle Damage, Oxidative Response, and Sports Performance: A Systematic Review of RCTs. Nutrients.",
         source_url="",
         content_type="research_paper",
     )),

    ("./content/research_papers/nutrients-17-01958.pdf",
     DocumentConfig(
         source_name="Tian_2025_Beetroot_Juice_Physical_Performance_Umbrella",
         source_description="Tian, C., Jiang, Q., Han, M., Guo, L., Huang, R., Zhao, L., Mao, S. (2025). Effects of Beetroot Juice on Physical Performance in Professional Athletes and Healthy Individuals: An Umbrella Review. Nutrients, 17(12), 1958.",
         source_url="",
         content_type="research_paper",
     )),

    ("./content/research_papers/nutrients-17-02579.pdf",
     DocumentConfig(
         source_name="Ji_2025_Whey_Protein_MPS_AKT_mTOR",
         source_description="Ji, X., Ye, X., Ji, S., Zhang, S., Wang, Y., Zhou, Z., Xiang, D., Luo, B. (2025). Whey Protein Supplementation Combined with Exercise on Muscle Protein Synthesis and the AKT/mTOR Pathway in Healthy Adults: A Systematic Review and Meta-Analysis. Nutrients.",
         source_url="",
         content_type="research_paper",
     )),

    ("./content/research_papers/nutrients-18-01989.pdf",
     DocumentConfig(
         source_name="Martins_2026_Caffeine_DoseResponse_Aerobic_Performance",
         source_description="Martins, G.L. et al. (2026). Dose-Response Effect of Oral Caffeine Use on Aerobic Exercise Performance: A Systematic Review and Meta-Analysis. Nutrients, 18(9), 1989.",
         source_url="",
         content_type="research_paper",
     )),

    ("./content/research_papers/nutrients-18-01992-v2.pdf",
     DocumentConfig(
         source_name="Lloret_Gil_2026_Curcumin_Exercise_Recovery",
         source_description="Lloret-Gil, J., Victoria-Montesinos, D., Martinez-Noguera, F.J. (2026). Effects of Curcumin Supplementation on Exercise Recovery, Oxidative Stress, Inflammation, Muscle Damage, and Performance in Exercise and Sport Contexts: A Systematic Review. Nutrients, 18(9), 1992.",
         source_url="",
         content_type="research_paper",
     )),

    ("./content/research_papers/s00726-011-1200-z.pdf",
     DocumentConfig(
         source_name="Hobson_2012_Beta_Alanine_Exercise_Performance_MetaAnalysis",
         source_description="Hobson, R.M., Saunders, B., Ball, G., Harris, R.C., Sale, C. (2012). Effects of beta-alanine supplementation on exercise performance: a meta-analysis. Amino Acids, 43, 25-37.",
         source_url="https://doi.org/10.1007/s00726-011-1200-z",
         content_type="research_paper",
     )),

    ("./content/research_papers/s12967-024-05434-x.pdf",
     DocumentConfig(
         source_name="Tarsitano_2024_Magnesium_Supplementation_Muscle_Soreness",
         source_description="Tarsitano, M.G., Quinzi, F., Folino, K., Greco, F., Oranges, F.P., Cerulli, C., Emerenziani, G.P. (2024). Effects of magnesium supplementation on muscle soreness in different type of physical activities: a systematic review. Journal of Translational Medicine, 22, 629.",
         source_url="https://doi.org/10.1186/s12967-024-05434-x",
         content_type="research_paper",
     )),

    # NOTE: "s12970-019-0270-2 (1).pdf" is a duplicate of the file below -- only one is included.
    ("./content/research_papers/s12970-019-0270-2.pdf",
     DocumentConfig(
         source_name="Keller_2019_Shilajit_Fatigue_Muscular_Strength",
         source_description="Keller, J.L., Housh, T.J., Hill, E.C., Smith, C.M., Schmidt, R.J., Johnson, G.O. (2019). The effects of Shilajit supplementation on fatigue-induced decreases in muscular strength and serum hydroxyproline levels. JISSN, 16:3.",
         source_url="https://doi.org/10.1186/s12970-019-0270-2",
         content_type="research_paper",
     )),

    ("./content/research_papers/the-effects-of-green-tea-extract-supplementation-on-body-composition-obesity-related-hormones-and-oxidative-stress-markers-a-grade-assessed-systematic-review-and-dose-response-meta-analysis-of-randomi.pdf",
     DocumentConfig(
         source_name="Asbaghi_2024_Green_Tea_Extract_Body_Composition_MetaAnalysis",
         source_description="Asbaghi, O. et al. (2024). The effects of green tea extract supplementation on body composition, obesity-related hormones and oxidative stress markers: a GRADE-assessed systematic review and dose-response meta-analysis of RCTs. British Journal of Nutrition, 131, 1125-1157.",
         source_url="https://doi.org/10.1017/S000711452300260X",
         content_type="research_paper",
     )),

]


def tag_evidence_tier(pcfg: PipelineConfig, source_name: str, tier: str = EVIDENCE_TIER):
    """Metadata-only patch (no re-embedding): sets evidenceTier on every
    record -- children, parents, propositions -- belonging to source_name.
    Cheap: uses the same prefix-listing helper the codebase's own maintenance
    utilities use, not a full-index scan."""
    index = Pinecone(api_key=pcfg.pinecone_api_key).Index(host=pcfg.pinecone_index_host)
    cfg = pcfg.cfg
    total = 0
    for ns in (cfg["pinecone_ns_children"], cfg["pinecone_ns_parents"], cfg["pinecone_ns_propositions"]):
        ids = _collect_source_ids(index, ns, source_name, deep=False)
        for vid in ids:
            index.update(id=vid, set_metadata={"evidenceTier": tier}, namespace=ns)
        total += len(ids)
    return total


def main():
    only = set(sys.argv[1:]) or None  # optional list of source_names to limit to

    pcfg = load_pipeline_config()
    todo = [(p, c) for p, c in documents if not only or c.source_name in only]
    if not todo:
        raise SystemExit("No matching documents (check the source_name spelling against the list in this file).")

    ingested, tagged, failed = 0, 0, 0
    for source_path, doc_config in todo:
        print(f"\n{'#' * 60}\n# {doc_config.source_name}\n{'#' * 60}\n")
        try:
            process_and_upsert(pcfg, source_path, doc_config, enrich=True, decompose=True)
        except Exception as e:
            print(f"   FAILED: {e}")
            failed += 1
            continue
        ingested += 1
        n = tag_evidence_tier(pcfg, doc_config.source_name)
        print(f"   evidenceTier='{EVIDENCE_TIER}' set on {n} records")
        tagged += n

    print(f"\nDone. {ingested} paper(s) ingested, {failed} failed, {tagged} records tagged evidenceTier='{EVIDENCE_TIER}'.")


if __name__ == "__main__":
    main()
