# Axis 06 — Critical Q-Methodology Validity

**Date:** 2026-04-25
**Auditor:** Claude (Sonnet 4.6) — deep pass
**Entry point:** `backend/app/services/analysis_service.py:684 run_analysis()`
**Datasets analysed:** 4 non-degenerate runs (lipset placeholder excluded per INVENTORY note)
**Layer 2 mode:** Textbook reference (degraded — R not installed, qmethod-R comparison not feasible)
**Literature consulted:** Sneegas 2020, Robbins & Krueger 2000, Stainton Rogers 1997, Stenner 2011, Watts & Stenner 2012, Zabala 2014

---

## Layer 1 — Multi-dataset sanity summary

All four non-degenerate datasets ran without error. Key observations:

| Dataset | Outcome | Notes |
|---------|---------|-------|
| `reference-bipolar-2f-pca-varimax` | PASS | Clean bipolar structure; 4+4 flagged; 6 distinguishing, 3 consensus |
| `reference-bipolar-2f-centroid-varimax` | PASS | Factor 1 sign reversed vs PCA (expected). 8 distinguishing vs 6 for PCA — interpretively different |
| `reference-bipolar-2f-pca-none` | PASS | No rotation: all 8 flag on F1, F2 has zero flags; empty distinguishing table (valid, expected) |
| `confounded-lowvar-2f-pca-varimax` | PASS | 5 flagged on F1, 1 on F2; only 2 distinguishing statements (expected for near-identical data) |

All correlation matrix values bounded [-1,1], symmetric, unit diagonal. Eigenvalues sum to n_participants (8). All runs completed within tolerance.

## Layer 2 — Textbook reference verification (degraded mode)

R and the qmethod package are not installed on this system (confirmed: `which Rscript` → not found). Cross-tool comparison against Zabala (2014) reference values is not feasible in this audit. Degraded fallback used: manual verification against textbook formulas (Brown 1980, Watts & Stenner 2012).

Results for `reference-bipolar-2f-pca-varimax`:

| Check | Result |
|-------|--------|
| Correlation matrix: bounded, symmetric, unit diagonal | PASS |
| Eigenvalues sum to n_participants (8.0000) | PASS |
| Communalities preserved across orthogonal rotation | PASS (exact match) |
| Total variance preserved across rotation (7.7116 both sides) | PASS |
| Flagging: `\|load\| > 1.96/sqrt(9)=0.6533` AND `load² > Σ(others²)` | PASS (all 8 participants verified) |
| Z-scores: mean≈0, std≈1 per factor | PASS (mean=0.000000, std=1.000000) |
| Factor arrays use correct forced distribution [-2,-1,-1,0,0,0,1,1,2] | PASS |
| Cross-tool comparison vs qmethod-R | NOT FEASIBLE — see F-06-009 |

## Layer 3 — Interpretive stability test

Varied one parameter at a time on `reference-bipolar-2f-pca-varimax`. Results saved in `.raw/qmethod-stability-*.json`.

**Flagging threshold variation (0.30, 0.40, 0.50 vs auto=0.653):**
All three custom thresholds yield identical flagging as the auto threshold on this dataset (all rotated loadings are either ≥0.61 or ≤0.44 — no participant sits in the 0.30–0.65 ambiguous zone). Distinguishing and consensus statements unchanged. This is specific to this highly polarised dataset; real studies with loadings in the 0.30–0.65 range would show sensitivity.

**n_factors variation (2 vs 3):**
Adding a third factor: Factor 3 receives 0 flagged sorts (eigenvalue=0.145, below Kaiser threshold). The distinguishing/consensus statement classification is identical to the 2-factor solution. The third factor is statistically inert on this dataset but is silently computed and returned without warning.

---

## Findings

### F-06-001 : Analysis results not persisted — no audit trail of analytical choices

