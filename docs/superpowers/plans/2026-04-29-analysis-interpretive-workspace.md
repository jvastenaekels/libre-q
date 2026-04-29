# Analysis Interpretive Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the Analysis page from a one-shot calculator into a two-phase interpretive workspace (Explore / Interpret) that resolves three pains: deciding `n_factors` with real diagnostics, building per-factor narratives in a focused canvas, and comparing two runs side-by-side.

**Architecture:** Backend gains two retention indicators (Horn's parallel analysis, Velicer's MAP) on `/eigenvalues` plus a new throwaway `/preview-range` endpoint. Frontend splits the monolithic `useAnalysisPage` (557 LOC) into `useExplorePhase` and `useInterpretPhase`, addressed by URL `?phase=…`. Two new component trees: `<ExplorerPanel>` (diagnostics + preview-range table) and `<FactorCanvas>` (per-factor focus with quote picker). Compare-pin is URL-scoped, computed client-side via Tucker's φ.

**Tech Stack:** Backend — FastAPI, SQLAlchemy async, Pydantic, NumPy. Frontend — React 19 + TypeScript, react-router-dom, react-i18next, TanStack Query, Vitest. Toolchain — `uv`, `make ci-fast` (~38s) between every change, `make ci` before PR.

**Reference spec:** `docs/superpowers/specs/2026-04-29-analysis-module-improvements-design.md`

**Plan-time decisions deferred from spec:**

- **`preview-range` calls `run_analysis` N times** (not single-pass truncation). Correctness over cleverness; profiling can revisit later.
- **Form state stays URL-synced** in `useExplorePhase` (preserves the existing reload-stable behaviour for `extraction/nFactors/rotation/flagging` while in Explore phase). New top-level params: `phase`, `runId`, `focus`, `compareTo`.
- **`useAnalysisPage` is renamed/repurposed**, not deleted, during the refactor: it becomes `useExplorePhase` (form-state owner). `useInterpretPhase` is a new file. This minimises diff churn for git history.
- **Tucker's φ utility lives in `frontend/src/utils/tuckerPhi.ts`** (pure function; testable without mounting components).
- **Quote-insert format is fixed** in v1 — single template, no analyst customisation. The format is part of the locale file (`admin.analysis.quote_insert_format`).
- **`compute_preview_range` lives in `analysis_service.py`** (not a new module) — same domain, < 80 LOC, fits the existing service.

---

## File structure

### Backend — created
- `backend/tests/property/test_analysis_invariants.py` already exists; we extend it (no new file).

### Backend — modified
- `backend/app/services/analysis_service.py` — add `compute_parallel_analysis_n`, `compute_velicer_map_n`, `compute_preview_range`, `PreviewSummary` TypedDict.
- `backend/app/schemas/analysis.py` — extend `EigenvalueResult` with `kaiser_n`, `parallel_analysis_n`, `velicer_map_n` (preserve `suggested_n_factors` for backward compat). Add `PreviewRangeRequest`, `PreviewRangeRow`, `PreviewRangeResponse`.
- `backend/app/routers/admin/analysis.py` — extend `GET /eigenvalues` payload; add `POST /preview-range`.
- `backend/tests/unit/test_analysis_service.py` — add tests for the three new service functions.
- `backend/tests/integration/test_analysis.py` — add tests for the new endpoint + enriched eigenvalues response.
- `backend/tests/property/test_analysis_invariants.py` — add Hypothesis test for preview-range consistency.
- `backend/pyproject.toml` — no change (analysis_service is already strict-typed).

### Frontend — created
- `frontend/src/hooks/admin/useExplorePhase.ts` — new (renamed from `useAnalysisPage`, scope reduced to Explore phase).
- `frontend/src/hooks/admin/useExplorePhase.test.ts` — renamed from `useAnalysisPage.test.ts` with Explorer-specific additions.
- `frontend/src/hooks/admin/useInterpretPhase.ts` — new.
- `frontend/src/hooks/admin/useInterpretPhase.test.ts` — new.
- `frontend/src/components/admin/analysis/ExplorerPanel.tsx`
- `frontend/src/components/admin/analysis/ExplorerPanel.test.tsx`
- `frontend/src/components/admin/analysis/PreviewRangeTable.tsx`
- `frontend/src/components/admin/analysis/PreviewRangeTable.test.tsx`
- `frontend/src/components/admin/analysis/ScreeWithDiagnostics.tsx`
- `frontend/src/components/admin/analysis/ScreeWithDiagnostics.test.tsx`
- `frontend/src/components/admin/analysis/FactorCanvas.tsx`
- `frontend/src/components/admin/analysis/FactorCanvas.test.tsx`
- `frontend/src/components/admin/analysis/FactorSelectorChips.tsx`
- `frontend/src/components/admin/analysis/CompareBar.tsx`
- `frontend/src/components/admin/analysis/CompareBar.test.tsx`
- `frontend/src/utils/tuckerPhi.ts`
- `frontend/src/utils/tuckerPhi.test.ts`

### Frontend — modified
- `frontend/src/pages/admin/AnalysisPage.tsx` — phase routing, two-phase shell, header `Back to Explore` button.
- `frontend/src/pages/admin/AnalysisPage.test.tsx` — phase routing tests.
- `frontend/src/hooks/admin/useAnalysisPage.ts` — **deleted** at end of Phase 2; symbol moved to `useExplorePhase`.
- `frontend/src/hooks/admin/useAnalysisPage.test.ts` — **deleted** at end of Phase 2; tests moved to `useExplorePhase.test.ts`.
- `frontend/src/components/admin/analysis/FactorNoteEditor.tsx` — add optional `onInsertQuote(snippet: string) => void` prop and external-trigger ref handling so the canvas can append snippets.
- `frontend/src/components/admin/analysis/FactorNoteEditor.test.tsx` — test the new prop.
- `frontend/src/components/admin/analysis/ScreePlot.tsx` — keep as building block; `ScreeWithDiagnostics` wraps it (no rewrite).
- `frontend/public/locales/{en,fr,fi}/translation.json` — new `admin.analysis.explore.*`, `admin.analysis.interpret.*`, `admin.analysis.compare.*`, `admin.analysis.quote_insert_format` keys.
- `frontend/src/api/generated.ts` and `frontend/src/api/model/*` — regenerated by `make generate-api`.

---

# Phase 1 — Backend diagnostics + preview-range

**PR boundary.** Ships independently. After Phase 1: backend exposes Horn + MAP + preview-range; frontend still uses `suggested_n_factors` and ignores new fields. Existing UI keeps working.

**Goal:** Add three retention indicators to `/eigenvalues` and a new `POST /preview-range` endpoint that returns per-`k` summaries, gated to PCA + varimax.

---

### Task 1: `compute_parallel_analysis_n`

**Files:**
- Modify: `backend/app/services/analysis_service.py`
- Test: `backend/tests/unit/test_analysis_service.py`

- [ ] **Step 1: Write the failing test**

Add to `backend/tests/unit/test_analysis_service.py` (after the `compute_eigenvalues` tests):

```python
def test_compute_parallel_analysis_n_reference_dataset():
    """Horn (1965) PA on the reference dataset with two clear factors.

    REFERENCE_DATASET has a 4-vs-4 participant split with strong opposing
    patterns. Parallel analysis on this small noisy dataset is expected to
    retain at least 1 factor and at most n_participants - 1 = 7. With the
    fixed seed, the deterministic result is asserted exactly.
    """
    from app.services.analysis_service import compute_parallel_analysis_n

    n = compute_parallel_analysis_n(REFERENCE_DATASET, n_simulations=200, seed=42)
    assert 1 <= n <= 7
    # Deterministic on the seed; lock the exact value to catch silent regressions.
    assert n == 2


def test_compute_parallel_analysis_n_pure_noise_returns_floor_1():
    """On pure noise, Horn's PA should not retain any structural factor.

    The implementation guarantees a minimum of 1 (we never return 0 — the UI
    needs at least one factor to be meaningful).
    """
    from app.services.analysis_service import compute_parallel_analysis_n

    rng = np.random.default_rng(0)
    noise = rng.standard_normal(size=(20, 10))
    n = compute_parallel_analysis_n(noise, n_simulations=200, seed=42)
    assert n == 1
```

- [ ] **Step 2: Run test to verify it fails**

Run from `backend/`:
```
.venv/bin/pytest tests/unit/test_analysis_service.py::test_compute_parallel_analysis_n_reference_dataset -v
```
Expected: `ImportError: cannot import name 'compute_parallel_analysis_n'`.

- [ ] **Step 3: Implement `compute_parallel_analysis_n`**

In `backend/app/services/analysis_service.py`, after the `compute_eigenvalues` function:

```python
def compute_parallel_analysis_n(
    dataset: NDArray[np.float64],
    n_simulations: int = 1000,
    seed: int = 42,
) -> int:
    """Horn (1965) parallel analysis on the participant-correlation matrix.

    Compares observed eigenvalues against the 95th percentile of eigenvalues
    from random Gaussian datasets of matching shape. Returns the count of
    factors whose observed eigenvalue exceeds the simulated threshold,
    floored at 1 (the analysis always needs at least one factor).

    Args:
        dataset: (n_statements x n_participants) Q-sort matrix.
        n_simulations: Monte-Carlo iterations. Default 1000.
        seed: RNG seed for reproducibility.

    Returns:
        Number of factors retained (>= 1).
    """
    n_statements, n_participants = dataset.shape
    rng = np.random.default_rng(seed)
    sim_eigs = np.zeros((n_simulations, n_participants))
    for i in range(n_simulations):
        sim = rng.standard_normal(size=(n_statements, n_participants))
        sim_cor = correlation_matrix(sim)
        evs = np.linalg.eigvalsh(sim_cor)
        sim_eigs[i] = np.sort(evs)[::-1]
    threshold = np.percentile(sim_eigs, 95, axis=0)
    obs_cor = correlation_matrix(dataset)
    obs_eigs = np.sort(np.linalg.eigvalsh(obs_cor))[::-1]
    return max(int(np.sum(obs_eigs > threshold)), 1)
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```
.venv/bin/pytest tests/unit/test_analysis_service.py -v -k compute_parallel_analysis_n
```
Expected: 2 passed. If `assert n == 2` fails because the implementation differs, replace with the actual value the function returns and lock it (the test is a regression guard, not a methodological oracle).

- [ ] **Step 5: Commit**

```
git add backend/app/services/analysis_service.py backend/tests/unit/test_analysis_service.py
git commit -m "feat(analysis): add Horn's parallel analysis for n_factors retention"
```

---

### Task 2: `compute_velicer_map_n`

**Files:**
- Modify: `backend/app/services/analysis_service.py`
- Test: `backend/tests/unit/test_analysis_service.py`

- [ ] **Step 1: Write the failing test**

Add to `backend/tests/unit/test_analysis_service.py`:

```python
def test_compute_velicer_map_n_reference_dataset():
    """Velicer (1976) MAP on the reference dataset.

    The MAP picks the k that minimises the average squared partial
    correlation after extracting k components. On the 8-participant
    reference dataset, the result is bounded by [1, 7]. Lock the exact
    value once observed for regression.
    """
    from app.services.analysis_service import (
        compute_velicer_map_n,
        correlation_matrix,
    )

    cor = correlation_matrix(REFERENCE_DATASET)
    n = compute_velicer_map_n(cor)
    assert 1 <= n <= 7
    # Lock observed value (replace with actual result on first run).
    assert n == 2


def test_compute_velicer_map_n_minimum_size():
    """MAP must return at least 1 even on degenerate inputs."""
    from app.services.analysis_service import compute_velicer_map_n

    cor = np.eye(3)
    n = compute_velicer_map_n(cor)
    assert n == 1
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```
.venv/bin/pytest tests/unit/test_analysis_service.py::test_compute_velicer_map_n_reference_dataset -v
```
Expected: `ImportError`.

- [ ] **Step 3: Implement `compute_velicer_map_n`**

In `backend/app/services/analysis_service.py`, after `compute_parallel_analysis_n`:

```python
def compute_velicer_map_n(cor_mat: NDArray[np.float64]) -> int:
    """Velicer (1976) Minimum Average Partial.

    For each candidate k from 1 to min(n-1, 8), extract k principal
    components, deflate the correlation matrix, then compute the average
    squared off-diagonal of the resulting partial correlation matrix.
    The k that minimises this average is the optimal number of factors.

    Args:
        cor_mat: Participant-correlation matrix (n x n).

    Returns:
        Optimal number of factors (>= 1).
    """
    n = cor_mat.shape[0]
    if n < 2:
        return 1
    eigenvalues, eigenvectors = np.linalg.eigh(cor_mat)
    idx = np.argsort(eigenvalues)[::-1]
    eigenvalues = eigenvalues[idx]
    eigenvectors = eigenvectors[:, idx]

    map_values: list[float] = []
    for k in range(1, min(n, 9)):
        evs_k = np.maximum(eigenvalues[:k], 0.0)
        loadings = eigenvectors[:, :k] * np.sqrt(evs_k)
        residual = cor_mat - loadings @ loadings.T
        diag = np.sqrt(np.maximum(np.diag(residual), 1e-10))
        partial = residual / np.outer(diag, diag)
        np.fill_diagonal(partial, 0.0)
        avg_sq = float(np.sum(partial**2) / (n * (n - 1)))
        map_values.append(avg_sq)

    return int(np.argmin(map_values)) + 1
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```
.venv/bin/pytest tests/unit/test_analysis_service.py -v -k compute_velicer_map_n
```
Expected: 2 passed (after locking the actual returned value).

- [ ] **Step 5: Commit**

```
git add backend/app/services/analysis_service.py backend/tests/unit/test_analysis_service.py
git commit -m "feat(analysis): add Velicer's MAP for n_factors retention"
```

---

### Task 3: Extend `EigenvalueResult` schema and `/eigenvalues` endpoint

**Files:**
- Modify: `backend/app/schemas/analysis.py:257-264`
- Modify: `backend/app/routers/admin/analysis.py:92-119`
- Test: `backend/tests/integration/test_analysis.py`

- [ ] **Step 1: Write the failing test**

Add to `backend/tests/integration/test_analysis.py`:

```python
async def test_get_eigenvalues_returns_kaiser_parallel_map(
    client: AsyncClient,
    seed_study,
    auth_headers,
    db,
    _make_analysis_study,
):
    """GET /eigenvalues should return the three retention indicators."""
    study = await _make_analysis_study(db, seed_study)
    resp = await client.get(
        f"/api/admin/studies/{study.slug}/analysis/eigenvalues",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert "eigenvalues" in body
    # Backward-compat field still present.
    assert "suggested_n_factors" in body
    # New retention indicators.
    assert "kaiser_n" in body
    assert "parallel_analysis_n" in body
    assert "velicer_map_n" in body
    for key in ("kaiser_n", "parallel_analysis_n", "velicer_map_n"):
        assert isinstance(body[key], int)
        assert body[key] >= 1
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```
.venv/bin/pytest tests/integration/test_analysis.py::test_get_eigenvalues_returns_kaiser_parallel_map -v
```
Expected: KeyError or assertion failure on `kaiser_n`.

- [ ] **Step 3: Update the schema**

Edit `backend/app/schemas/analysis.py` lines 257-264. Replace `EigenvalueResult` with:

```python
class EigenvalueResult(BaseModel):
    """Eigenvalues for the scree plot plus three retention indicators.

    All three indicators are advisory — Watts & Stenner (2012) emphasise
    that factor retention in Q-methodology also depends on interpretability
    and stability, not just statistical thresholds.
    """

    eigenvalues: list[float]
    kaiser_n: int = Field(
        description="Kaiser criterion: number of eigenvalues > 1."
    )
    parallel_analysis_n: int = Field(
        description="Horn (1965) parallel analysis: count of observed eigenvalues "
        "exceeding the 95th percentile of random-data eigenvalues.",
    )
    velicer_map_n: int = Field(
        description="Velicer (1976) Minimum Average Partial.",
    )
    suggested_n_factors: int = Field(
        description="Backward-compatible alias for kaiser_n. Frontends should "
        "prefer the three explicit fields."
    )
```

- [ ] **Step 4: Update the router**

Edit `backend/app/routers/admin/analysis.py` around lines 92-119. Replace the `get_eigenvalues` body with:

```python
    dump = await _get_analysis_dump(db, study.id)

    try:
        dataset, _participants, _statements = build_sort_matrix(dump)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    try:
        cor = correlation_matrix(dataset)
        eigenvalues, kaiser_n = await asyncio.to_thread(
            lambda: compute_eigenvalues(cor)
        )
        parallel_n = await asyncio.to_thread(
            lambda: compute_parallel_analysis_n(dataset)
        )
        map_n = await asyncio.to_thread(lambda: compute_velicer_map_n(cor))
    except (np.linalg.LinAlgError, ValueError) as e:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to compute eigenvalues: {e}",
        )

    return EigenvalueResult(
        eigenvalues=eigenvalues,
        kaiser_n=kaiser_n,
        parallel_analysis_n=parallel_n,
        velicer_map_n=map_n,
        suggested_n_factors=kaiser_n,
    )
```

Also add to the imports near the top of the router (line 41-46):

```python
from ...services.analysis_service import (
    apply_manual_flags,
    build_sort_matrix,
    compute_bootstrap_stability,
    compute_eigenvalues,
    compute_parallel_analysis_n,
    compute_velicer_map_n,
    correlation_matrix,
    run_analysis,
)
```

- [ ] **Step 5: Run tests to verify they pass**

Run:
```
.venv/bin/pytest tests/integration/test_analysis.py::test_get_eigenvalues_returns_kaiser_parallel_map -v
```
Expected: PASS.

Then run the full unit test file to make sure no regression:
```
.venv/bin/pytest tests/unit/test_analysis_service.py -v
```
Expected: all PASS.

- [ ] **Step 6: Commit**

```
git add backend/app/schemas/analysis.py backend/app/routers/admin/analysis.py backend/tests/integration/test_analysis.py
git commit -m "feat(analysis): expose Kaiser/parallel/MAP indicators on /eigenvalues"
```

---

### Task 4: `compute_preview_range` service function

**Files:**
- Modify: `backend/app/services/analysis_service.py`
- Test: `backend/tests/unit/test_analysis_service.py`

- [ ] **Step 1: Add the `PreviewSummary` TypedDict and write the failing test**

In `backend/app/services/analysis_service.py`, in the wire-types cluster (near the top after `BootstrapStabilityResult`):

```python
class PreviewSummary(TypedDict):
    """Per-k summary returned by compute_preview_range.

    All fields are descriptive — see the Phase Explorer spec for usage.
    `min_defining_sorts` is the minimum across factors of the count of
    flagged participants on each factor; `has_empty_factor` is True when
    at least one factor has zero defining sorts (over-factorisation).
    """

    n_factors: int
    cumulative_variance: float
    pct_flagged: float
    n_distinguishing: int
    n_cross_loaders: int
    n_consensus: int
    min_defining_sorts: int
    has_empty_factor: bool
```

Then add to `backend/tests/unit/test_analysis_service.py`:

```python
def test_compute_preview_range_pca_varimax(sample_dump):
    """compute_preview_range returns one PreviewSummary per k.

    For PCA + varimax + auto flagging on the reference study, summaries for
    k in [2, 3] should be coherent: cumulative_variance non-decreasing,
    pct_flagged in [0, 1], counts non-negative.
    """
    from app.services.analysis_service import compute_preview_range

    rows = compute_preview_range(
        dump=sample_dump,
        n_factors_range=[2, 3],
        extraction="pca",
        rotation="varimax",
        flagging="auto",
    )
    assert [r["n_factors"] for r in rows] == [2, 3]
    cv2, cv3 = rows[0]["cumulative_variance"], rows[1]["cumulative_variance"]
    assert cv3 >= cv2  # variance is monotonic in k
    for r in rows:
        assert 0.0 <= r["pct_flagged"] <= 1.0
        assert r["n_distinguishing"] >= 0
        assert r["n_cross_loaders"] >= 0
        assert r["n_consensus"] >= 0
        assert r["min_defining_sorts"] >= 0
        assert isinstance(r["has_empty_factor"], bool)


def test_compute_preview_range_consistency_with_run_analysis(sample_dump):
    """preview-range row for k must equal a real run_analysis run for k.

    The preview is *not* a single-pass approximation — it's literally
    N runs. This test pins that contract.
    """
    from app.services.analysis_service import (
        build_sort_matrix,
        compute_preview_range,
        run_analysis,
    )

    rows = compute_preview_range(
        dump=sample_dump,
        n_factors_range=[3],
        extraction="pca",
        rotation="varimax",
        flagging="auto",
    )
    dataset, _, _ = build_sort_matrix(sample_dump)
    real = run_analysis(
        dataset,
        n_factors=3,
        extraction="pca",
        rotation="varimax",
        flagging="auto",
        grid_config=sample_dump["study"]["grid_config"],
    )
    assert rows[0]["n_distinguishing"] == len(real["distinguishing"])
    assert rows[0]["n_consensus"] == len(real["consensus"])
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```
.venv/bin/pytest tests/unit/test_analysis_service.py::test_compute_preview_range_pca_varimax -v
```
Expected: ImportError.

- [ ] **Step 3: Implement `compute_preview_range`**

In `backend/app/services/analysis_service.py`, near the end of the file (after `compute_bootstrap_stability`):

```python
def compute_preview_range(
    dump: SortDataDump,
    n_factors_range: list[int],
    extraction: str,
    rotation: str,
    flagging: str,
) -> list[PreviewSummary]:
    """Run analysis once per k and summarise each result.

    Used by POST /analysis/preview-range to populate the Phase Explorer
    preview table. The function deliberately calls run_analysis N times
    rather than truncating a single high-k extraction — centroid is
    iterative on residuals (Brown 1980) and judgmental rotation is
    path-dependent, so a single-pass shortcut would silently misrepresent
    those configurations. Caller is responsible for gating the extraction
    and rotation values upstream (see router validation).

    Args:
        dump: SortDataDump as returned by _get_analysis_dump.
        n_factors_range: Sorted list of candidate k values.
        extraction: 'pca' or 'centroid'.
        rotation: 'varimax', 'none', or 'judgmental'.
        flagging: 'auto' or 'manual' (manual treated as auto here — preview
            is exploratory only; manual flagging is committed-run territory).

    Returns:
        One PreviewSummary per k, in the input order.
    """
    dataset, _participants, _statements = build_sort_matrix(dump)
    grid_config = dump["study"]["grid_config"]
    rows: list[PreviewSummary] = []
    for k in n_factors_range:
        result = run_analysis(
            dataset,
            n_factors=k,
            extraction=extraction,
            rotation=rotation,
            flagging="auto",
            grid_config=grid_config,
        )
        flagged = np.array(
            [
                [
                    1 if (f + 1) in (p.get("flagged_factors") or []) else 0
                    for f in range(k)
                ]
                for p in result["participants"]
            ],
            dtype=np.int64,
        )
        n_participants = flagged.shape[0]
        any_flag = flagged.sum(axis=1) > 0
        cross = flagged.sum(axis=1) >= 2
        per_factor_flagged = flagged.sum(axis=0)
        cumulative_variance = (
            float(result["factor_characteristics"][-1]["cumulative_variance"])
            if result["factor_characteristics"]
            else 0.0
        )
        rows.append(
            PreviewSummary(
                n_factors=k,
                cumulative_variance=cumulative_variance,
                pct_flagged=float(any_flag.sum()) / max(n_participants, 1),
                n_distinguishing=len(result["distinguishing"]),
                n_cross_loaders=int(cross.sum()),
                n_consensus=len(result["consensus"]),
                min_defining_sorts=int(per_factor_flagged.min()) if k > 0 else 0,
                has_empty_factor=bool((per_factor_flagged == 0).any()),
            )
        )
    return rows
```

(Note: the `run_analysis` return shape is `AnalysisRunResult` TypedDict — see the existing `class AnalysisRunResult` at line 96 for field names. Adjust `result["participants"][i].get("flagged_factors")` to match the actual key — verify against the TypedDict before running tests.)

- [ ] **Step 4: Run tests to verify they pass**

Run:
```
.venv/bin/pytest tests/unit/test_analysis_service.py -v -k compute_preview_range
```
Expected: both PASS.

- [ ] **Step 5: Commit**

```
git add backend/app/services/analysis_service.py backend/tests/unit/test_analysis_service.py
git commit -m "feat(analysis): add compute_preview_range for n_factors exploration"
```

---

### Task 5: `POST /preview-range` endpoint with PCA-only gate

**Files:**
- Modify: `backend/app/schemas/analysis.py`
- Modify: `backend/app/routers/admin/analysis.py`
- Test: `backend/tests/integration/test_analysis.py`

- [ ] **Step 1: Add the schemas**

In `backend/app/schemas/analysis.py`, after `EigenvalueResult` (around line 265):

```python
class PreviewRangeRequest(BaseModel):
    """Request body for POST /analysis/preview-range."""

    n_factors_range: list[int] = Field(
        min_length=1,
        max_length=8,
        description="Candidate k values, e.g. [2, 3, 4, 5, 6].",
    )
    extraction: str = Field(default="pca")
    rotation: str = Field(default="varimax")
    flagging: str = Field(default="auto")


class PreviewRangeRow(BaseModel):
    """One PreviewSummary row, mirrors the service TypedDict."""

    n_factors: int
    cumulative_variance: float
    pct_flagged: float
    n_distinguishing: int
    n_cross_loaders: int
    n_consensus: int
    min_defining_sorts: int
    has_empty_factor: bool


class PreviewRangeResponse(BaseModel):
    rows: list[PreviewRangeRow]
```

- [ ] **Step 2: Write the failing tests**

Add to `backend/tests/integration/test_analysis.py`:

```python
async def test_preview_range_pca_varimax_returns_rows(
    client: AsyncClient,
    seed_study,
    auth_headers,
    db,
    _make_analysis_study,
):
    study = await _make_analysis_study(db, seed_study)
    resp = await client.post(
        f"/api/admin/studies/{study.slug}/analysis/preview-range",
        headers=auth_headers,
        json={
            "n_factors_range": [2],
            "extraction": "pca",
            "rotation": "varimax",
            "flagging": "auto",
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert "rows" in body
    assert len(body["rows"]) == 1
    row = body["rows"][0]
    assert row["n_factors"] == 2
    assert "cumulative_variance" in row
    assert "min_defining_sorts" in row
    assert "has_empty_factor" in row


async def test_preview_range_rejects_centroid(
    client: AsyncClient,
    seed_study,
    auth_headers,
    db,
    _make_analysis_study,
):
    study = await _make_analysis_study(db, seed_study)
    resp = await client.post(
        f"/api/admin/studies/{study.slug}/analysis/preview-range",
        headers=auth_headers,
        json={
            "n_factors_range": [2],
            "extraction": "centroid",
            "rotation": "varimax",
            "flagging": "auto",
        },
    )
    assert resp.status_code == 400
    assert "PCA" in resp.json()["detail"]


async def test_preview_range_rejects_judgmental(
    client: AsyncClient,
    seed_study,
    auth_headers,
    db,
    _make_analysis_study,
):
    study = await _make_analysis_study(db, seed_study)
    resp = await client.post(
        f"/api/admin/studies/{study.slug}/analysis/preview-range",
        headers=auth_headers,
        json={
            "n_factors_range": [2],
            "extraction": "pca",
            "rotation": "judgmental",
            "flagging": "auto",
        },
    )
    assert resp.status_code == 400
    assert "judgmental" in resp.json()["detail"].lower()


async def test_preview_range_clamps_max_k(
    client: AsyncClient,
    seed_study,
    auth_headers,
    db,
    _make_analysis_study,
):
    """k must be <= min(8, n_participants - 1). Out-of-range → 400."""
    study = await _make_analysis_study(db, seed_study)
    # _make_analysis_study creates 3 participants → max k is 2.
    resp = await client.post(
        f"/api/admin/studies/{study.slug}/analysis/preview-range",
        headers=auth_headers,
        json={
            "n_factors_range": [2, 3],
            "extraction": "pca",
            "rotation": "varimax",
            "flagging": "auto",
        },
    )
    assert resp.status_code == 400
```

- [ ] **Step 3: Run tests to verify they fail**

Run:
```
.venv/bin/pytest tests/integration/test_analysis.py -v -k preview_range
```
Expected: 404 (route not registered).

- [ ] **Step 4: Implement the endpoint**

In `backend/app/routers/admin/analysis.py`, after the `run_factor_analysis` block (before the `_load_run` helper around line 389), add:

```python
@router.post("/{slug}/analysis/preview-range")
@limiter.limit("10/minute")
async def preview_range(
    request: Request,
    body: PreviewRangeRequest,
    study: Study = Depends(check_study_permission(StudyRole.viewer)),
    db: AsyncSession = Depends(get_db),
) -> PreviewRangeResponse:
    """Compute summaries for a range of n_factors values without persisting.

    Gated to PCA + varimax (or no rotation): centroid extraction (Brown 1980)
    and judgmental rotation are path-dependent, so previewing them would
    silently mislead. Bootstrap is excluded — it is not a retention criterion
    and would dominate the cost budget.
    """
    if body.extraction != "pca":
        raise HTTPException(
            status_code=400,
            detail="Preview range supports PCA extraction only "
            "(centroid is path-dependent; commit a real run to inspect).",
        )
    if body.rotation not in {"varimax", "none"}:
        raise HTTPException(
            status_code=400,
            detail="Preview range supports varimax rotation only "
            "(judgmental rotation is path-dependent; commit a real run to inspect).",
        )

    dump = await _get_analysis_dump(db, study.id)
    n_participants = len(dump["participants"])
    max_k = min(8, max(n_participants - 1, 1))
    bad = [k for k in body.n_factors_range if k < 2 or k > max_k]
    if bad:
        raise HTTPException(
            status_code=400,
            detail=(
                f"n_factors values {bad} out of range. Allowed: "
                f"[2, {max_k}] given {n_participants} participants."
            ),
        )

    try:
        rows = await asyncio.to_thread(
            lambda: compute_preview_range(
                dump=dump,
                n_factors_range=sorted(body.n_factors_range),
                extraction=body.extraction,
                rotation=body.rotation,
                flagging=body.flagging,
            )
        )
    except (np.linalg.LinAlgError, ValueError) as e:
        raise HTTPException(
            status_code=400,
            detail=f"Preview range computation failed: {e}",
        )

    return PreviewRangeResponse(
        rows=[PreviewRangeRow(**r) for r in rows]
    )
```

Add to imports near top:

```python
from ...schemas import (
    AnalysisRequest,
    AnalysisResult,
    AnalysisRunPatch,
    AnalysisRunRead,
    AnalysisRunSummary,
    BootstrapResult,
    BootstrapStatementStability,
    EigenvalueResult,
    FactorCharacteristic,
    ParticipantAudioRecording,
    ParticipantCardComment,
    ParticipantLoading,
    PreviewRangeRequest,
    PreviewRangeResponse,
    PreviewRangeRow,
    StatementClassification,
    StatementScore,
)
from ...services.analysis_service import (
    apply_manual_flags,
    build_sort_matrix,
    compute_bootstrap_stability,
    compute_eigenvalues,
    compute_parallel_analysis_n,
    compute_preview_range,
    compute_velicer_map_n,
    correlation_matrix,
    run_analysis,
)
```

And in `backend/app/schemas/__init__.py`, ensure the new symbols are re-exported (check the file; if it explicitly lists exports, add `PreviewRangeRequest`, `PreviewRangeRow`, `PreviewRangeResponse`).

- [ ] **Step 5: Run tests to verify they pass**

Run:
```
.venv/bin/pytest tests/integration/test_analysis.py -v -k preview_range
```
Expected: 4 passed.

- [ ] **Step 6: Run the full backend test suite**

Run from `backend/`:
```
.venv/bin/pytest -x
```
Expected: no regressions.

- [ ] **Step 7: Commit**

```
git add backend/app/schemas/ backend/app/routers/admin/analysis.py backend/tests/integration/test_analysis.py
git commit -m "feat(analysis): add POST /preview-range with PCA+varimax gate"
```

---

### Task 6: Property test — preview-range consistency

**Files:**
- Modify: `backend/tests/property/test_analysis_invariants.py`

- [ ] **Step 1: Add the property test**

Append to `backend/tests/property/test_analysis_invariants.py`:

```python
from hypothesis import given, settings, strategies as st

from app.services.analysis_service import (
    build_sort_matrix,
    compute_preview_range,
    run_analysis,
)


@given(
    n_participants=st.integers(min_value=4, max_value=8),
    n_statements=st.integers(min_value=6, max_value=12),
    seed=st.integers(min_value=0, max_value=100),
)
@settings(max_examples=10, deadline=10000)
def test_preview_range_matches_real_run(n_participants, n_statements, seed):
    """preview-range row[k] must agree with run_analysis(k) on counts."""
    import numpy as np

    rng = np.random.default_rng(seed)
    dataset = rng.standard_normal(size=(n_statements, n_participants))
    grid_config = [
        {"score": s, "capacity": 1}
        for s in range(-(n_statements // 2), n_statements // 2 + 1)
    ][:n_statements]
    # Build a minimal SortDataDump shape directly from the dataset.
    dump = {
        "study": {"id": 1, "grid_config": grid_config},
        "participants": [
            {"id": i, "label": f"P{i}", "scores": dataset[:, i].tolist()}
            for i in range(n_participants)
        ],
        "statements": [
            {"id": j, "code": f"S{j}", "translations": [{"language_code": "en", "text": f"s{j}"}]}
            for j in range(n_statements)
        ],
    }
    k = 2
    rows = compute_preview_range(dump, [k], "pca", "varimax", "auto")
    real = run_analysis(
        dataset, n_factors=k, extraction="pca", rotation="varimax",
        flagging="auto", grid_config=grid_config,
    )
    assert rows[0]["n_distinguishing"] == len(real["distinguishing"])
    assert rows[0]["n_consensus"] == len(real["consensus"])
```

(If the SortDataDump shape in your test doesn't match the actual TypedDict — check `app/types/wire.py:SortDataDump` — adjust the dict literal to match required keys. The skeleton above shows intent.)

- [ ] **Step 2: Run the test**

Run:
```
.venv/bin/pytest tests/property/test_analysis_invariants.py -v -k preview_range
```
Expected: PASS (10 examples).

- [ ] **Step 3: Commit**

```
git add backend/tests/property/test_analysis_invariants.py
git commit -m "test(analysis): hypothesis property — preview-range matches run_analysis"
```

---

### Task 7: PR 1 quality gate + PR creation

- [ ] **Step 1: Run `make ci` and verify green**

Run from project root:
```
make ci
```
Expected: lint + check + test + build all PASS. If anything fails, fix inline.

- [ ] **Step 2: Regenerate the API client (frontend types only)**

Run:
```
make generate-api
```

Expected: `frontend/src/api/generated.ts` and `frontend/src/api/model/*` updated. The new schemas (`PreviewRangeRequest`, `PreviewRangeRow`, `PreviewRangeResponse`) appear in `frontend/src/api/model/`.

Run `make ci-fast` to confirm frontend still builds:
```
make ci-fast
```

- [ ] **Step 3: Commit regenerated client**

```
git add frontend/src/api/
git commit -m "chore(api): regenerate client for /eigenvalues + /preview-range"
```

- [ ] **Step 4: Push and open PR**

```
git push -u origin <branch>
gh pr create --title "feat(analysis): backend diagnostics + preview-range (phase 1/5)" --body "$(cat <<'EOF'
## Summary

- Adds Horn (1965) parallel analysis + Velicer (1976) MAP to `GET /admin/studies/{slug}/analysis/eigenvalues`.
- Adds `POST /admin/studies/{slug}/analysis/preview-range` returning per-k summaries (cumulative variance, % flagged, # distinguishing/cross-loaders/consensus, min defining sorts, has empty factor).
- Gated to PCA + varimax for methodological honesty (centroid + judgmental are path-dependent).
- No frontend behaviour change yet — the new fields are unread by the current UI.

Spec: `docs/superpowers/specs/2026-04-29-analysis-module-improvements-design.md` §4.

## Test plan
- [x] Unit tests: `compute_parallel_analysis_n`, `compute_velicer_map_n`, `compute_preview_range`
- [x] Integration tests: enriched `/eigenvalues`, `/preview-range` happy path + 3 rejection cases
- [x] Property test: preview-range row[k] == real run_analysis(k)
- [x] `make ci` green

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

# Phase 2 — Hook split refactor (no UI change)

**PR boundary.** Ships independently. After Phase 2: page routing depends on `?phase=…`; `useAnalysisPage` is gone, replaced by `useExplorePhase` + `useInterpretPhase`. UI is rendered identically — the existing `AnalysisPage.test.tsx` snapshot of behaviour passes unchanged.

**Goal:** Split the monolithic 557-LOC hook into two focused hooks, route the page by URL phase. **No visible UI change.** The existing four tabs, history panel, factor narratives, voices panel — everything renders as before.

> Strategy: this is a refactor PR. Take care to not introduce behaviour changes. After this PR, *every* `AnalysisPage.test.tsx` test that passed before must still pass.

---

### Task 8: Snapshot existing analysis-page behaviour

**Files:** none modified.

- [ ] **Step 1: Capture the current passing test set**

Run:
```
cd frontend && npx vitest run src/pages/admin/AnalysisPage.test.tsx src/hooks/admin/useAnalysisPage.test.ts 2>&1 | tee /tmp/analysis_pre_refactor_tests.txt
```

Expected: all green. Note the count.

- [ ] **Step 2: Read `useAnalysisPage.ts` end-to-end** to confirm the public API surface listed in `interface AnalysisPageApi`. The new hooks must collectively expose every field/handler the page consumes.

No commit at this step — pure investigation.

---

### Task 9: Create `useExplorePhase` (rename + scope reduction)

**Files:**
- Create: `frontend/src/hooks/admin/useExplorePhase.ts`
- Create: `frontend/src/hooks/admin/useExplorePhase.test.ts`

- [ ] **Step 1: Copy the existing hook**

```
cp frontend/src/hooks/admin/useAnalysisPage.ts frontend/src/hooks/admin/useExplorePhase.ts
cp frontend/src/hooks/admin/useAnalysisPage.test.ts frontend/src/hooks/admin/useExplorePhase.test.ts
```

- [ ] **Step 2: Rename in the new files**

Edit `frontend/src/hooks/admin/useExplorePhase.ts`:
- Rename `useAnalysisPage` → `useExplorePhase`.
- Rename `AnalysisPageApi` → `ExplorePhaseApi`.
- Update the docstring header to read "Explorer phase: form state, eigenvalues, diagnostics, commit handler. Does NOT manage the post-run interpretation surfaces (those live in `useInterpretPhase`)."
- Remove `result`, `viewingRun`, `freshRun`, `currentRun`, `isViewingHistorical`, `showFactorNarratives`, `setShowFactorNarratives`, `handleLoadHistoricalRun`, `handleClearHistoricalView`, `handleToggleFlag`, `handleExport` — these belong to the Interpret phase. The `handleRunAnalysis` callback stays but its `onSuccess` no longer needs to invalidate the runs query nor fetch `freshRun` — instead it returns the new `runId` so the caller can navigate to `?phase=interpret&runId=…`.

Concretely, replace the `handleRunAnalysis` `onSuccess` block:

```typescript
onSuccess: async (data) => {
    syncParams(extraction, nFactors, rotation, flagging);
    toast.success(
        t('admin.analysis.success', 'Analysis complete — {{n}} factors extracted', {
            n: data.n_factors,
        })
    );
    // Invalidate the runs list so the history panel (rendered in either
    // phase via the parent page) refreshes when the analyst returns.
    const runsQueryKey =
        getListAnalysisRunsApiAdminStudiesSlugAnalysisRunsGetQueryKey(slug);
    queryClient.invalidateQueries({ queryKey: runsQueryKey });
    // Look up the freshly created run id so the caller can route.
    try {
        const runs = await listAnalysisRunsApiAdminStudiesSlugAnalysisRunsGet(slug);
        const fresh = runs.length > 0 ? (runs[0] ?? null) : null;
        if (fresh) onCommit(fresh.id);
    } catch {
        // Non-fatal: the analyst can navigate via history.
    }
},
```

Add an `onCommit` callback parameter:

```typescript
export function useExplorePhase(
    slug: string,
    onCommit: (runId: number) => void,
): ExplorePhaseApi { … }
```

- [ ] **Step 3: Update the test file accordingly**

Edit `frontend/src/hooks/admin/useExplorePhase.test.ts`:
- Replace import `useAnalysisPage` with `useExplorePhase`.
- Pass a mock `onCommit` to all `renderHook` calls: `renderHook(() => useExplorePhase('test-slug', vi.fn()))`.
- Delete tests that exercise removed fields (`result`, `viewingRun`, `handleLoadHistoricalRun`, `handleToggleFlag`, `handleExport`, `showFactorNarratives`). Keep eigenvalues / form-state / commit tests.
- Add one new test:

```typescript
it('calls onCommit with the fresh runId after successful analysis', async () => {
    // Mock listAnalysisRuns to return a freshest run.
    server.use(
        http.post('/api/admin/studies/:slug/analysis/run', () =>
            HttpResponse.json(buildAnalysisResult())),
        http.get('/api/admin/studies/:slug/analysis/runs', () =>
            HttpResponse.json([{ id: 99, ran_at: '2026-04-29T10:00:00Z', n_factors: 3 }])),
    );
    const onCommit = vi.fn();
    const { result } = renderHook(() => useExplorePhase('test-slug', onCommit));
    await act(async () => result.current.handleRunAnalysis());
    await waitFor(() => expect(onCommit).toHaveBeenCalledWith(99));
});
```

(Adjust to match the existing MSW fixture conventions in the file.)

- [ ] **Step 4: Run the new hook tests**

Run from `frontend/`:
```
npx vitest run src/hooks/admin/useExplorePhase.test.ts
```
Expected: all tests pass.

- [ ] **Step 5: Commit**

```
git add frontend/src/hooks/admin/useExplorePhase.ts frontend/src/hooks/admin/useExplorePhase.test.ts
git commit -m "refactor(analysis): rename useAnalysisPage → useExplorePhase + scope reduction"
```

---

### Task 10: Create `useInterpretPhase`

**Files:**
- Create: `frontend/src/hooks/admin/useInterpretPhase.ts`
- Create: `frontend/src/hooks/admin/useInterpretPhase.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/hooks/admin/useInterpretPhase.test.ts`:

```typescript
import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/server';
import { useInterpretPhase } from './useInterpretPhase';
import { renderWithStore } from '@/test/renderWithStore';

const RUN_RESPONSE = {
    id: 42,
    ran_at: '2026-04-29T10:00:00Z',
    n_factors: 3,
    extraction: 'pca',
    rotation: 'varimax',
    flagging: 'auto',
    notes: null,
    factor_notes: { '1': 'Existing F1 narrative.' },
    result: {
        n_factors: 3,
        n_participants: 10,
        n_statements: 30,
        participants: [
            { db_id: 1, label: 'P1', loadings: [0.8, 0.1, 0.0], flagged_factors: [1] },
            { db_id: 2, label: 'P2', loadings: [0.1, 0.9, 0.0], flagged_factors: [2] },
        ],
        statement_scores: [],
        distinguishing: [],
        consensus: [],
        factor_characteristics: [],
    },
};

describe('useInterpretPhase', () => {
    it('fetches the run by id and exposes summary + result', async () => {
        server.use(
            http.get('/api/admin/studies/test-slug/analysis/runs/42', () =>
                HttpResponse.json(RUN_RESPONSE)),
        );
        const { result } = renderHook(
            () => useInterpretPhase('test-slug', 42, 'f1', null),
            { wrapper: renderWithStore },
        );
        await waitFor(() => expect(result.current.run).not.toBeNull());
        expect(result.current.run?.id).toBe(42);
        expect(result.current.activeFactor).toBe(1);
    });

    it('filters voices to participants flagged on the active factor', async () => {
        server.use(
            http.get('/api/admin/studies/test-slug/analysis/runs/42', () =>
                HttpResponse.json(RUN_RESPONSE)),
            http.get('/api/admin/studies/test-slug/analysis/audios', () =>
                HttpResponse.json({ audios: [] })),
            http.get('/api/admin/studies/test-slug/analysis/comments', () =>
                HttpResponse.json({ comments: [] })),
        );
        const { result } = renderHook(
            () => useInterpretPhase('test-slug', 42, 'f1', null),
            { wrapper: renderWithStore },
        );
        await waitFor(() => expect(result.current.flaggedParticipants).toHaveLength(1));
        expect(result.current.flaggedParticipants[0].db_id).toBe(1);
    });

    it('appends quote snippet to factor narrative draft', async () => {
        server.use(
            http.get('/api/admin/studies/test-slug/analysis/runs/42', () =>
                HttpResponse.json(RUN_RESPONSE)),
        );
        const { result } = renderHook(
            () => useInterpretPhase('test-slug', 42, 'f1', null),
            { wrapper: renderWithStore },
        );
        await waitFor(() => expect(result.current.run).not.toBeNull());
        result.current.appendToNarrative('> sample quote');
        expect(result.current.narrativeDraft).toContain('> sample quote');
    });

    it('switches focus when activeFactor URL param changes', async () => {
        server.use(
            http.get('/api/admin/studies/test-slug/analysis/runs/42', () =>
                HttpResponse.json(RUN_RESPONSE)),
        );
        const { result, rerender } = renderHook(
            ({ focus }: { focus: string }) =>
                useInterpretPhase('test-slug', 42, focus, null),
            { initialProps: { focus: 'f1' }, wrapper: renderWithStore },
        );
        await waitFor(() => expect(result.current.run).not.toBeNull());
        rerender({ focus: 'f2' });
        await waitFor(() => expect(result.current.activeFactor).toBe(2));
    });

    it('exposes a no-compare state when compareTo is null', async () => {
        server.use(
            http.get('/api/admin/studies/test-slug/analysis/runs/42', () =>
                HttpResponse.json(RUN_RESPONSE)),
        );
        const { result } = renderHook(
            () => useInterpretPhase('test-slug', 42, 'f1', null),
            { wrapper: renderWithStore },
        );
        await waitFor(() => expect(result.current.run).not.toBeNull());
        expect(result.current.compareRun).toBeNull();
        expect(result.current.deltaByStatement).toBeNull();
    });

    it('returns null run when runId is missing', () => {
        const { result } = renderHook(
            () => useInterpretPhase('test-slug', null, 'f1', null),
            { wrapper: renderWithStore },
        );
        expect(result.current.run).toBeNull();
    });
});
```

(Adjust `renderWithStore` import to match your test harness — check `frontend/src/test/`.)

- [ ] **Step 2: Run tests to verify they fail**

Run:
```
npx vitest run src/hooks/admin/useInterpretPhase.test.ts
```
Expected: ImportError / Cannot find module.

- [ ] **Step 3: Implement `useInterpretPhase`**

Create `frontend/src/hooks/admin/useInterpretPhase.ts`:

```typescript
/*
 * Qualis - Open-source platform for conducting Q-methodology research
 * Copyright (C) 2025 Julien Vastenekels
 * Licensed under the GNU Affero General Public License v3.0 or later.
 */

/**
 * useInterpretPhase hook
 *
 * Encapsulates the Interpret phase: fetch the active run by id, optionally
 * fetch a comparison run, derive per-factor view-models (statements, voices,
 * comments), and expose the narrative-draft state + quote-insert callback.
 *
 * Visual state stays in the page component (factor selector chips, mode
 * toggle, compare-pin picker open state).
 */

import { useCallback, useMemo, useState, useEffect } from 'react';
import {
    useGetAnalysisRunApiAdminStudiesSlugAnalysisRunsRunIdGet,
    useListAudiosForParticipantsApiAdminStudiesSlugAnalysisAudiosGet,
    useListCommentsForParticipantsApiAdminStudiesSlugAnalysisCommentsGet,
} from '@/api/generated';
import type { AnalysisRunRead, ParticipantLoading } from '@/api/model';

export interface InterpretPhaseApi {
    run: AnalysisRunRead | null;
    isLoading: boolean;
    isError: boolean;
    activeFactor: number; // 1-based
    flaggedParticipants: ParticipantLoading[];
    narrativeDraft: string;
    setNarrativeDraft: (draft: string) => void;
    appendToNarrative: (snippet: string) => void;
    compareRun: AnalysisRunRead | null;
    deltaByStatement: Map<number, number> | null;
}

function focusToFactor(focus: string): number {
    const m = focus.match(/^f(\d+)$/i);
    return m ? Number(m[1]) : 1;
}

export function useInterpretPhase(
    slug: string,
    runId: number | null,
    focus: string,
    compareTo: number | null,
): InterpretPhaseApi {
    const runQuery = useGetAnalysisRunApiAdminStudiesSlugAnalysisRunsRunIdGet(
        slug, runId ?? 0, { query: { enabled: !!slug && runId !== null } },
    );
    const compareQuery = useGetAnalysisRunApiAdminStudiesSlugAnalysisRunsRunIdGet(
        slug, compareTo ?? 0, { query: { enabled: !!slug && compareTo !== null } },
    );
    const activeFactor = focusToFactor(focus);

    const flaggedParticipants = useMemo(() => {
        const result = runQuery.data?.result;
        if (!result) return [];
        return result.participants.filter((p) =>
            (p.flagged_factors ?? []).includes(activeFactor)
        );
    }, [runQuery.data, activeFactor]);

    const [narrativeDraft, setNarrativeDraftState] = useState<string>('');
    useEffect(() => {
        const stored = runQuery.data?.factor_notes?.[String(activeFactor)] ?? '';
        setNarrativeDraftState(stored);
    }, [runQuery.data, activeFactor]);

    const setNarrativeDraft = useCallback((draft: string) => {
        setNarrativeDraftState(draft);
    }, []);

    const appendToNarrative = useCallback((snippet: string) => {
        setNarrativeDraftState((prev) => (prev ? `${prev}\n\n${snippet}` : snippet));
    }, []);

    const deltaByStatement = useMemo(() => {
        const a = runQuery.data?.result;
        const b = compareQuery.data?.result;
        if (!a || !b) return null;
        const map = new Map<number, number>();
        // For active factor, compute Δz per statement (matched by statement_id).
        // The compareTo factor is matched via Tucker's φ — for v1, we use the same
        // factor index (FactorCanvas / CompareBar refines this with the φ utility).
        for (const s of a.statement_scores) {
            const matching = b.statement_scores.find(
                (x) => x.statement_id === s.statement_id
            );
            if (!matching) continue;
            const za = s.z_scores[activeFactor - 1] ?? 0;
            const zb = matching.z_scores[activeFactor - 1] ?? 0;
            map.set(s.statement_id, za - zb);
        }
        return map;
    }, [runQuery.data, compareQuery.data, activeFactor]);

    return {
        run: runQuery.data ?? null,
        isLoading: runQuery.isLoading,
        isError: runQuery.isError,
        activeFactor,
        flaggedParticipants,
        narrativeDraft,
        setNarrativeDraft,
        appendToNarrative,
        compareRun: compareQuery.data ?? null,
        deltaByStatement,
    };
}
```

- [ ] **Step 4: Run tests**

```
npx vitest run src/hooks/admin/useInterpretPhase.test.ts
```
Expected: 6 PASS.

- [ ] **Step 5: Commit**

```
git add frontend/src/hooks/admin/useInterpretPhase.ts frontend/src/hooks/admin/useInterpretPhase.test.ts
git commit -m "feat(analysis): add useInterpretPhase hook for per-factor canvas state"
```

---

### Task 11: Route `AnalysisPage` by `?phase=…`

**Files:**
- Modify: `frontend/src/pages/admin/AnalysisPage.tsx`
- Modify: `frontend/src/pages/admin/AnalysisPage.test.tsx`

- [ ] **Step 1: Add a phase test**

In `frontend/src/pages/admin/AnalysisPage.test.tsx`, add (preserving existing tests):

```typescript
it('renders Explorer phase by default when no run is loaded', async () => {
    renderWithProviders(<AnalysisPage />, { initialEntries: ['/app/x/studies/y/analysis'] });
    await waitFor(() => {
        expect(screen.getByRole('button', { name: /run analysis/i })).toBeInTheDocument();
    });
});

it('renders Interpret phase when ?phase=interpret&runId=42', async () => {
    server.use(
        http.get('/api/admin/studies/y/analysis/runs/42', () =>
            HttpResponse.json(/* ... existing run fixture ... */)),
    );
    renderWithProviders(<AnalysisPage />, {
        initialEntries: ['/app/x/studies/y/analysis?phase=interpret&runId=42'],
    });
    await waitFor(() => {
        expect(screen.getByText(/run #42/i)).toBeInTheDocument();
    });
});

it('navigates to interpret phase after a successful run', async () => {
    server.use(
        http.post('/api/admin/studies/y/analysis/run', () =>
            HttpResponse.json(/* ... */)),
        http.get('/api/admin/studies/y/analysis/runs', () =>
            HttpResponse.json([{ id: 99, ran_at: '...', n_factors: 3 }])),
    );
    const { history } = renderWithProviders(<AnalysisPage />, {
        initialEntries: ['/app/x/studies/y/analysis'],
    });
    fireEvent.click(screen.getByRole('button', { name: /run analysis/i }));
    await waitFor(() => {
        expect(history.location.search).toContain('phase=interpret');
        expect(history.location.search).toContain('runId=99');
    });
});
```

(Adjust `renderWithProviders` and the run fixture to match the test harness.)

- [ ] **Step 2: Run tests to verify they fail**

```
npx vitest run src/pages/admin/AnalysisPage.test.tsx
```
Expected: failures on the three new cases.

- [ ] **Step 3: Refactor `AnalysisPage.tsx` to read `?phase=`**

Edit `frontend/src/pages/admin/AnalysisPage.tsx`. Replace the body with:

```typescript
import { useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChartColumnStacked } from 'lucide-react';
import { StudyPageHeader } from '@/components/admin/layout/StudyPageHeader';
import { EmptyStateContract } from '@/components/admin/EmptyStateContract';
import { AnalysisHistoryPanel } from '@/components/admin/analysis/AnalysisHistoryPanel';
import { useExplorePhase } from '@/hooks/admin/useExplorePhase';
import { useInterpretPhase } from '@/hooks/admin/useInterpretPhase';
// Existing tabbed-results components (Overview mode):
import { FactorLoadingsTable } from '@/components/admin/analysis/FactorLoadingsTable';
import { FactorArraysView } from '@/components/admin/analysis/FactorArraysView';
import { StatementsTable } from '@/components/admin/analysis/StatementsTable';
import { FactorCharacteristicsTable } from '@/components/admin/analysis/FactorCharacteristicsTable';

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: JSX shell complexity from
//   conditional Explorer/Interpret routing + Overview vs Focus toggle. All logic lives
//   in useExplorePhase and useInterpretPhase.
export default function AnalysisPage() {
    const { studySlug, projectSlug } = useParams();
    const slug = studySlug ?? '';
    const { t } = useTranslation();
    const [searchParams, setSearchParams] = useSearchParams();

    const phase = searchParams.get('phase') ?? 'explore';
    const runIdParam = searchParams.get('runId');
    const runId = runIdParam ? Number(runIdParam) : null;
    const focus = searchParams.get('focus') ?? 'f1';
    const compareToParam = searchParams.get('compareTo');
    const compareTo = compareToParam ? Number(compareToParam) : null;

    const navigateToInterpret = useCallback(
        (newRunId: number) => {
            setSearchParams(
                (prev) => {
                    const p = new URLSearchParams(prev);
                    p.set('phase', 'interpret');
                    p.set('runId', String(newRunId));
                    p.delete('extraction');
                    p.delete('nFactors');
                    p.delete('rotation');
                    p.delete('flagging');
                    return p;
                },
                { replace: true }
            );
        },
        [setSearchParams]
    );

    const explore = useExplorePhase(slug, navigateToInterpret);
    const interpret = useInterpretPhase(slug, runId, focus, compareTo);

    // ── Empty-state contract preserved ───────────────────────────
    if (
        explore.isTooFewParticipants &&
        !interpret.run &&
        !explore.isRunning
    ) {
        return (
            <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6 pt-2">
                <StudyPageHeader
                    title={t('admin.analysis.title', 'Analysis')}
                    description={t(
                        'admin.analysis.description',
                        'Factor analysis of Q-sort data — extract viewpoints from participant responses'
                    )}
                    icon={ChartColumnStacked}
                />
                <EmptyStateContract /* … existing props unchanged … */ />
                <AnalysisHistoryPanel slug={slug} currentRunId={null} /* … */ />
            </div>
        );
    }

    if (phase === 'interpret' && runId !== null) {
        return <InterpretShell
            slug={slug} runId={runId} interpret={interpret}
            t={t} projectSlug={projectSlug ?? ''}
        />;
    }

    return <ExploreShell slug={slug} explore={explore} t={t} />;
}
```

To keep this step tractable, **extract two sub-components** (`<ExploreShell>` and `<InterpretShell>`) at the bottom of the same file. Their bodies hold the JSX that previously lived inline in `AnalysisPage`:

- **`<ExploreShell>`**: copy verbatim the current configuration-card JSX from the existing `AnalysisPage.tsx` (lines 130-650 approximately — everything between the empty-state guard and the history panel that is *not* a results tab). Replace each prior reference to `api.<field>` with `explore.<field>`. Keep the `<AnalysisHistoryPanel slug={slug} currentRunId={null} />` at the bottom.

- **`<InterpretShell>`**: copy verbatim the current results-tabs JSX (the `<Tabs>` block with TabsList for `loadings/arrays/statements/characteristics`, plus its TabsContent children — lines ~660-940 approximately). Replace each prior reference to `api.result` with `interpret.run?.result`, and `api.viewingRun ?? api.freshRun` with `interpret.run`. The bottom history panel becomes `<AnalysisHistoryPanel slug={slug} currentRunId={runId} />`. Add a header marker so the Phase 2 routing test can assert it: `<div data-testid="interpret-phase" className="…">Run #{runId}</div>` near the top.

Both shells receive `t` (from `useTranslation`) so their `t('…','…')` calls work without re-importing.

(Implementation note: this step is the largest single edit of the plan. Take care to preserve the exact JSX of the existing config card and tab layouts when copying them under the phase branches. The data sources change — `explore.extraction`, `interpret.run.result.participants` — but the rendered tree is identical. Run `make ci-fast` after each section migration.)

- [ ] **Step 4: Run all analysis-related tests**

```
npx vitest run src/pages/admin/AnalysisPage.test.tsx src/hooks/admin/useExplorePhase.test.ts src/hooks/admin/useInterpretPhase.test.ts
```
Expected: all pass, including the 3 new phase-routing tests. The pre-refactor count from Task 8 must be preserved (no test removed).

- [ ] **Step 5: Commit**

```
git add frontend/src/pages/admin/AnalysisPage.tsx frontend/src/pages/admin/AnalysisPage.test.tsx
git commit -m "refactor(analysis): route page by ?phase=, no UI change"
```

---

### Task 12: Delete the old hook files

**Files:**
- Delete: `frontend/src/hooks/admin/useAnalysisPage.ts`
- Delete: `frontend/src/hooks/admin/useAnalysisPage.test.ts`

- [ ] **Step 1: Verify no remaining references**

Run:
```
cd frontend && grep -rn "useAnalysisPage" src/
```
Expected: zero matches (after Task 9 + 10 + 11).

- [ ] **Step 2: Delete the files**

```
git rm frontend/src/hooks/admin/useAnalysisPage.ts frontend/src/hooks/admin/useAnalysisPage.test.ts
```

- [ ] **Step 3: Run `make ci-fast`**

```
make ci-fast
```
Expected: green.

- [ ] **Step 4: Commit**

```
git commit -m "chore(analysis): remove legacy useAnalysisPage hook"
```

---

### Task 13: PR 2 quality gate + PR creation

- [ ] **Step 1: `make ci`**

```
make ci
```
Expected: green.

- [ ] **Step 2: Push + open PR**

```
git push
gh pr create --title "refactor(analysis): split useAnalysisPage; phase routing (phase 2/5)" --body "$(cat <<'EOF'
## Summary

- Splits the 557-LOC `useAnalysisPage` into `useExplorePhase` (form state, eigenvalues, commit) and `useInterpretPhase` (run fetch, per-factor view-models, narrative draft, optional compare).
- Routes `AnalysisPage` by `?phase=explore|interpret&runId=&focus=&compareTo=`.
- **No visible UI change** — the existing four tabs, history panel, factor narratives, voices panel render identically.

Spec: `docs/superpowers/specs/2026-04-29-analysis-module-improvements-design.md` §3, §5.6.

## Test plan
- [x] Existing `AnalysisPage.test.tsx` + `useAnalysisPage.test.ts` (renamed) all green
- [x] New `useInterpretPhase.test.ts` (6 cases)
- [x] Phase routing tests
- [x] `make ci` green

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

# Phase 3 — Explorer panel UI

**PR boundary.** Ships independently. After Phase 3: Explore phase shows scree-with-diagnostics + preview-range table + advanced-config disclosure. Interpret phase still uses the legacy four tabs (changes in Phase 4).

**Goal:** Replace the legacy config card with the new `<ExplorerPanel>` (diagnostics + preview-range + advanced disclosure).

---

### Task 14: `tuckerPhi` utility (used in Phase 5 but added now to keep utils together)

**Files:**
- Create: `frontend/src/utils/tuckerPhi.ts`
- Create: `frontend/src/utils/tuckerPhi.test.ts`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/utils/tuckerPhi.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { tuckerPhi, matchFactorsByPhi } from './tuckerPhi';

describe('tuckerPhi', () => {
    it('returns 1 for identical vectors', () => {
        expect(tuckerPhi([1, 2, 3], [1, 2, 3])).toBeCloseTo(1, 5);
    });

    it('returns -1 for opposite vectors', () => {
        expect(tuckerPhi([1, 2, 3], [-1, -2, -3])).toBeCloseTo(-1, 5);
    });

    it('returns 0 for orthogonal vectors', () => {
        expect(tuckerPhi([1, 0], [0, 1])).toBeCloseTo(0, 5);
    });

    it('returns 0 for zero vectors (degenerate)', () => {
        expect(tuckerPhi([0, 0, 0], [1, 2, 3])).toBe(0);
    });
});

describe('matchFactorsByPhi', () => {
    it('matches identical solutions one-to-one', () => {
        const a = [[1, 0], [0, 1], [1, 0]];   // 3 statements x 2 factors
        const b = [[1, 0], [0, 1], [1, 0]];
        const matches = matchFactorsByPhi(a, b);
        expect(matches).toEqual([
            { aIndex: 0, bIndex: 0, phi: expect.closeTo(1, 5) },
            { aIndex: 1, bIndex: 1, phi: expect.closeTo(1, 5) },
        ]);
    });

    it('handles different n_factors by leaving extra columns unmatched', () => {
        const a = [[1, 0], [0, 1]];
        const b = [[1, 0, 0], [0, 1, 0]];
        const matches = matchFactorsByPhi(a, b);
        expect(matches).toHaveLength(2); // a has 2 factors → 2 matches.
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

```
npx vitest run src/utils/tuckerPhi.test.ts
```
Expected: ImportError.

- [ ] **Step 3: Implement**

Create `frontend/src/utils/tuckerPhi.ts`:

```typescript
/**
 * Tucker's congruence coefficient (φ) — normalised dot product over
 * z-score (or loadings) vectors. Used to align factors across two
 * analysis runs in the Compare panel.
 */
export function tuckerPhi(a: readonly number[], b: readonly number[]): number {
    if (a.length !== b.length) {
        throw new Error(
            `tuckerPhi: length mismatch (${a.length} vs ${b.length})`
        );
    }
    let dot = 0;
    let na = 0;
    let nb = 0;
    for (let i = 0; i < a.length; i++) {
        const x = a[i] ?? 0;
        const y = b[i] ?? 0;
        dot += x * y;
        na += x * x;
        nb += y * y;
    }
    if (na === 0 || nb === 0) return 0;
    return dot / Math.sqrt(na * nb);
}

export interface FactorMatch {
    aIndex: number; // 0-based factor index in run A
    bIndex: number; // 0-based factor index in run B
    phi: number;
}

/**
 * Match factors of run A to factors of run B by maximum |φ|.
 * Greedy assignment: for each factor of A in order, pick the unused
 * factor of B with the highest |φ|. Sign of φ is preserved (a flipped
 * match has negative φ).
 *
 * `aMatrix` and `bMatrix` are statement-by-factor (rows = statements,
 * cols = factors). The number of statements must match.
 */
export function matchFactorsByPhi(
    aMatrix: readonly (readonly number[])[],
    bMatrix: readonly (readonly number[])[],
): FactorMatch[] {
    if (aMatrix.length === 0 || bMatrix.length === 0) return [];
    const nFactorsA = aMatrix[0]?.length ?? 0;
    const nFactorsB = bMatrix[0]?.length ?? 0;
    const used = new Set<number>();
    const matches: FactorMatch[] = [];
    for (let i = 0; i < nFactorsA; i++) {
        const aCol = aMatrix.map((row) => row[i] ?? 0);
        let best: FactorMatch | null = null;
        for (let j = 0; j < nFactorsB; j++) {
            if (used.has(j)) continue;
            const bCol = bMatrix.map((row) => row[j] ?? 0);
            const phi = tuckerPhi(aCol, bCol);
            if (best === null || Math.abs(phi) > Math.abs(best.phi)) {
                best = { aIndex: i, bIndex: j, phi };
            }
        }
        if (best !== null) {
            used.add(best.bIndex);
            matches.push(best);
        }
    }
    return matches;
}
```

- [ ] **Step 4: Run tests**

```
npx vitest run src/utils/tuckerPhi.test.ts
```
Expected: 6 PASS.

- [ ] **Step 5: Commit**

```
git add frontend/src/utils/tuckerPhi.ts frontend/src/utils/tuckerPhi.test.ts
git commit -m "feat(analysis): add Tucker's φ + factor-matching utility"
```

---

### Task 15: `ScreeWithDiagnostics` component

**Files:**
- Create: `frontend/src/components/admin/analysis/ScreeWithDiagnostics.tsx`
- Create: `frontend/src/components/admin/analysis/ScreeWithDiagnostics.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/components/admin/analysis/ScreeWithDiagnostics.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ScreeWithDiagnostics } from './ScreeWithDiagnostics';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n';

const wrap = (ui: React.ReactNode) => (
    <I18nextProvider i18n={i18n}>{ui}</I18nextProvider>
);

describe('ScreeWithDiagnostics', () => {
    it('renders the three retention indicators', () => {
        render(wrap(
            <ScreeWithDiagnostics
                eigenvalues={[3.2, 2.1, 0.8, 0.4, 0.2]}
                kaiserN={2}
                parallelN={2}
                mapN={3}
            />,
        ));
        expect(screen.getByText(/Kaiser/i)).toBeInTheDocument();
        expect(screen.getByText(/Parallel/i)).toBeInTheDocument();
        expect(screen.getByText(/MAP/i)).toBeInTheDocument();
        expect(screen.getByText('2', { selector: '*' })).toBeTruthy();
        expect(screen.getByText('3', { selector: '*' })).toBeTruthy();
    });

    it('renders the Watts & Stenner advisory banner', () => {
        render(wrap(
            <ScreeWithDiagnostics
                eigenvalues={[1, 0.5]}
                kaiserN={1}
                parallelN={1}
                mapN={1}
            />,
        ));
        expect(screen.getByText(/advisory/i)).toBeInTheDocument();
        expect(screen.getByText(/Watts.*Stenner/i)).toBeInTheDocument();
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

```
npx vitest run src/components/admin/analysis/ScreeWithDiagnostics.test.tsx
```
Expected: ImportError.

- [ ] **Step 3: Implement**

Create `frontend/src/components/admin/analysis/ScreeWithDiagnostics.tsx`:

```typescript
import { useTranslation } from 'react-i18next';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ScreePlot } from './ScreePlot';

interface Props {
    eigenvalues: number[];
    kaiserN: number;
    parallelN: number;
    mapN: number;
}

export function ScreeWithDiagnostics({ eigenvalues, kaiserN, parallelN, mapN }: Props) {
    const { t } = useTranslation();
    return (
        <Card>
            <CardHeader>
                <CardTitle>
                    {t('admin.analysis.explore.diagnostics_title', 'Diagnostics')}
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                <ScreePlot eigenvalues={eigenvalues} suggestedNFactors={kaiserN} />
                <dl className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                        <dt className="text-slate-500">
                            {t('admin.analysis.explore.kaiser', 'Kaiser')}
                        </dt>
                        <dd className="text-lg font-black text-slate-900">{kaiserN}</dd>
                    </div>
                    <div>
                        <dt className="text-slate-500">
                            {t('admin.analysis.explore.parallel', 'Parallel analysis')}
                        </dt>
                        <dd className="text-lg font-black text-slate-900">{parallelN}</dd>
                    </div>
                    <div>
                        <dt className="text-slate-500">
                            {t('admin.analysis.explore.map', 'Velicer\'s MAP')}
                        </dt>
                        <dd className="text-lg font-black text-slate-900">{mapN}</dd>
                    </div>
                </dl>
                <p className="text-xs text-slate-500 italic">
                    {t(
                        'admin.analysis.explore.advisory',
                        'Advisory only — Q-method retention also depends on interpretability and stability (Watts & Stenner 2012).'
                    )}
                </p>
            </CardContent>
        </Card>
    );
}
```

Add the new keys to `frontend/public/locales/en/translation.json` under `admin.analysis.explore.*`:

```json
"explore": {
    "diagnostics_title": "Diagnostics",
    "kaiser": "Kaiser",
    "parallel": "Parallel analysis",
    "map": "Velicer's MAP",
    "advisory": "Advisory only — Q-method retention also depends on interpretability and stability (Watts & Stenner 2012)."
}
```

Mirror in `fr/` and `fi/`. (For French: `"map": "MAP de Velicer"`, `"advisory": "Indicateurs consultatifs — la rétention en Q-méthode dépend aussi de l'interprétabilité et de la stabilité (Watts & Stenner 2012)."` etc.)

- [ ] **Step 4: Run tests**

```
npx vitest run src/components/admin/analysis/ScreeWithDiagnostics.test.tsx
```
Expected: 2 PASS.

- [ ] **Step 5: Commit**

```
git add frontend/src/components/admin/analysis/ScreeWithDiagnostics.tsx frontend/src/components/admin/analysis/ScreeWithDiagnostics.test.tsx frontend/public/locales/
git commit -m "feat(analysis): add ScreeWithDiagnostics with advisory framing"
```

---

### Task 16: `PreviewRangeTable` component

**Files:**
- Create: `frontend/src/components/admin/analysis/PreviewRangeTable.tsx`
- Create: `frontend/src/components/admin/analysis/PreviewRangeTable.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/components/admin/analysis/PreviewRangeTable.test.tsx`:

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PreviewRangeTable } from './PreviewRangeTable';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n';

const wrap = (ui: React.ReactNode) => (
    <I18nextProvider i18n={i18n}>{ui}</I18nextProvider>
);

const ROWS = [
    { n_factors: 2, cumulative_variance: 47.0, pct_flagged: 0.82,
      n_distinguishing: 8, n_cross_loaders: 0, n_consensus: 3,
      min_defining_sorts: 4, has_empty_factor: false },
    { n_factors: 3, cumulative_variance: 58.0, pct_flagged: 0.73,
      n_distinguishing: 14, n_cross_loaders: 1, n_consensus: 2,
      min_defining_sorts: 4, has_empty_factor: false },
    { n_factors: 6, cumulative_variance: 71.0, pct_flagged: 0.40,
      n_distinguishing: 18, n_cross_loaders: 11, n_consensus: 1,
      min_defining_sorts: 0, has_empty_factor: true },
];

describe('PreviewRangeTable', () => {
    it('renders one column per row plus the metric labels', () => {
        render(wrap(
            <PreviewRangeTable rows={ROWS} onSelect={vi.fn()} disabled={false} />,
        ));
        expect(screen.getByText('2')).toBeInTheDocument();
        expect(screen.getByText('3')).toBeInTheDocument();
        expect(screen.getByText('6')).toBeInTheDocument();
        expect(screen.getByText(/cumvar/i)).toBeInTheDocument();
    });

    it('marks rows with has_empty_factor with a warning badge', () => {
        render(wrap(
            <PreviewRangeTable rows={ROWS} onSelect={vi.fn()} disabled={false} />,
        ));
        const warnings = screen.getAllByLabelText(/empty factor/i);
        expect(warnings).toHaveLength(1);
    });

    it('calls onSelect with the chosen k when a column is clicked', () => {
        const onSelect = vi.fn();
        render(wrap(
            <PreviewRangeTable rows={ROWS} onSelect={onSelect} disabled={false} />,
        ));
        fireEvent.click(screen.getByRole('button', { name: /3 factors/i }));
        expect(onSelect).toHaveBeenCalledWith(3);
    });

    it('disables interaction and shows the gate message when disabled', () => {
        render(wrap(
            <PreviewRangeTable rows={[]} onSelect={vi.fn()} disabled={true} />,
        ));
        expect(screen.getByText(/PCA \+ varimax only/i)).toBeInTheDocument();
    });
});
```

- [ ] **Step 2: Run test to verify failure**

```
npx vitest run src/components/admin/analysis/PreviewRangeTable.test.tsx
```
Expected: ImportError.

- [ ] **Step 3: Implement**

Create `frontend/src/components/admin/analysis/PreviewRangeTable.tsx`:

```typescript
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import type { PreviewRangeRow } from '@/api/model/previewRangeRow';

interface Props {
    rows: PreviewRangeRow[];
    onSelect: (k: number) => void;
    disabled: boolean;
}

export function PreviewRangeTable({ rows, onSelect, disabled }: Props) {
    const { t } = useTranslation();
    if (disabled) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>
                        {t('admin.analysis.explore.preview_range_title', 'Preview range')}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-slate-600">
                        {t(
                            'admin.analysis.explore.preview_range_disabled',
                            'Preview range supports PCA + varimax only. Centroid extraction and judgmental rotation are path-dependent — commit a real run to inspect.'
                        )}
                    </p>
                </CardContent>
            </Card>
        );
    }
    return (
        <Card>
            <CardHeader>
                <CardTitle>
                    {t('admin.analysis.explore.preview_range_title', 'Preview range')}
                </CardTitle>
            </CardHeader>
            <CardContent>
                <table className="w-full text-sm">
                    <thead>
                        <tr>
                            <th className="text-left font-medium text-slate-500">k</th>
                            {rows.map((r) => (
                                <th key={r.n_factors}>
                                    <button
                                        type="button"
                                        onClick={() => onSelect(r.n_factors)}
                                        aria-label={t(
                                            'admin.analysis.explore.select_k',
                                            '{{k}} factors',
                                            { k: r.n_factors }
                                        )}
                                        className="font-black text-slate-900 hover:underline"
                                    >
                                        {r.n_factors}
                                        {r.has_empty_factor && (
                                            <AlertTriangle
                                                className="inline ml-1 h-3 w-3 text-amber-500"
                                                aria-label={t(
                                                    'admin.analysis.explore.empty_factor',
                                                    'Empty factor — over-factorisation'
                                                )}
                                            />
                                        )}
                                    </button>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        <Row label={t('admin.analysis.explore.cumvar', 'cumvar %')}
                             values={rows.map((r) => r.cumulative_variance.toFixed(0))} />
                        <Row label={t('admin.analysis.explore.pct_flagged', '% flagged')}
                             values={rows.map((r) => Math.round(r.pct_flagged * 100).toString())} />
                        <Row label={t('admin.analysis.explore.n_distinguishing', '# distinguishing')}
                             values={rows.map((r) => r.n_distinguishing.toString())} />
                        <Row label={t('admin.analysis.explore.n_cross_loaders', '# cross-loaders')}
                             values={rows.map((r) => r.n_cross_loaders.toString())} />
                        <Row label={t('admin.analysis.explore.min_def_sorts', 'min defining sorts')}
                             values={rows.map((r) => r.min_defining_sorts.toString())} />
                    </tbody>
                </table>
            </CardContent>
        </Card>
    );
}

function Row({ label, values }: { label: string; values: string[] }) {
    return (
        <tr>
            <td className="text-slate-500">{label}</td>
            {values.map((v, i) => (
                <td key={i} className="text-center font-mono">{v}</td>
            ))}
        </tr>
    );
}
```

Add locale keys: `admin.analysis.explore.preview_range_title`, `..._disabled`, `select_k`, `empty_factor`, `cumvar`, `pct_flagged`, `n_distinguishing`, `n_cross_loaders`, `min_def_sorts` in `en/`, `fr/`, `fi/`.

- [ ] **Step 4: Run tests**

```
npx vitest run src/components/admin/analysis/PreviewRangeTable.test.tsx
```
Expected: 4 PASS.

- [ ] **Step 5: Commit**

```
git add frontend/src/components/admin/analysis/PreviewRangeTable.tsx frontend/src/components/admin/analysis/PreviewRangeTable.test.tsx frontend/public/locales/
git commit -m "feat(analysis): add PreviewRangeTable component with empty-factor warning"
```

---

### Task 17: Wire diagnostics + preview-range into `useExplorePhase`

**Files:**
- Modify: `frontend/src/hooks/admin/useExplorePhase.ts`
- Modify: `frontend/src/hooks/admin/useExplorePhase.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `frontend/src/hooks/admin/useExplorePhase.test.ts`:

```typescript
it('exposes parallelN and mapN from the eigenvalues query', async () => {
    server.use(
        http.get('/api/admin/studies/test-slug/analysis/eigenvalues', () =>
            HttpResponse.json({
                eigenvalues: [3.2, 2.1, 0.8],
                kaiser_n: 2,
                parallel_analysis_n: 2,
                velicer_map_n: 3,
                suggested_n_factors: 2,
            })),
    );
    const { result } = renderHook(() => useExplorePhase('test-slug', vi.fn()));
    await waitFor(() => expect(result.current.parallelN).toBe(2));
    expect(result.current.mapN).toBe(3);
    expect(result.current.kaiserN).toBe(2);
});

it('triggers preview-range and exposes rows', async () => {
    server.use(
        http.get('/api/admin/studies/test-slug/analysis/eigenvalues', () =>
            HttpResponse.json({/* ... */})),
        http.post('/api/admin/studies/test-slug/analysis/preview-range', () =>
            HttpResponse.json({
                rows: [
                    { n_factors: 2, cumulative_variance: 47, pct_flagged: 0.82,
                      n_distinguishing: 8, n_cross_loaders: 0, n_consensus: 3,
                      min_defining_sorts: 4, has_empty_factor: false },
                ],
            })),
    );
    const { result } = renderHook(() => useExplorePhase('test-slug', vi.fn()));
    await waitFor(() => result.current.handlePreviewRange([2]));
    await waitFor(() => expect(result.current.previewRows).toHaveLength(1));
});

it('disables preview-range when extraction is centroid', () => {
    const { result } = renderHook(() => useExplorePhase('test-slug', vi.fn()));
    act(() => result.current.setExtraction('centroid'));
    expect(result.current.canPreviewRange).toBe(false);
});

it('disables preview-range when rotation is judgmental', () => {
    const { result } = renderHook(() => useExplorePhase('test-slug', vi.fn()));
    act(() => result.current.setRotation('judgmental'));
    expect(result.current.canPreviewRange).toBe(false);
});
```

- [ ] **Step 2: Run tests to verify failure**

```
npx vitest run src/hooks/admin/useExplorePhase.test.ts -t "preview-range"
```

- [ ] **Step 3: Extend the hook**

Edit `frontend/src/hooks/admin/useExplorePhase.ts`:

Add to the `ExplorePhaseApi` interface:

```typescript
kaiserN: number | undefined;
parallelN: number | undefined;
mapN: number | undefined;
canPreviewRange: boolean;
previewRows: PreviewRangeRow[] | undefined;
isPreviewing: boolean;
handlePreviewRange: (range: number[]) => Promise<void>;
```

In the hook body, after the existing eigenvalues query:

```typescript
import {
    usePreviewRangeApiAdminStudiesSlugAnalysisPreviewRangePost,
} from '@/api/generated';
import type { PreviewRangeRow } from '@/api/model/previewRangeRow';

const previewMutation = usePreviewRangeApiAdminStudiesSlugAnalysisPreviewRangePost();
const [previewRows, setPreviewRows] = useState<PreviewRangeRow[] | undefined>(undefined);

const canPreviewRange =
    extraction === 'pca' &&
    (rotation === 'varimax' || rotation === 'none');

const handlePreviewRange = useCallback(
    async (range: number[]) => {
        if (!canPreviewRange) return;
        const data = await previewMutation.mutateAsync({
            slug, data: { n_factors_range: range, extraction, rotation, flagging },
        });
        setPreviewRows(data.rows);
    },
    [slug, extraction, rotation, flagging, canPreviewRange, previewMutation]
);
```

Expose `kaiserN`, `parallelN`, `mapN` from the eigenvalues response.

- [ ] **Step 4: Run tests**

```
npx vitest run src/hooks/admin/useExplorePhase.test.ts
```
Expected: all PASS, including 4 new cases.

- [ ] **Step 5: Commit**

```
git add frontend/src/hooks/admin/useExplorePhase.ts frontend/src/hooks/admin/useExplorePhase.test.ts
git commit -m "feat(analysis): wire diagnostics + preview-range into useExplorePhase"
```

---

### Task 18: `ExplorerPanel` composes diagnostics + preview-range + advanced disclosure

**Files:**
- Create: `frontend/src/components/admin/analysis/ExplorerPanel.tsx`
- Create: `frontend/src/components/admin/analysis/ExplorerPanel.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/components/admin/analysis/ExplorerPanel.test.tsx`:

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ExplorerPanel } from './ExplorerPanel';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n';

const wrap = (ui: React.ReactNode) => (
    <I18nextProvider i18n={i18n}>{ui}</I18nextProvider>
);

const baseExplore = {
    slug: 's', extraction: 'pca', setExtraction: vi.fn(),
    nFactors: 3, setNFactors: vi.fn(),
    rotation: 'varimax', setRotation: vi.fn(),
    flagging: 'auto' as const, setFlagging: vi.fn(),
    manualFlags: {}, manualRotations: [],
    addManualRotation: vi.fn(), updateManualRotation: vi.fn(),
    removeManualRotation: vi.fn(), isJudgmentalWithoutRotations: false,
    bootstrapEnabled: false, setBootstrapEnabled: vi.fn(),
    bootstrapIterations: 1000, setBootstrapIterations: vi.fn(),
    maxFactors: 6, hasEigenvalues: true,
    isTooFewParticipants: false, isEigenvalueError: false,
    eigenvaluesIsLoading: false,
    eigenvalues: [3.2, 2.1, 0.8, 0.4, 0.2, 0.1],
    suggestedNFactors: 2,
    kaiserN: 2, parallelN: 2, mapN: 3,
    canPreviewRange: true, previewRows: undefined, isPreviewing: false,
    handlePreviewRange: vi.fn(),
    handleRefetchEigenvalues: vi.fn(),
    isRunning: false, isExporting: false,
    handleRunAnalysis: vi.fn(),
};

describe('ExplorerPanel', () => {
    it('renders diagnostics + preview-range + advanced disclosure', () => {
        render(wrap(<ExplorerPanel explore={baseExplore} />));
        expect(screen.getByText(/Diagnostics/i)).toBeInTheDocument();
        expect(screen.getByText(/Preview range/i)).toBeInTheDocument();
        expect(screen.getByText(/Advanced/i)).toBeInTheDocument();
    });

    it('selecting a column from PreviewRangeTable updates nFactors', () => {
        const setNFactors = vi.fn();
        const explore = { ...baseExplore, setNFactors, previewRows: [
            { n_factors: 2, cumulative_variance: 47, pct_flagged: 0.8,
              n_distinguishing: 8, n_cross_loaders: 0, n_consensus: 3,
              min_defining_sorts: 4, has_empty_factor: false },
        ]};
        render(wrap(<ExplorerPanel explore={explore} />));
        fireEvent.click(screen.getByRole('button', { name: /2 factors/i }));
        expect(setNFactors).toHaveBeenCalledWith(2);
    });

    it('shows preview-range disabled state when canPreviewRange=false', () => {
        const explore = { ...baseExplore, canPreviewRange: false, extraction: 'centroid' };
        render(wrap(<ExplorerPanel explore={explore} />));
        expect(screen.getByText(/PCA \+ varimax only/i)).toBeInTheDocument();
    });
});
```

- [ ] **Step 2: Run test to verify failure**

- [ ] **Step 3: Implement `ExplorerPanel.tsx`**

Create `frontend/src/components/admin/analysis/ExplorerPanel.tsx`:

```typescript
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Play, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { ScreeWithDiagnostics } from './ScreeWithDiagnostics';
import { PreviewRangeTable } from './PreviewRangeTable';
import type { ExplorePhaseApi } from '@/hooks/admin/useExplorePhase';

interface Props {
    explore: ExplorePhaseApi;
}

export function ExplorerPanel({ explore }: Props) {
    const { t } = useTranslation();

    // Fetch a default preview range when eigenvalues + canPreviewRange land.
    useEffect(() => {
        if (
            explore.canPreviewRange &&
            explore.previewRows === undefined &&
            !explore.isPreviewing &&
            explore.maxFactors >= 2
        ) {
            const range = Array.from(
                { length: Math.min(5, explore.maxFactors - 1) },
                (_, i) => i + 2,
            );
            void explore.handlePreviewRange(range);
        }
    }, [explore]);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ScreeWithDiagnostics
                eigenvalues={explore.eigenvalues ?? []}
                kaiserN={explore.kaiserN ?? 1}
                parallelN={explore.parallelN ?? 1}
                mapN={explore.mapN ?? 1}
            />
            <PreviewRangeTable
                rows={explore.previewRows ?? []}
                onSelect={(k) => explore.setNFactors(k)}
                disabled={!explore.canPreviewRange}
            />
            <div className="lg:col-span-2">
                <Accordion type="single" collapsible>
                    <AccordionItem value="advanced">
                        <AccordionTrigger>
                            {t('admin.analysis.explore.advanced_title', 'Advanced configuration')}
                        </AccordionTrigger>
                        <AccordionContent>
                            {/* The existing extraction / rotation / flagging / bootstrap
                                selectors are extracted into a sibling sub-component
                                or inlined here, sourcing all state from `explore.*`. */}
                            {/* See AnalysisPage's previous configuration card body. */}
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            </div>
            <div className="lg:col-span-2">
                <Button
                    onClick={explore.handleRunAnalysis}
                    disabled={explore.isRunning || explore.isJudgmentalWithoutRotations}
                    size="lg"
                >
                    {explore.isRunning ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <Play className="mr-2 h-4 w-4" />
                    )}
                    {t('admin.analysis.explore.commit_cta', 'Commit and interpret')}
                </Button>
            </div>
        </div>
    );
}
```

- [ ] **Step 4: Run tests**

```
npx vitest run src/components/admin/analysis/ExplorerPanel.test.tsx
```
Expected: 3 PASS.

- [ ] **Step 5: Commit**

```
git add frontend/src/components/admin/analysis/ExplorerPanel.tsx frontend/src/components/admin/analysis/ExplorerPanel.test.tsx
git commit -m "feat(analysis): add ExplorerPanel composing diagnostics + preview + advanced"
```

---

### Task 19: Mount `ExplorerPanel` in `AnalysisPage`

**Files:**
- Modify: `frontend/src/pages/admin/AnalysisPage.tsx`

- [ ] **Step 1: Replace the legacy config card with `<ExplorerPanel>`**

Edit `frontend/src/pages/admin/AnalysisPage.tsx`. In the Explore-phase branch, replace the legacy `<Card>` configuration tree with:

```typescript
<ExplorerPanel explore={explore} />
```

(Import: `import { ExplorerPanel } from '@/components/admin/analysis/ExplorerPanel';`)

- [ ] **Step 2: Run all analysis tests**

```
npx vitest run src/pages/admin/AnalysisPage.test.tsx src/components/admin/analysis/
```
Expected: all PASS.

- [ ] **Step 3: Manual smoke**

Start the dev server, open `…/analysis` on a study with ≥2 participants. Verify Diagnostics card shows three numbers, Preview-range table shows columns, clicking a column updates the n_factors selector in Advanced, "Commit and interpret" runs an analysis and navigates to `?phase=interpret&runId=…`.

- [ ] **Step 4: Commit**

```
git add frontend/src/pages/admin/AnalysisPage.tsx
git commit -m "feat(analysis): mount ExplorerPanel in Explore phase"
```

---

### Task 20: PR 3 quality gate + PR creation

- [ ] **Step 1: `make ci`**

```
make ci
```

- [ ] **Step 2: Push + PR**

```
git push
gh pr create --title "feat(analysis): Explorer panel — diagnostics + preview-range (phase 3/5)" --body "$(cat <<'EOF'
## Summary

Replaces the legacy configuration card on the Explore phase with `<ExplorerPanel>`:

- **Diagnostics card** — scree plot + Kaiser / Parallel / MAP indicators with the Watts & Stenner advisory framing.
- **Preview-range table** — clickable columns for k=2..min(maxFactors, 6) showing cumulative variance, % flagged, # distinguishing, # cross-loaders, min defining sorts, with ⚠ on empty-factor rows. Disabled state when extraction or rotation is path-dependent.
- **Advanced disclosure** wrapping extraction / rotation / flagging / bootstrap selectors.
- **Commit and interpret** button persists the run and routes to `?phase=interpret&runId=…`.

Spec: §4. Interpret phase still uses legacy four tabs — that's the next PR.

## Test plan
- [x] Component tests for ScreeWithDiagnostics, PreviewRangeTable, ExplorerPanel
- [x] Hook tests for diagnostics + preview-range integration
- [x] Manual smoke on a 4-participant study

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

# Phase 4 — Factor Canvas (Interpret focus mode)

**PR boundary.** Ships independently. After Phase 4: Interpret phase has a Per-factor Focus mode (default) and an Overview mode (legacy four tabs). Quote picker inserts comments into the active factor narrative.

**Goal:** Build `<FactorCanvas>`: factor-selector chips, Statements + Voices + Narrative columns, quote picker (comments only).

---

### Task 21: `FactorNoteEditor` accepts an `onInsertQuote` prop

**Files:**
- Modify: `frontend/src/components/admin/analysis/FactorNoteEditor.tsx`
- Modify: `frontend/src/components/admin/analysis/FactorNoteEditor.test.tsx`

- [ ] **Step 1: Write the failing test**

Add to `frontend/src/components/admin/analysis/FactorNoteEditor.test.tsx`:

```typescript
it('exposes appendQuote handler that mutates the draft', async () => {
    const ref = createRef<{ appendQuote: (s: string) => void }>();
    render(wrap(
        <FactorNoteEditor
            slug="s" runId={1} factorIndex={0} currentNote=""
            ref={ref}
        />,
    ));
    fireEvent.click(screen.getByLabelText(/edit/i));
    act(() => ref.current?.appendQuote('> sample quote'));
    expect(screen.getByRole('textbox')).toHaveValue(expect.stringContaining('> sample quote'));
});
```

- [ ] **Step 2: Run test to verify failure**

- [ ] **Step 3: Refactor `FactorNoteEditor`**

Use `forwardRef` + `useImperativeHandle` to expose `appendQuote`:

```typescript
import { forwardRef, useImperativeHandle, useState, useEffect } from 'react';

export interface FactorNoteEditorHandle {
    appendQuote: (snippet: string) => void;
}

export const FactorNoteEditor = forwardRef<FactorNoteEditorHandle, Props>(
    function FactorNoteEditor({ slug, runId, factorIndex, currentNote }, ref) {
        // … existing state …
        useImperativeHandle(ref, () => ({
            appendQuote: (snippet: string) => {
                setIsEditing(true);
                setDraft((prev) => (prev ? `${prev}\n\n${snippet}` : snippet));
            },
        }));
        // … rest unchanged …
    }
);
```

- [ ] **Step 4: Run tests**

```
npx vitest run src/components/admin/analysis/FactorNoteEditor.test.tsx
```

- [ ] **Step 5: Commit**

```
git add frontend/src/components/admin/analysis/FactorNoteEditor.tsx frontend/src/components/admin/analysis/FactorNoteEditor.test.tsx
git commit -m "feat(analysis): expose appendQuote handle on FactorNoteEditor"
```

---

### Task 22: `FactorSelectorChips` component

**Files:**
- Create: `frontend/src/components/admin/analysis/FactorSelectorChips.tsx`

- [ ] **Step 1: Implement directly (trivial component, single test inline)**

```typescript
import { Button } from '@/components/ui/button';

interface Props {
    nFactors: number;
    activeFactor: number; // 1-based
    onSelect: (factor: number) => void;
}

export function FactorSelectorChips({ nFactors, activeFactor, onSelect }: Props) {
    return (
        <div className="flex gap-2" role="tablist">
            {Array.from({ length: nFactors }, (_, i) => i + 1).map((f) => (
                <Button
                    key={f}
                    variant={f === activeFactor ? 'default' : 'outline'}
                    size="sm"
                    role="tab"
                    aria-selected={f === activeFactor}
                    onClick={() => onSelect(f)}
                >
                    F{f}
                </Button>
            ))}
        </div>
    );
}
```

- [ ] **Step 2: Inline test** in `FactorCanvas.test.tsx` (Task 23) — no separate file.

- [ ] **Step 3: Commit**

```
git add frontend/src/components/admin/analysis/FactorSelectorChips.tsx
git commit -m "feat(analysis): add FactorSelectorChips"
```

---

### Task 23: `FactorCanvas` component

**Files:**
- Create: `frontend/src/components/admin/analysis/FactorCanvas.tsx`
- Create: `frontend/src/components/admin/analysis/FactorCanvas.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/components/admin/analysis/FactorCanvas.test.tsx`:

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { FactorCanvas } from './FactorCanvas';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n';

// Build a minimal interpret API stub
const interpretStub = (overrides: Partial<...> = {}) => ({
    run: {
        id: 42, n_factors: 3, factor_notes: { '1': '' },
        result: {
            n_factors: 3,
            participants: [
                { db_id: 1, label: 'P1', loadings: [0.78, 0.0, 0.1], flagged_factors: [1] },
            ],
            statement_scores: [
                { statement_id: 7, code: 'S07', text: 'Local food sovereignty…',
                  z_scores: [2.41, 0.1, -0.3], factor_arrays: [4, 0, -2] },
            ],
            distinguishing: [{ statement_id: 7, significance: { '1': '*' } }],
            consensus: [],
        },
    },
    isLoading: false, isError: false,
    activeFactor: 1,
    flaggedParticipants: [{ db_id: 1, label: 'P1', loadings: [0.78, 0.0, 0.1], flagged_factors: [1] }],
    narrativeDraft: '',
    setNarrativeDraft: vi.fn(),
    appendToNarrative: vi.fn(),
    compareRun: null,
    deltaByStatement: null,
    ...overrides,
});

const wrap = (ui: React.ReactNode) => (
    <I18nextProvider i18n={i18n}>{ui}</I18nextProvider>
);

describe('FactorCanvas', () => {
    it('renders factor selector chips with the active factor highlighted', () => {
        render(wrap(<FactorCanvas slug="s" interpret={interpretStub()} onFocusChange={vi.fn()} />));
        const chips = screen.getAllByRole('tab');
        expect(chips).toHaveLength(3);
        expect(chips[0]).toHaveAttribute('aria-selected', 'true');
    });

    it('calls onFocusChange when a different chip is clicked', () => {
        const onFocusChange = vi.fn();
        render(wrap(<FactorCanvas slug="s" interpret={interpretStub()} onFocusChange={onFocusChange} />));
        fireEvent.click(screen.getAllByRole('tab')[1]);
        expect(onFocusChange).toHaveBeenCalledWith(2);
    });

    it('renders Statements panel filtered to top |z| of active factor', () => {
        render(wrap(<FactorCanvas slug="s" interpret={interpretStub()} onFocusChange={vi.fn()} />));
        expect(screen.getByText(/Local food sovereignty/i)).toBeInTheDocument();
    });

    it('renders Voices panel showing only flagged participants on active factor', () => {
        render(wrap(<FactorCanvas slug="s" interpret={interpretStub()} onFocusChange={vi.fn()} />));
        expect(screen.getByText(/P1/)).toBeInTheDocument();
    });

    it('clicking a comment insert button calls appendToNarrative with the formatted snippet', async () => {
        // Mount MSW handlers for /audios and /comments returning one comment fixture.
        server.use(
            http.get('/api/admin/studies/s/analysis/audios', () =>
                HttpResponse.json({ audios: [] })),
            http.get('/api/admin/studies/s/analysis/comments', () =>
                HttpResponse.json({ comments: [
                    { participant_db_id: 1, participant_label: 'P1',
                      statement_id: 7, statement_code: 'S07',
                      statement_text: 'Local food sovereignty…',
                      text: 'Because food sovereignty matters' },
                ]})),
        );
        const appendToNarrative = vi.fn();
        const interpret = interpretStub({ appendToNarrative });
        render(wrap(<FactorCanvas slug="s" interpret={interpret} onFocusChange={vi.fn()} />));
        const insertButton = await screen.findByLabelText(/insert comment as quote/i);
        fireEvent.click(insertButton);
        expect(appendToNarrative).toHaveBeenCalledWith(
            expect.stringContaining('Because food sovereignty matters'),
        );
        expect(appendToNarrative.mock.calls[0][0]).toMatch(/^> /);
    });

    it('does not render an insert button on audio rows', async () => {
        server.use(
            http.get('/api/admin/studies/s/analysis/audios', () =>
                HttpResponse.json({ audios: [
                    { participant_db_id: 1, participant_label: 'P1',
                      statement_id: 7, statement_code: 'S07',
                      duration_s: 42, url: '/fake/audio.webm' },
                ]})),
            http.get('/api/admin/studies/s/analysis/comments', () =>
                HttpResponse.json({ comments: [] })),
        );
        render(wrap(<FactorCanvas slug="s" interpret={interpretStub()} onFocusChange={vi.fn()} />));
        await screen.findByText(/S07/);
        expect(screen.queryByLabelText(/insert audio as quote/i)).toBeNull();
        // The only insert button label is "insert comment as quote" — never "audio".
        const inserts = screen.queryAllByLabelText(/insert.*as quote/i);
        for (const btn of inserts) {
            expect(btn).toHaveAccessibleName(/comment/i);
        }
    });

    it('renders the narrative editor', () => {
        render(wrap(<FactorCanvas slug="s" interpret={interpretStub()} onFocusChange={vi.fn()} />));
        expect(screen.getByText(/Narrative/i)).toBeInTheDocument();
    });
});
```

(The last three tests will need MSW fixtures for `/audios` and `/comments` endpoints; complete them while implementing.)

- [ ] **Step 2: Run tests to verify failure**

- [ ] **Step 3: Implement `FactorCanvas.tsx`**

Create `frontend/src/components/admin/analysis/FactorCanvas.tsx`:

```typescript
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { FactorSelectorChips } from './FactorSelectorChips';
import { FactorNoteEditor, type FactorNoteEditorHandle } from './FactorNoteEditor';
import { FactorVoicesPanel } from './FactorVoicesPanel';
import type { InterpretPhaseApi } from '@/hooks/admin/useInterpretPhase';

interface Props {
    slug: string;
    interpret: InterpretPhaseApi;
    onFocusChange: (factor: number) => void;
}

export function FactorCanvas({ slug, interpret, onFocusChange }: Props) {
    const { t } = useTranslation();
    const editorRef = useRef<FactorNoteEditorHandle>(null);
    const run = interpret.run;
    if (!run) return null;
    const result = run.result;

    const handleInsertQuote = (snippet: string) => {
        editorRef.current?.appendQuote(snippet);
        interpret.appendToNarrative(snippet);
    };

    // Top/bottom statements by |z| for active factor, distinguishing first.
    const topStatements = result.statement_scores
        .map((s) => ({
            ...s,
            z: s.z_scores[interpret.activeFactor - 1] ?? 0,
        }))
        .sort((a, b) => Math.abs(b.z) - Math.abs(a.z))
        .slice(0, 12);

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-4">
                <FactorSelectorChips
                    nFactors={result.n_factors}
                    activeFactor={interpret.activeFactor}
                    onSelect={onFocusChange}
                />
                <div className="text-sm text-slate-500">
                    {t('admin.analysis.interpret.def_sorts',
                       'Defining sorts: {{n}}',
                       { n: interpret.flaggedParticipants.length })}
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>
                        {t('admin.analysis.interpret.statements_title', 'Statements')}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <ul className="space-y-1 text-sm">
                        {topStatements.map((s) => (
                            <li key={s.statement_id} className="flex items-center gap-2 font-mono">
                                <span className={s.z >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                                    {s.z >= 0 ? '+' : ''}{s.z.toFixed(2)}
                                </span>
                                <span className="font-bold">{s.code}</span>
                                <span className="font-sans text-slate-700 truncate flex-1">
                                    "{s.text}"
                                </span>
                            </li>
                        ))}
                    </ul>
                </CardContent>
            </Card>

            <FactorVoicesPanel
                slug={slug}
                factorIndex={interpret.activeFactor - 1}
                participants={interpret.flaggedParticipants}
                onInsertCommentQuote={(comment, statement) => {
                    const snippet = formatQuote(t, comment, statement);
                    handleInsertQuote(snippet);
                }}
            />

            <Card>
                <CardHeader>
                    <CardTitle>
                        {t('admin.analysis.interpret.narrative_title',
                           'Narrative — F{{n}}', { n: interpret.activeFactor })}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <FactorNoteEditor
                        ref={editorRef}
                        slug={slug}
                        runId={run.id}
                        factorIndex={interpret.activeFactor - 1}
                        currentNote={run.factor_notes?.[String(interpret.activeFactor)] ?? ''}
                    />
                </CardContent>
            </Card>
        </div>
    );
}

function formatQuote(t: (key: string, fallback: string, opts?: object) => string,
                    comment: { text: string; participant_label: string },
                    statement: { code: string; text: string }): string {
    return t(
        'admin.analysis.quote_insert_format',
        '> {{text}}\n> — {{p}}, on statement {{code}}: "{{stmt}}…"',
        {
            text: comment.text,
            p: comment.participant_label,
            code: statement.code,
            stmt: statement.text.slice(0, 60),
        }
    );
}
```

> Note: `FactorVoicesPanel` currently does not have an `onInsertCommentQuote` prop. Step 4 below adds it.

- [ ] **Step 4: Extend `FactorVoicesPanel`**

Edit `frontend/src/components/admin/analysis/FactorVoicesPanel.tsx`:
- Add optional prop `onInsertCommentQuote?: (comment: ParticipantCardComment, statement: { code: string; text: string }) => void`.
- Where each comment is rendered, append a `▸+` button when the prop is defined:

```typescript
{onInsertCommentQuote && (
    <button
        type="button"
        onClick={() => onInsertCommentQuote(comment, statement)}
        aria-label={t('admin.analysis.interpret.insert_comment_quote', 'Insert comment as quote')}
        className="text-xs text-slate-500 hover:text-emerald-700"
    >
        ▸+
    </button>
)}
```

Audios already have no insertion button — leave them.

- [ ] **Step 5: Add new locale keys**

In `en/translation.json` under `admin.analysis.interpret.*`:

```json
"interpret": {
    "def_sorts": "Defining sorts: {{n}}",
    "statements_title": "Statements",
    "narrative_title": "Narrative — F{{n}}",
    "insert_comment_quote": "Insert comment as quote"
},
"quote_insert_format": "> {{text}}\n> — {{p}}, on statement {{code}}: \"{{stmt}}…\""
```

Mirror in `fr/`, `fi/`.

- [ ] **Step 6: Run tests**

```
npx vitest run src/components/admin/analysis/FactorCanvas.test.tsx src/components/admin/analysis/FactorVoicesPanel.test.tsx
```
Expected: all PASS.

- [ ] **Step 7: Commit**

```
git add frontend/src/components/admin/analysis/FactorCanvas.tsx frontend/src/components/admin/analysis/FactorCanvas.test.tsx frontend/src/components/admin/analysis/FactorVoicesPanel.tsx frontend/public/locales/
git commit -m "feat(analysis): add FactorCanvas with quote picker (comments only)"
```

---

### Task 24: Wire `FactorCanvas` into Interpret phase + Overview/Focus toggle

**Files:**
- Modify: `frontend/src/pages/admin/AnalysisPage.tsx`

- [ ] **Step 1: Add the toggle and mount FactorCanvas**

In the Interpret-phase branch of `AnalysisPage.tsx`:

```typescript
const [mode, setMode] = useState<'focus' | 'overview'>('focus');

const setFocusFromCanvas = useCallback((factor: number) => {
    setSearchParams((prev) => {
        const p = new URLSearchParams(prev);
        p.set('focus', `f${factor}`);
        return p;
    }, { replace: true });
}, [setSearchParams]);

return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6 pt-2">
        <StudyPageHeader /* ... */ />
        <div className="flex justify-end">
            <ToggleGroup
                value={mode}
                onValueChange={(v) => setMode(v as 'focus' | 'overview')}
                aria-label={t('admin.analysis.interpret.mode_toggle', 'Mode')}
            >
                <ToggleGroupItem value="focus">
                    {t('admin.analysis.interpret.focus_mode', 'Per-factor focus')}
                </ToggleGroupItem>
                <ToggleGroupItem value="overview">
                    {t('admin.analysis.interpret.overview_mode', 'Overview')}
                </ToggleGroupItem>
            </ToggleGroup>
        </div>
        {mode === 'focus' ? (
            <FactorCanvas slug={slug} interpret={interpret} onFocusChange={setFocusFromCanvas} />
        ) : (
            // existing four-tabs JSX, unchanged from Phase 2 refactor
            <></>
        )}
        <AnalysisHistoryPanel slug={slug} currentRunId={runId} />
    </div>
);
```

(Use shadcn-equivalent ToggleGroup or buttons — match codebase conventions.)

- [ ] **Step 2: Run tests**

```
npx vitest run src/pages/admin/AnalysisPage.test.tsx
```

- [ ] **Step 3: Manual smoke**

Run a fresh analysis. Verify the page lands on Focus mode by default, F1 chip is highlighted, switching chips changes the URL `focus=f2`, the Statements/Voices/Narrative panels update, clicking a comment's `▸+` appends a quote to the textarea, switching to Overview restores the legacy four tabs.

- [ ] **Step 4: Commit**

```
git add frontend/src/pages/admin/AnalysisPage.tsx
git commit -m "feat(analysis): mount FactorCanvas with Focus/Overview mode toggle"
```

---

### Task 25: PR 4 quality gate + PR creation

- [ ] **Step 1: `make ci`**

```
make ci
```

- [ ] **Step 2: PR**

```
git push
gh pr create --title "feat(analysis): Factor canvas — per-factor interpretive workspace (phase 4/5)" --body "$(cat <<'EOF'
## Summary

Adds the per-factor interpretive workspace on the Interpret phase:

- `<FactorCanvas>` brings Statements + Voices + Narrative into a single focused view per factor.
- `<FactorSelectorChips>` switches the active factor (URL: `?focus=f1`).
- Quote picker: each card comment of a flagged participant has `▸+` to insert as a markdown blockquote with attribution into the active factor narrative.
- **Focus / Overview mode toggle** preserves the legacy four tabs as Overview, so cross-factor views remain one click away.
- No insert button on audios (no transcription); no insert from statements (z already visible).

Spec: §5.1 – §5.4.

## Test plan
- [x] FactorCanvas renders chips, statements, voices, narrative
- [x] Quote insertion calls FactorNoteEditor.appendQuote
- [x] FactorVoicesPanel renders ▸+ only on comments, never on audio
- [x] Manual smoke: focus switch via URL, quote insertion, mode toggle

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

# Phase 5 — Compare pin

**PR boundary.** Final PR. After Phase 5: any run can be pinned as a comparison; FactorCanvas shows Δz and Δloading columns aligned via Tucker's φ.

**Goal:** Add `<CompareBar>` (pick a run + show φ-matching summary) and inline delta columns in Statements/Voices panels of `<FactorCanvas>`.

---

### Task 26: `CompareBar` component

**Files:**
- Create: `frontend/src/components/admin/analysis/CompareBar.tsx`
- Create: `frontend/src/components/admin/analysis/CompareBar.test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { CompareBar } from './CompareBar';

describe('CompareBar', () => {
    it('shows the pin button when no run is pinned', () => {
        render(<CompareBar
            runs={[{ id: 38, ran_at: '...', n_factors: 3 }]}
            currentRunId={42}
            compareTo={null}
            onPin={vi.fn()}
            onUnpin={vi.fn()}
            phi={null}
        />);
        expect(screen.getByRole('button', { name: /pin compare/i })).toBeInTheDocument();
    });

    it('shows the pinned run id and unpin button when compareTo is set', () => {
        render(<CompareBar
            runs={[{ id: 38, ran_at: '...', n_factors: 3 }]}
            currentRunId={42}
            compareTo={38}
            onPin={vi.fn()}
            onUnpin={vi.fn()}
            phi={0.92}
        />);
        expect(screen.getByText(/run #38/i)).toBeInTheDocument();
        expect(screen.getByText(/φ = 0\.92/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /unpin/i })).toBeInTheDocument();
    });

    it('warns when φ < 0.85', () => {
        render(<CompareBar
            runs={[]} currentRunId={42} compareTo={38}
            onPin={vi.fn()} onUnpin={vi.fn()} phi={0.78}
        />);
        expect(screen.getByText(/ambiguous match/i)).toBeInTheDocument();
    });
});
```

- [ ] **Step 2: Implement `CompareBar.tsx`**

```typescript
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pin, X, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import type { AnalysisRunSummary } from '@/api/model';

interface Props {
    runs: AnalysisRunSummary[];
    currentRunId: number;
    compareTo: number | null;
    onPin: (runId: number) => void;
    onUnpin: () => void;
    phi: number | null;
}

export function CompareBar({ runs, currentRunId, compareTo, onPin, onUnpin, phi }: Props) {
    const { t } = useTranslation();
    if (compareTo === null) {
        return (
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                        <Pin className="mr-1 h-3 w-3" />
                        {t('admin.analysis.compare.pin_cta', 'Pin compare')}
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                    {runs.filter((r) => r.id !== currentRunId).map((r) => (
                        <DropdownMenuItem key={r.id} onClick={() => onPin(r.id)}>
                            Run #{r.id} ({r.n_factors} factors)
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>
        );
    }
    const ambiguous = phi !== null && Math.abs(phi) < 0.85;
    return (
        <div className="flex items-center gap-2 text-sm">
            <span className="font-medium">
                {t('admin.analysis.compare.pinned', 'Comparing with run #{{id}}', { id: compareTo })}
            </span>
            {phi !== null && (
                <span className={ambiguous ? 'text-amber-700' : 'text-slate-600'}>
                    {t('admin.analysis.compare.phi', 'φ = {{phi}}', { phi: phi.toFixed(2) })}
                    {ambiguous && (
                        <>
                            <AlertTriangle className="inline ml-1 h-3 w-3" />
                            <span className="ml-1">
                                {t('admin.analysis.compare.ambiguous',
                                   'ambiguous match — interpret deltas with care')}
                            </span>
                        </>
                    )}
                </span>
            )}
            <Button variant="ghost" size="sm" onClick={onUnpin}>
                <X className="h-3 w-3" />
                <span className="sr-only">{t('admin.analysis.compare.unpin', 'Unpin')}</span>
            </Button>
        </div>
    );
}
```

Add locale keys: `admin.analysis.compare.pin_cta`, `pinned`, `phi`, `ambiguous`, `unpin`. Mirror in `fr/`, `fi/`.

- [ ] **Step 3: Run tests, commit**

```
npx vitest run src/components/admin/analysis/CompareBar.test.tsx
git add frontend/src/components/admin/analysis/CompareBar.tsx frontend/src/components/admin/analysis/CompareBar.test.tsx frontend/public/locales/
git commit -m "feat(analysis): add CompareBar for pinning a comparison run"
```

---

### Task 27: Hook `compareTo` into `useInterpretPhase` matching + delta

**Files:**
- Modify: `frontend/src/hooks/admin/useInterpretPhase.ts`
- Modify: `frontend/src/hooks/admin/useInterpretPhase.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `useInterpretPhase.test.ts`:

```typescript
it('computes Tucker φ between active factor and matched compare factor', async () => {
    server.use(
        http.get('/api/admin/studies/test-slug/analysis/runs/42', () =>
            HttpResponse.json(RUN_RESPONSE)),
        http.get('/api/admin/studies/test-slug/analysis/runs/38', () =>
            HttpResponse.json(/* near-identical run with one factor flipped */)),
    );
    const { result } = renderHook(
        () => useInterpretPhase('test-slug', 42, 'f1', 38),
        { wrapper: renderWithStore },
    );
    await waitFor(() => expect(result.current.compareRun).not.toBeNull());
    expect(result.current.activeMatchPhi).toBeGreaterThan(0.5);
});

it('exposes isAmbiguousMatch=true when |φ| < 0.85', async () => {
    // Run B has factor 1 only weakly aligned to run A's factor 1.
    const RUN_B = {
        ...RUN_RESPONSE, id: 38,
        result: {
            ...RUN_RESPONSE.result,
            participants: [
                { db_id: 1, label: 'P1', loadings: [0.30, 0.10, 0.05], flagged_factors: [1] },
                { db_id: 2, label: 'P2', loadings: [-0.10, 0.85, 0.05], flagged_factors: [2] },
            ],
            statement_scores: [
                { statement_id: 1, code: 'S1', text: 's1', z_scores: [0.4, 0.1, -0.2], factor_arrays: [1, 0, 0] },
                { statement_id: 2, code: 'S2', text: 's2', z_scores: [-0.3, 0.0, 0.6], factor_arrays: [-1, 0, 1] },
            ],
        },
    };
    server.use(
        http.get('/api/admin/studies/test-slug/analysis/runs/42', () =>
            HttpResponse.json(RUN_RESPONSE)),
        http.get('/api/admin/studies/test-slug/analysis/runs/38', () =>
            HttpResponse.json(RUN_B)),
    );
    const { result } = renderHook(
        () => useInterpretPhase('test-slug', 42, 'f1', 38),
        { wrapper: renderWithStore },
    );
    await waitFor(() => expect(result.current.compareRun).not.toBeNull());
    expect(result.current.isAmbiguousMatch).toBe(true);
});
```

- [ ] **Step 2: Extend the hook**

Edit `useInterpretPhase.ts`. Add to the API:

```typescript
activeMatchPhi: number | null;
activeMatchBIndex: number | null;  // matched factor index in compare run (0-based)
isAmbiguousMatch: boolean;
deltaByParticipant: Map<number, number> | null;  // participant_db_id → Δloading
```

In the body, after fetching both runs:

```typescript
import { matchFactorsByPhi } from '@/utils/tuckerPhi';

const factorMatches = useMemo(() => {
    const a = runQuery.data?.result;
    const b = compareQuery.data?.result;
    if (!a || !b) return null;
    // Build statement-by-factor matrix from z_scores.
    const aMatrix = a.statement_scores.map((s) => s.z_scores);
    const bMatrix = b.statement_scores.map((s) => s.z_scores);
    return matchFactorsByPhi(aMatrix, bMatrix);
}, [runQuery.data, compareQuery.data]);

const activeMatch = factorMatches?.find((m) => m.aIndex === activeFactor - 1) ?? null;
const activeMatchPhi = activeMatch?.phi ?? null;
const activeMatchBIndex = activeMatch?.bIndex ?? null;
const isAmbiguousMatch = activeMatchPhi !== null && Math.abs(activeMatchPhi) < 0.85;

// Replace the prior deltaByStatement implementation with one that uses
// activeMatchBIndex on the b side (sign-flip if phi is negative).
const deltaByStatement = useMemo(() => {
    const a = runQuery.data?.result;
    const b = compareQuery.data?.result;
    if (!a || !b || activeMatchBIndex === null) return null;
    const sign = (activeMatchPhi ?? 0) < 0 ? -1 : 1;
    const map = new Map<number, number>();
    for (const s of a.statement_scores) {
        const matching = b.statement_scores.find(
            (x) => x.statement_id === s.statement_id
        );
        if (!matching) continue;
        const za = s.z_scores[activeFactor - 1] ?? 0;
        const zb = (matching.z_scores[activeMatchBIndex] ?? 0) * sign;
        map.set(s.statement_id, za - zb);
    }
    return map;
}, [runQuery.data, compareQuery.data, activeFactor, activeMatchBIndex, activeMatchPhi]);

// Δloading per participant on the active factor.
const deltaByParticipant = useMemo(() => {
    const a = runQuery.data?.result;
    const b = compareQuery.data?.result;
    if (!a || !b || activeMatchBIndex === null) return null;
    const sign = (activeMatchPhi ?? 0) < 0 ? -1 : 1;
    const map = new Map<number, number>();
    for (const p of a.participants) {
        const matching = b.participants.find((x) => x.db_id === p.db_id);
        if (!matching) continue;
        const la = p.loadings[activeFactor - 1] ?? 0;
        const lb = (matching.loadings[activeMatchBIndex] ?? 0) * sign;
        map.set(p.db_id, la - lb);
    }
    return map;
}, [runQuery.data, compareQuery.data, activeFactor, activeMatchBIndex, activeMatchPhi]);
```

- [ ] **Step 3: Run tests**

```
npx vitest run src/hooks/admin/useInterpretPhase.test.ts
```

- [ ] **Step 4: Commit**

```
git add frontend/src/hooks/admin/useInterpretPhase.ts frontend/src/hooks/admin/useInterpretPhase.test.ts
git commit -m "feat(analysis): φ-aligned factor matching + Δz/Δloading in useInterpretPhase"
```

---

### Task 28: Render delta columns + CompareBar in `FactorCanvas`

**Files:**
- Modify: `frontend/src/components/admin/analysis/FactorCanvas.tsx`
- Modify: `frontend/src/components/admin/analysis/FactorCanvas.test.tsx`

- [ ] **Step 1: Add a CompareBar mount + Δz display**

Edit `FactorCanvas.tsx`. Accept new props:

```typescript
interface Props {
    slug: string;
    interpret: InterpretPhaseApi;
    onFocusChange: (factor: number) => void;
    runs: AnalysisRunSummary[];
    compareTo: number | null;
    onPin: (runId: number) => void;
    onUnpin: () => void;
}
```

Inside the JSX header row, mount `<CompareBar>`. Inside the Statements list:

```typescript
{topStatements.map((s) => (
    <li key={s.statement_id} className="flex items-center gap-2 font-mono">
        <span className={s.z >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
            {s.z >= 0 ? '+' : ''}{s.z.toFixed(2)}
        </span>
        {interpret.deltaByStatement && (
            <span className="text-xs text-slate-500">
                Δ {(interpret.deltaByStatement.get(s.statement_id) ?? 0).toFixed(2)}
            </span>
        )}
        <span className="font-bold">{s.code}</span>
        {/* … */}
    </li>
))}
```

Same approach in the Voices panel (highlight |Δloading| ≥ 0.2).

- [ ] **Step 2: Wire from `AnalysisPage.tsx`**

In the Interpret-phase branch:

```typescript
const handlePin = useCallback((id: number) => {
    setSearchParams((prev) => {
        const p = new URLSearchParams(prev);
        p.set('compareTo', String(id));
        return p;
    }, { replace: true });
}, [setSearchParams]);

const handleUnpin = useCallback(() => {
    setSearchParams((prev) => {
        const p = new URLSearchParams(prev);
        p.delete('compareTo');
        return p;
    }, { replace: true });
}, [setSearchParams]);

// Fetch the run history for the picker.
const { data: runs = [] } = useListAnalysisRunsApiAdminStudiesSlugAnalysisRunsGet(slug);

// ...
<FactorCanvas
    slug={slug} interpret={interpret} onFocusChange={setFocusFromCanvas}
    runs={runs} compareTo={compareTo} onPin={handlePin} onUnpin={handleUnpin}
/>
```

- [ ] **Step 3: Run tests + manual smoke**

```
npx vitest run src/components/admin/analysis/
make ci-fast
```

Manual: pin a prior run, verify Δz appears next to z-scores in Statements; verify warning appears when matching φ < 0.85; unpin removes deltas.

- [ ] **Step 4: Commit**

```
git add frontend/src/components/admin/analysis/FactorCanvas.tsx frontend/src/pages/admin/AnalysisPage.tsx
git commit -m "feat(analysis): render Δz/Δloading + CompareBar in FactorCanvas"
```

---

### Task 29: PR 5 quality gate + PR creation

- [ ] **Step 1: `make ci`**

```
make ci
```

- [ ] **Step 2: PR**

```
git push
gh pr create --title "feat(analysis): compare pin — Tucker φ alignment + delta columns (phase 5/5)" --body "$(cat <<'EOF'
## Summary

Closes the brainstorm: any run can now be pinned as a comparison alongside the current run, with deltas surfaced in the Factor Canvas.

- `<CompareBar>` picks a run from history (URL-scoped `?compareTo=`).
- Factor matching via Tucker's φ (max |φ| greedy assignment, sign-aware).
- Statements panel renders Δz; Voices panel renders Δloading.
- Warning when |φ| < 0.85 ("ambiguous match — interpret deltas with care").
- Different `n_factors` between the two runs is supported (unmatched columns in the compare run are simply ignored).
- Comparison run's audios and comments are not rendered (out of scope for v1).

Spec: §5.5.

## Test plan
- [x] `tuckerPhi` + `matchFactorsByPhi` unit tests
- [x] `useInterpretPhase` Δz/Δloading + ambiguous-match tests
- [x] `CompareBar` rendering + φ display
- [x] Manual smoke: pin/unpin, sign-flip alignment

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

# Closing checklist

After PR 5 merges, the spec is fully realised. Run a final sanity pass:

- [ ] `make ci` green on `main`.
- [ ] Manual walk-through: study with ≥3 participants → land on Explore phase → click a column in Preview-range → Commit and interpret → Focus mode shows Statements+Voices+Narrative for F1 → click `▸+` on a comment → quote inserted in narrative → Save → switch to F2 → switch to Overview → switch back to Focus → Pin a prior run → see Δz column.
- [ ] Verify `useAnalysisPage` is no longer present in the codebase (`grep -rn useAnalysisPage frontend/src/` returns empty).
- [ ] All five PRs merged in order; each PR's commit message references the spec section it implements.