- **Severity:** major
- **Audience:** [SoftwareX] [Prod]
- **Location:** `backend/app/routers/admin/analysis.py:98` (entire `/analysis/run` endpoint), `backend/app/models.py` (no `AnalysisRun` model)
- **Observation:** Each call to `POST /analysis/run` computes a new result from scratch and returns it transiently. There is no `AnalysisRun` database model, no persistence of analytical parameters (extraction method, rotation, flagging mode, n_factors, flagging threshold), and no timestamp or user identity recorded. If a researcher runs 10 analyses with varying parameters and navigates away, the choices and results are lost with no trace. URL search params (`?extraction=pca&nFactors=2&rotation=varimax&flagging=auto`) provide session-level persistence in the browser but nothing survives across sessions or devices.
- **Impact:** For critical Q-methodology, the audit trail of analytical choices is a methodological requirement. Sneegas (2020, p.7) argues that "the moments of category formation — where the researcher extracts a factor array, names it, and interprets it — researchers are active participants in the creation and framing of the perspectives." Without persistence, the researcher cannot document which parameters led to which interpretation, cannot share exact analysis configurations with co-researchers, and the SoftwareX manuscript cannot cite a reproducible computational procedure. For collaborative studies with multiple `editor`-role users, there is no way to know who ran which analysis.
- **Recommendation:** Add an `AnalysisRun` model with columns: `study_id`, `user_id`, `run_at`, `extraction`, `rotation`, `n_factors`, `flagging_mode`, `flagging_threshold`, `result_json` (nullable JSONB). Persist on each run. Expose as `GET /{slug}/analysis/history`. Minimum viable: persist the latest run per study (single row, upsert). Full version: retain history with timestamps.
- **Effort:** M (model + migration + endpoint; no UI required for minimal version)

---

### F-06-002 : No judgmental (manual) rotation support

- **Severity:** major
- **Audience:** [SoftwareX] [Prod]
- **Location:** `backend/app/services/analysis_service.py:739`, `backend/app/schemas/analysis.py:13`
- **Observation:** The `rotation` parameter accepts only `"varimax"` or `"none"`. No judgmental (hand) rotation is implemented. `AnalysisRequest.validate_rotation()` explicitly rejects any other value. The Layer 1 inventory confirmed this: "Rotation: Varimax only. No manual (judgmental) rotation exposed to users."
- **Impact:** Judgmental rotation is central to critical Q practice. Stainton Rogers (1997, "Going Critical") and Watts & Stenner (2012, §5) both emphasise that the researcher's active participation in rotation decisions is methodologically significant — it is one of the moments where reflexivity is exercised. Varimax is a purely mathematical optimisation criterion (Kaiser 1958); it maximises simple structure regardless of theoretical salience. A researcher studying environmental subjectivity (as in Ormerod 2019, Robbins & Krueger 2000) may need to rotate factors toward a theoretically coherent pole that varimax does not naturally produce. Libre-Q's restriction to varimax-only constrains critical Q practice and prevents the kind of researcher-mediated analytical choices that distinguish critical from classical Q.
- **Recommendation:** Implement at a minimum a "centroid target" rotation UI: after varimax is applied, allow the researcher to manually adjust factor loadings via a rotation matrix (even a simple 2D angle slider for 2-factor solutions). The backend already exposes `unrotated_loadings`; a custom rotation matrix `R` can be applied as `rotated = unrotated @ R`. Document in the SoftwareX manuscript as a known gap for the current release, framed as a future roadmap item.
- **Effort:** L (backend: rotation matrix application is simple; frontend: rotation UI is non-trivial)

---

### F-06-003 : Flagging threshold hardcoded and not user-adjustable

- **Severity:** major
- **Audience:** [SoftwareX] [Prod]
- **Location:** `backend/app/services/analysis_service.py:354`
- **Observation:** `flag_sorts()` uses a fixed threshold of `1.96 / sqrt(n_statements)` (p<0.05 two-tailed). This value is not configurable via the API (`AnalysisRequest` has no `flagging_threshold` field), not displayed to users before they run the analysis (only shown in `FactorLoadingsTable` after the result is returned), and not included in any export. Researchers cannot change this value even if they have theoretical or methodological reasons to use a different cut-off.
- **Impact:** Watts & Stenner (2012) discuss flagging as a researcher choice involving judgment. Zabala (2014) notes that the p<0.05 threshold is conventional but not sacrosanct. For small Q-sets (e.g. 9 statements), the threshold is 0.653 — very high, meaning many participants with genuine factor membership may be excluded. For larger Q-sets (36 statements), it drops to 0.327, creating sensitivity differences. Since the threshold is invisible to the researcher in the request (only shown post-hoc), they may not realize that their analysis parameters differ from another study's parameters. The Layer 3 stability test showed that on the reference bipolar dataset, thresholds 0.30–0.50 all produce identical results — but this is only because the dataset is extremely polarised. Real studies with moderate loadings are sensitive to this choice.
- **Recommendation:** Add `flagging_threshold: float | None = None` to `AnalysisRequest`. If provided and `flagging='auto'`, use as the significance cutoff; if `None`, default to `1.96/sqrt(n_statements)`. Expose the computed threshold in `AnalysisResult`. Include in all exports (XLSX overview sheet, CSV metadata row). Cost: S for backend; S for schema; S for frontend help text update.
- **Effort:** S

---

### F-06-004 : `av_rel_coef` hardcoded at 0.8, not exposed to user

- **Severity:** minor
- **Audience:** [SoftwareX] [Prod]
- **Location:** `backend/app/services/analysis_service.py:486`, call at `:762`
- **Observation:** `compute_factor_characteristics()` accepts `av_rel_coef: float = 0.8` but it is never passed by the caller (`run_analysis()` at line 762 calls it without the parameter). The value 0.8 is the qmethod-R default (Brown 1980), but it is not configurable via any API endpoint and is not prominently labelled in the UI. The response schema returns it as `avg_rel_coef` in `FactorCharacteristic` but users cannot change it.
- **Impact:** The composite reliability (Spearman-Brown formula) and `se_factor_scores` are sensitive to this value. For studies where the researcher has a justification to use a different average reliability (e.g., a pilot study with heterogeneous participants), the fixed 0.8 silently produces incorrect reliability estimates. This is a transparency gap in the methods section of any manuscript citing Libre-Q results.
- **Recommendation:** Add `av_rel_coef: float = 0.8` to `AnalysisRequest` with a validator clamped to (0, 1). Pass through to `run_analysis()` and `compute_factor_characteristics()`. Add a tooltip in the UI explaining what the parameter is (link to Brown 1980). Effort is small.
- **Effort:** S

---

### F-06-005 : No-rotation ("none") silently produces unusable Factor 2 with no user warning

- **Severity:** minor
- **Audience:** [Prod]
- **Location:** `backend/app/routers/admin/analysis.py:98`, `frontend/src/pages/admin/AnalysisPage.tsx:456`
- **Observation:** When `rotation="none"` is selected with PCA, the first principal component (PC1) typically captures nearly all variance in a bipolar dataset. The Layer 1 run confirms: `reference-bipolar-2f-pca-none` has PC1 eigenvalue=6.90 (86% variance), PC2 eigenvalue=0.81 (below flagging threshold). All 8 participants flag onto F1; F2 has zero flagged sorts. The API returns F2 z-scores as NaN (all) and factor arrays as all-zeros. The `distinguishing` list is empty. No warning is issued by the API or UI. In the frontend, the researcher sees an empty distinguishing table with no explanation.
- **Impact:** A user unfamiliar with Q methodology who selects "no rotation" expecting a valid 2-factor result will see a degenerate output that looks like a bug rather than a methodological consequence of their choice. The guidance text for the "none" rotation option (`AnalysisPage.tsx:452-458`) says only "No rotation preserves the original mathematical solution" — correct but insufficient to prevent confusion.
- **Recommendation:** In the API response, add a `warnings: list[str]` field. When any factor has `n_flagged=0` and the rotation is `"none"`, include a warning: "Factor N has no flagged participants. Consider using varimax rotation or requesting fewer factors." In the UI, display warnings in a dismissible alert above the results tabs.
- **Effort:** S

---

### F-06-006 : Extraction method switch (PCA vs centroid) changes factor polarity and distinguishing statements without user awareness

- **Severity:** minor
- **Audience:** [SoftwareX] [Prod]
- **Location:** `backend/app/services/analysis_service.py:731-735`, `frontend/src/components/admin/analysis/FactorCharacteristicsTable.tsx:285`
- **Observation:** On the reference bipolar dataset, switching extraction from PCA to centroid reverses the polarity of Factor 1 (stmt 0 goes from -2 to +2) and changes the number of distinguishing statements from 6 to 8. The `FactorCharacteristicsTable` shows "Method: PCA + varimax" or "Method: CENTROID + varimax" in small footer text, which is the only indication of which method was used. The XLSX export includes extraction and rotation in the Overview sheet, but the significance of the polarity reversal is not explained anywhere.
- **Impact:** A researcher switching between extraction methods while exploring the solution will observe different factor arrays without understanding that the factors are simply re-oriented, not substantively different. In critical Q practice (Sneegas 2020, p.7), the choice of factor array orientation carries interpretive meaning. The centroid-vs-PCA distinction matters for manuscript methods sections and replication by other researchers.
- **Recommendation:** Add a `factor_polarity_note` to the API response documenting sign conventions. In the UI, when the researcher switches extraction methods and re-runs, show a brief alert: "Extraction method changed — factor orientations may be inverted relative to the previous run. Compare factor arrays carefully before interpreting." This is especially important for the bipolar case.
- **Effort:** S

---

### F-06-007 : Analysis export does not include flagging threshold, av_rel_coef, or SED matrix

- **Severity:** minor
- **Audience:** [SoftwareX] [Prod]
- **Location:** `frontend/src/utils/analysisXlsxExport.ts:70-85`, `backend/app/services/export_service.py:283`
- **Observation:** The XLSX export (Overview sheet) includes: Extraction, Rotation, N Participants, N Statements, N Factors, Total Variance Explained, eigenvalues. It does NOT include: the flagging threshold used, the `av_rel_coef` value, the SED (Standard Error of Differences) matrix, the per-participant correlation matrix, or communalities. The research package ZIP (`/export/package`) similarly omits these intermediates. The CSV exports include only loadings or z-scores/arrays, not factor characteristics or SED.
- **Impact:** A researcher citing Libre-Q results in a manuscript needs to report: extraction method, rotation, flagging criteria (threshold value), number of flagged sorts per factor, composite reliability, and SE of factor scores. The SED matrix is needed to verify distinguishing statement thresholds. Currently, a researcher must reconstruct these by reading raw API JSON. For SoftwareX, the completeness of exported artefacts is a reviewer criterion.
- **Recommendation:** Add to the XLSX Overview sheet: flagging threshold (computed), av_rel_coef, SED matrix (as a new tab), communalities (as a column in Factor Loadings tab). Update the research package ZIP to include a `methods_summary.json` with all analytical parameters and computed intermediates needed for a methods section.
- **Effort:** M

---

### F-06-008 : Post-sort interview audio recordings not linkable to factor membership in analysis UI or exports

- **Severity:** major
- **Audience:** [SoftwareX] [Prod]
- **Location:** `backend/app/routers/admin/analysis.py:232-255` (no audio linkage in result), `backend/app/routers/admin/exports.py:252` (audio export per-participant only, not per-factor)
- **Observation:** Libre-Q supports audio recordings of post-sort interviews (`/participants/{id}/export/audio`). However, the analysis result API (`POST /analysis/run`) does not include audio metadata in `ParticipantLoading`. After running an analysis, the researcher knows which participants define each factor (from flags), but cannot directly navigate from "Factor 1 is defined by participants P2, P4, P5, P7" to "play or download Factor 1's defining participants' audio recordings." Audio is only accessible per-participant, not per-factor-group.
- **Impact:** Post-sort interviews are a defining feature of critical Q methodology. Sneegas (2020, p.3) lists "semistructured interviews following Q sorts to elicit participants' thoughts and reasoning" as step 5 of the standard protocol, and pp.5-7 argue that interview data is "dialogic, coproduced between the researcher, participants, and discourse" — central to the interpretive analysis of factor arrays. Robbins & Krueger (2000, p.640) similarly describe step 7 as consulting "respondents themselves" to interpret factor explanations. Without a direct link from factor membership to audio, the researcher must manually cross-reference participant IDs — an error-prone workflow that defeats the purpose of integrated post-sort recording.
- **Recommendation:** In `AnalysisResult.ParticipantLoading`, add `has_audio: bool` and `audio_count: int`. In the factor arrays view and loadings table, show audio availability indicators next to flagged participants and provide a direct link to download that participant's audio. Add a per-factor audio bundle endpoint: `GET /{slug}/analysis/factors/{factor_n}/audio` that zips all audio recordings from flagged participants.
- **Effort:** M (backend endpoint M; frontend indicator S)

---

### F-06-009 : Layer 2 cross-tool validation (vs qmethod-R) not completable — R not installed

- **Severity:** major
- **Audience:** [SoftwareX]
- **Location:** transverse (audit infrastructure)
- **Observation:** The gold-standard Layer 2 validation — comparing Libre-Q outputs against R's `qmethod` package (Zabala 2014) on the `lipset` dataset — is not feasible because R is not installed on the development machine (`which Rscript` → not found). The lipset dataset itself is not available as a local CSV (a degenerate placeholder was used for Layer 1 only). Layer 2 was conducted in degraded mode: textbook formula verification (correlation matrix, eigenvalues, communalities, flagging conditions, z-score standardization) all pass on the bipolar reference dataset.
- **Impact:** For SoftwareX, claiming algorithmic equivalence with qmethod-R without a quantitative cross-tool comparison is a credibility gap. Reviewers familiar with qmethod-R will expect published reference values to be reproduced. The textbook verification provides mathematical consistency evidence but not cross-implementation equivalence evidence. The centroid method in particular (Brown 1980, Brown & Mayer 2020) has known implementation variations between tools.
- **Recommendation:** Before submission: (a) install R + qmethod (`sudo apt install r-base && Rscript -e 'install.packages("qmethod")'`), (b) export `qmethod::lipset` as CSV, (c) run Libre-Q on lipset with identical parameters as Zabala (2014) Table 1, (d) compare factor arrays, z-scores, and distinguishing statements column by column. Document the comparison in a supplementary file. If any difference > 0.01 in z-scores, investigate and fix or document as a known divergence with justification.
- **Effort:** M (R installation + comparison script + documentation)

---

### F-06-010 : Centroid extraction convergence failure logged silently, not surfaced to API caller

- **Severity:** minor
- **Audience:** [Prod]
- **Location:** `backend/app/services/analysis_service.py:178-184`, `:219-224`
- **Observation:** `extract_centroid()` logs warnings via `logger.warning()` for three failure modes: reflection loop non-convergence (line 183), degenerate initial estimate (line 194), and iteration non-convergence (line 222). In all three cases, the function continues and returns potentially incorrect loadings rather than raising an exception. The caller `run_analysis()` does not inspect the return value for convergence signals. The API response contains no `warnings` field, so convergence failures are invisible to the researcher.
- **Impact:** A researcher using centroid extraction on a pathological dataset (collinear Q-sorts, near-singular correlation matrix) may receive silently degraded loadings. This is especially relevant for small Q-samples (N < 10) or studies with highly similar participants. The SoftwareX manuscript claims centroid extraction as a feature parity item with qmethod-R, but qmethod-R raises errors on non-convergence.
- **Recommendation:** Add a convergence status return value to `extract_centroid()`: return `(loadings, converged: bool, warnings: list[str])`. In `run_analysis()`, accumulate warnings and return them in the result dict. Surface in `AnalysisResult` via a `warnings: list[str]` field (same field as F-06-005 recommends).
- **Effort:** S

---

### F-06-011 : Kaiser criterion for n_factors suggestion is the only heuristic offered

- **Severity:** observation
- **Audience:** [SoftwareX]
- **Location:** `backend/app/services/analysis_service.py:659`, `frontend/src/pages/admin/AnalysisPage.tsx:141-148`
- **Observation:** `compute_eigenvalues()` returns `suggested_n_factors` computed solely by the Kaiser criterion (eigenvalue > 1). The frontend auto-selects this value when the page loads. The help text reads "The Kaiser criterion (eigenvalue > 1) is one common heuristic for deciding how many factors to retain." (AnalysisPage.tsx:735).
- **Impact:** In the bipolar reference dataset, Kaiser suggests 1 factor (only one eigenvalue > 1: 6.90), which would be incorrect for a clearly bipolar structure where 2 factors are theoretically motivated. The scree plot is shown alongside and allows visual inspection, which mitigates this — the researcher can override the suggestion. However, the Zabala (2016) bootstrap approach and the theoretical-number-of-perspectives approach (Watts & Stenner 2012, Ch. 6) are not mentioned. For critical Q, the theoretical argument for a particular number of factors often precedes the analysis.
- **Recommendation:** Add to the help text: a note that the Kaiser criterion can undercount factors in Q methodology (due to the small participant-to-statement ratios common in Q); mention that the scree plot inflection point and theoretical expectations are equally valid criteria. No code change required — documentation only.
- **Effort:** S

---

### F-06-012 : Factor naming step absent from UI workflow — interpretive moment is invisible

- **Severity:** observation
- **Audience:** [SoftwareX] [Prod]
- **Location:** `frontend/src/pages/admin/AnalysisPage.tsx` (entire page)
- **Observation:** The analysis page exposes factor arrays, loadings, z-scores, and distinguishing/consensus statements, but there is no step where the researcher names each factor (e.g., "Factor 1: 'ecological modernisation' discourse"). Factor labels are referenced only by number (F1, F2, F3) throughout the UI and all exports.
- **Impact:** In critical Q practice, naming the factor is the core interpretive act. Sneegas (2020, p.7) describes this explicitly: "interpreting each factor is a process of holistically examining all statements within the factor array, how they relate to each other, and how each factor's patterns relate to other factors." Robbins & Krueger (2000, p.640) document this as step 7. The absence of a named-factor field means that every export file uses only "F1", "F2" — the researcher must manually rename all columns in post-processing. For a platform targeting critical Q researchers, this is a meaningful gap.
- **Recommendation:** Add a `factor_labels: list[str]` field to `Study` (or a separate `AnalysisRun` model if F-06-001 is implemented). Expose a factor renaming UI on the analysis page (editable text fields next to each factor column header). Propagate labels into XLSX exports and the research package. This is also a significant UX differentiator vs PQMethod (which has no naming UI) and should be mentioned in the SoftwareX manuscript.
- **Effort:** M (if no AnalysisRun model yet: persist to Study model as JSONB; frontend: S)

---

### F-06-013 : Z-score NaN silently coerced to 0.0 in API response

- **Severity:** minor
- **Audience:** [SoftwareX] [Prod]
- **Location:** `backend/app/routers/admin/analysis.py:49-53` (`_build_z_scores_list`)
- **Observation:** The helper `_build_z_scores_list()` replaces `NaN` z-scores with `0.0` before returning them in the API response. A z-score of NaN occurs when a factor has zero flagged sorts (as in the no-rotation case for Factor 2). The API consumer receives `0.0` which is indistinguishable from a genuine neutral z-score.
- **Impact:** The internal `run_analysis()` result correctly uses `NaN` to signal "this factor was not computed" (Factor 2 in the no-rotation run has all-NaN z-scores). Coercing to 0.0 at the API boundary means that frontend code and any client-side export tool cannot distinguish "genuinely neutral statement" from "factor not computed." For the no-rotation case, this causes all 9 statements to appear in the factor array for F2 with value 0 — a misleading representation. Client-side distinction requires inspection of `flags` or `factor_characteristics.n_flagged`.
- **Recommendation:** Return `null` (JSON null, mapped from Python `None`) for NaN z-scores instead of `0.0`. Update `StatementScore.z_scores` to `list[float | None]`. Update the frontend to handle `null` z-scores (show "—" in tables, skip in CSV). Alternatively, add a `computed: list[bool]` field to `AnalysisResult` indicating which factors were actually computed.
- **Effort:** S (backend + schema); M (frontend null-handling in tables and exports)

---

### F-06-014 : Confounded-lowvar case shows unexpected high flagging (5/6 on F1)

- **Severity:** observation
- **Audience:** [SoftwareX]
- **Location:** `docs/audits/2026-04-25-deep-audit/.raw/qmethod-libre-q-confounded-lowvar-2f-pca-varimax.json`
- **Observation:** The "confounded-lowvar" dataset was intended to test "low/no flagging" behavior. Instead, 5 of 6 participants flagged on Factor 1 and 1 on Factor 2. Examining the data: the sort matrix has 5 participants with nearly identical sorts and one outlier (P5) with an inverted statement-0 score (+2 vs -2 for others). PCA separates the outlier onto F2, the cluster onto F1. The correlation matrix confirms: P1-P4, P6 correlate ≥0.833; P5 correlates -0.08 to -0.42 with others. This is not confounded data — it is a clean outlier case.
- **Impact:** The dataset label ("confounded-lowvar") does not match its actual behavior ("clear outlier"). For the audit record, Libre-Q behaves correctly on this data. However, the dataset does not test the intended scenario (truly confounded Q-sorts with no dominant factor structure). A genuine confounded test case should have all participants with loadings below the flagging threshold on all factors.
- **Recommendation:** For future Layer 1 testing, generate a proper confounded dataset: N participants with random permutations of the same distribution, producing a correlation matrix with all off-diagonal values near zero. This would test the "no flagging" scenario. No code change required.
- **Effort:** S (test data generation only)

---

## Critical Q compatibility summary

Based on Sneegas (2020), Robbins & Krueger (2000), and Stainton Rogers (1997), critical Q methodology requires:

| Requirement | Libre-Q status |
|-------------|---------------|
| Factor analysis (extraction, rotation, flagging) | Implemented. PCA and centroid both available. |
| Judgmental/manual rotation | **Missing** (F-06-002) |
| Post-sort interview collection | Implemented (audio recordings) |
| Factor-interview linkage in analysis | **Missing** (F-06-008) |
| Factor naming / interpretive labelling | **Missing** (F-06-012) |
| Analytical choices visible in exports | Partial — extraction+rotation in XLSX but not threshold, av_rel_coef, SED (F-06-007) |
| Audit trail of analytical decisions | **Missing** — no AnalysisRun persistence (F-06-001) |
| Researcher reflexivity support | Partial — guidance cards present but no reflexivity log |
| Show preliminary results to participants (Sneegas step 7) | Not implemented (observation only) |
| Transparency of flagging threshold | **Missing from request / pre-analysis view** (F-06-003) |
| Bootstrapped variability (Zabala 2016) | Not implemented (observation only) |

The most critical gap for SoftwareX positioning as a critical Q platform is the absence of factor-audio linkage (F-06-008) and analytical audit trail (F-06-001). These are not merely missing features — they are structural requirements for the "post-positivist, reflexive" claims made for the software.

---

## Finding index

| ID | Title | Severity | Effort |
|----|-------|----------|--------|
| F-06-001 | Analysis results not persisted — no audit trail | major | M |
| F-06-002 | No judgmental rotation support | major | L |
| F-06-003 | Flagging threshold hardcoded and not user-adjustable | major | S |
| F-06-004 | av_rel_coef hardcoded at 0.8, not exposed to user | minor | S |
| F-06-005 | No-rotation silently produces unusable Factor 2 | minor | S |
| F-06-006 | Extraction switch changes polarity without user warning | minor | S |
| F-06-007 | Analysis export missing threshold, av_rel_coef, SED | minor | M |
| F-06-008 | Audio recordings not linkable to factor membership | major | M |
| F-06-009 | Layer 2 cross-tool validation not completable (R absent) | major | M |
| F-06-010 | Centroid convergence failure silent at API level | minor | S |
| F-06-011 | Kaiser criterion only heuristic for n_factors suggestion | observation | S |
| F-06-012 | Factor naming step absent from UI workflow | observation | M |
| F-06-013 | Z-score NaN coerced to 0.0 in API response | minor | S |
| F-06-014 | Confounded-lowvar test case does not test intended scenario | observation | S |

**Totals: 0 blocker, 4 major, 5 minor, 3 observation**

> Note on blockers: No finding reaches blocker severity because (a) the mathematical outputs are internally consistent (Layer 2 textbook verification passed), (b) the missing features (manual rotation, audio-factor linkage) are architectural gaps rather than bugs corrupting existing output, and (c) the R comparison gap (F-06-009) blocks validation completeness but not software correctness. The 4 majors collectively constitute a substantial gap in critical Q methodology support that must be addressed before SoftwareX submission framing claims critical Q orientation.
