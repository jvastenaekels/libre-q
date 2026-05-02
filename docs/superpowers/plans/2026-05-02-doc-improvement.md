# Documentation Improvement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve Qualis documentation across three axes — internal hygiene, doc-vs-code drift on features shipped in the last ~3 months, and README repositioning to address both classical and critical Q-methodology audiences.

**Architecture:** Three waves shipped as five sequential squash-merged PRs (Vague 1 → V2 B1 → V2 B2 → V2 B3 → Vague 3). Each PR is self-contained and revert-safe. Vague 1 reorganizes the docs tree before Vague 2 writes new content into it; Vague 3 finalizes positioning once new features are documented.

**Tech Stack:** Markdown, GitHub flavor. Verification via `lychee` (already configured in `lychee.toml`), `grep`, `find`, `make ci`. No site generator.

**Spec:** See `docs/superpowers/specs/2026-05-02-doc-improvement-design.md` for the full design rationale.

---

## File map

**Vague 1 — files moved or removed:**
- Move: `docs/guides/contributing/{development,testing,style-guide}.md` → `docs/contributing/`
- Remove: `docs/plans/branching-questions.md`
- Remove: `docs/implementation_plans/{backend_robustness,optimistic_locking_plan,study_visualization_overhaul}.md`
- Remove: `TODO.md` (root)
- Modify: `docs/README.md` (drop duplicate row, update contributing links)
- Modify: `README.md` (root, update contributing links if any point to old path)

**Vague 2 B1 — modified:**
- `docs/reference/configuration.md`
- `docs/reference/admin-dashboard.md`
- `docs/reference/study-configuration-format.md`
- `docs/reference/api.md`
- `docs/tutorials/collecting-responses.md`

**Vague 2 B2 — modified, created, removed:**
- `docs/tutorials/your-first-study.md` (refonte)
- `docs/guides/conducting-studies.md`
- `docs/guides/data-export.md`
- `docs/contributing/development.md` (absorbs tutorial 5 content)
- Remove: `docs/tutorials/local-development.md`
- Modify (link updates): `docs/README.md`, `README.md`, `docs/tutorials/README.md`, `docs/tutorials/analyzing-results.md`

**Vague 2 B3 — renamed and created:**
- Rename: `docs/tutorials/analyzing-results.md` → `docs/tutorials/analyzing-results-foundations.md`
- Create: `docs/tutorials/analyzing-results-refinement.md`
- Modify: `docs/README.md`, `docs/tutorials/README.md`, `docs/explanation/q-methodology.md` (light)

**Vague 3 — modified:**
- `README.md` (Statement of need + comparison table row)

---

## Branch & PR convention

Each Vague gets a dedicated branch off `main`. PR title follows `docs: <vague> — <résumé>`. Squash-merge; delete branch after merge. The next Vague branches off `main` (now containing the previous merged PR).

---

# PR 1 — Vague 1: Hygiène

**Branch:** `docs/hygiene`

### Task 1.1: Create branch from main

- [ ] **Step 1: Verify clean state and pull main**

```bash
git status
git checkout main
git pull --ff-only
```
Expected: clean working tree, up to date with origin/main.

- [ ] **Step 2: Create branch**

```bash
git checkout -b docs/hygiene
```

### Task 1.2: Fix duplicate row in `docs/README.md`

**Files:**
- Modify: `docs/README.md` line 60

- [ ] **Step 1: Inspect the duplicate**

```bash
grep -n "Study Configuration Format" docs/README.md
```
Expected: two adjacent lines (59 and 60) referencing the same target.

- [ ] **Step 2: Remove line 60 (the second occurrence)**

Use the Edit tool. Old:
```
| [Study Configuration Format](reference/study-configuration-format.md) | JSON import/export wrapper |
| [Study Configuration Format](reference/study-configuration-format.md) | JSON import/export format specification |
```
New:
```
| [Study Configuration Format](reference/study-configuration-format.md) | JSON import/export format specification |
```

(Keep the line with the more accurate description.)

- [ ] **Step 3: Verify**

```bash
grep -c "Study Configuration Format" docs/README.md
```
Expected: `1`.

### Task 1.3: Consolidate `contributing/` folders

**Files:**
- Move: `docs/guides/contributing/development.md` → `docs/contributing/development.md`
- Move: `docs/guides/contributing/testing.md` → `docs/contributing/testing.md`
- Move: `docs/guides/contributing/style-guide.md` → `docs/contributing/style-guide.md`
- Remove: empty directory `docs/guides/contributing/`

- [ ] **Step 1: Move the three files via git**

```bash
git mv docs/guides/contributing/development.md docs/contributing/development.md
git mv docs/guides/contributing/testing.md docs/contributing/testing.md
git mv docs/guides/contributing/style-guide.md docs/contributing/style-guide.md
```

- [ ] **Step 2: Remove empty parent directory**

```bash
rmdir docs/guides/contributing
```

- [ ] **Step 3: Find and update all inbound links**

```bash
grep -rln "guides/contributing/" docs README.md
```
Expected output: list of files that reference the old path (likely `docs/README.md`, `README.md`, possibly cross-refs inside the moved files themselves).

- [ ] **Step 4: For each file in the grep output, replace `guides/contributing/` with `contributing/` adjusting relative depth**

Use Edit with `replace_all` per file. The relative path from `docs/README.md` is now `contributing/development.md` (was `guides/contributing/development.md`). From the root `README.md` it is `docs/contributing/development.md` (was `docs/guides/contributing/development.md`).

For each file that contains `guides/contributing/`:
- `docs/README.md`: replace `guides/contributing/` → `contributing/`
- `README.md`: replace `docs/guides/contributing/` → `docs/contributing/`
- Inside any moved file (e.g. `docs/contributing/development.md` referencing siblings): replace `guides/contributing/` → `contributing/` if such links exist (they likely don't, since the files were already siblings).

- [ ] **Step 5: Verify no stale paths remain**

```bash
grep -rn "guides/contributing" docs README.md CONTRIBUTING.md 2>/dev/null
```
Expected: zero output.

### Task 1.4: Drop legacy planning docs

**Files:**
- Remove: `docs/plans/branching-questions.md`
- Remove: `docs/implementation_plans/backend_robustness.md`
- Remove: `docs/implementation_plans/optimistic_locking_plan.md`
- Remove: `docs/implementation_plans/study_visualization_overhaul.md`

- [ ] **Step 1: Check for inbound links before deletion**

```bash
grep -rln "docs/plans\|docs/implementation_plans\|implementation_plans/\|plans/branching" docs README.md 2>/dev/null
```
Expected: ideally zero. If any references found, decide per-link: a reference inside another planning doc is fine (going away with it); a reference from a guide/tutorial/reference doc must be unlinked first.

- [ ] **Step 2: Remove the four files**

```bash
git rm docs/plans/branching-questions.md
git rm docs/implementation_plans/backend_robustness.md
git rm docs/implementation_plans/optimistic_locking_plan.md
git rm docs/implementation_plans/study_visualization_overhaul.md
```

- [ ] **Step 3: Remove now-empty parent directories**

```bash
rmdir docs/plans docs/implementation_plans 2>/dev/null
```
(rmdir is silent on non-empty dirs; if either still has content, investigate and remove.)

- [ ] **Step 4: Verify**

```bash
ls docs/plans docs/implementation_plans 2>&1 | head
```
Expected: "No such file or directory" for both.

### Task 1.5: Drop root `TODO.md`

**Files:**
- Remove: `TODO.md`

- [ ] **Step 1: Check for inbound links**

```bash
grep -rln "TODO\.md" docs README.md CONTRIBUTING.md 2>/dev/null
```

- [ ] **Step 2: Remove**

```bash
git rm TODO.md
```

- [ ] **Step 3: Verify**

```bash
ls TODO.md 2>&1
```
Expected: "No such file or directory".

### Task 1.6: Audit `docs/explanation/design-decisions/mobile-ux.md`

**Files:**
- Inspect only: `docs/explanation/design-decisions/mobile-ux.md`

- [ ] **Step 1: Read and skim**

Read the full file. Look for:
- references to UI elements that may have been renamed (e.g. obsolete tab names, removed columns).
- mention of `is_test_run` (should be 0).
- mention of features later refactored (HUD, Workbench).

- [ ] **Step 2: Decide stale vs fine**

If clearly stale, add a one-line note in the PR description: *"`mobile-ux.md` requires a refresh — opening a follow-up PR."* Do not rewrite in this Vague.

If accurate, no action.

### Task 1.7: Run lychee link check

- [ ] **Step 1: Run lychee**

```bash
lychee --config lychee.toml docs/ README.md
```
Expected: no new errors compared to main. If lychee is not installed, `npx lychee-link-checker docs/ README.md` or skip with a manual `grep`-based check.

- [ ] **Step 2: If new errors surface, fix them**

Most common cause: a moved file's relative depth changed and a `../` in one of its links is now wrong by one level. Fix per-file.

### Task 1.8: Final verification

- [ ] **Step 1: Structural assertions**

```bash
find docs -type d -name contributing | wc -l
```
Expected: `1`.

```bash
ls docs/plans docs/implementation_plans TODO.md 2>&1 | grep -c "No such"
```
Expected: `3`.

```bash
grep -c "Study Configuration Format" docs/README.md
```
Expected: `1`.

- [ ] **Step 2: Run `make ci` to ensure nothing else broke**

```bash
make ci
```
Expected: pass.

### Task 1.9: Commit and open PR

- [ ] **Step 1: Review staged diff**

```bash
git status
git diff --cached --stat
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
docs: hygiene — consolidate contributing folder, drop legacy plans

Three structural cleanups in one PR:
- Drop duplicate Study Configuration Format row in docs/README.md.
- Consolidate docs/guides/contributing/ into docs/contributing/.
- Remove legacy planning docs (docs/plans/, docs/implementation_plans/)
  and stale root TODO.md. Git history preserves them.

Cross-reference: docs/superpowers/specs/2026-05-02-doc-improvement-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 3: Push and open PR**

```bash
git push -u origin docs/hygiene
gh pr create --title "docs: hygiene — consolidate contributing folder, drop legacy plans" --body "$(cat <<'EOF'
## Summary
- Drop duplicate Study Configuration Format row in `docs/README.md`.
- Consolidate `docs/guides/contributing/` into `docs/contributing/` (single source of truth for contributor docs).
- Remove `docs/plans/`, `docs/implementation_plans/`, and root `TODO.md` (git history preserves them).

Spec: [`docs/superpowers/specs/2026-05-02-doc-improvement-design.md`](../blob/main/docs/superpowers/specs/2026-05-02-doc-improvement-design.md)

This is wave 1 of 5 in the doc-improvement plan. No new content added.

## Test plan
- [x] `lychee` passes on `docs/` + `README.md`.
- [x] `find docs -type d -name contributing` returns 1.
- [x] `make ci` passes.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 4: Wait for squash-merge by user**

Pause. Once the user squash-merges this PR, branch back to `main`, pull, and start PR 2.

---

# PR 2 — Vague 2 B1: Reference drift + collecting-responses patches

**Branch:** `docs/drift-b1-reference`

**Pre-flight:**
```bash
git checkout main
git pull --ff-only
git checkout -b docs/drift-b1-reference
```

### Task 2.1: Read source-of-truth files for the new sections

Before writing doc, read the code that defines what we're documenting. This grounds the doc in current behavior.

- [ ] **Step 1: Read distribution mode source**

```bash
grep -rn "distribution_mode\|free_distribution\|overflow" backend/app/models backend/app/schemas backend/app/services 2>/dev/null | head -30
```
Capture: the field name (`distribution_mode` or similar), allowed values, default, where overflow rows are computed.

- [ ] **Step 2: Read rough-sort toggle source**

```bash
grep -rn "rough_sort_enabled" backend/app/models backend/app/schemas backend/app/services backend/app/routers 2>/dev/null | head -20
```
Capture: field name, default, semantics.

- [ ] **Step 3: Read memo source**

```bash
ls backend/app/models/ | grep -i memo
ls backend/app/services/ | grep -i memo
ls backend/app/routers/admin | grep -i memo
ls frontend/src/components | grep -i [Mm]emo
```
Capture: feature shape (collaborative? per-study? per-factor? @-mention semantics).

- [ ] **Step 4: Read Compare / Explorer / Factor canvas source**

```bash
grep -rln "Tucker\|tucker\|compare" backend/app/services/analysis_service.py 2>/dev/null
grep -rln "preview_range\|previewRange" backend/app frontend/src 2>/dev/null | head
ls frontend/src/components/admin/analysis 2>/dev/null
```
Capture: endpoint names, key UI components.

- [ ] **Step 5: Read members page source**

```bash
ls frontend/src/pages/admin | grep -i member
grep -rln "MembersPage\|/members" frontend/src/router 2>/dev/null | head
```
Capture: the route, what the page shows.

### Task 2.2: Update `docs/reference/configuration.md` — add `distribution_mode`

**Files:**
- Modify: `docs/reference/configuration.md` (after line 80, in the field list)

- [ ] **Step 1: Identify insertion point**

Look at the existing field table around line 80. Find where `ask_general_comment` is listed (the existing closing field). Insert new rows before or after the related grid configuration fields.

- [ ] **Step 2: Insert `distribution_mode` row**

Use Edit. Add (adapt field name to what the source actually uses, found in Task 2.1):

```markdown
| `distribution_mode` | string | `"forced"` (default) or `"free"`. Forced enforces the per-column slot counts as a near-normal pyramid; free allows participants to place statements without strict slot limits, with overflow rows surfaced for any column whose placements exceed configured capacity. |
| `rough_sort_enabled` | boolean | If true, participants go through a 3-pile rough-sort triage (agree / neutral / disagree) before the fine-sort grid. Default: `false`. Only ~38% of published Q studies use rough-sorting (Dieteren et al. 2023). |
```

(If the actual field name from Task 2.1 differs, use it.)

- [ ] **Step 3: Verify**

```bash
grep -n "distribution_mode\|rough_sort_enabled" docs/reference/configuration.md
```
Expected: two matches.

- [ ] **Step 4: Commit**

```bash
git add docs/reference/configuration.md
git commit -m "docs(reference): document distribution_mode and rough_sort_enabled"
```

### Task 2.3: Update `docs/reference/admin-dashboard.md` — Memos section

**Files:**
- Modify: `docs/reference/admin-dashboard.md` (insert before `## Profile`)

- [ ] **Step 1: Locate insertion point**

The current TOC ends with `## Profile` at line 184. The Memos section sits naturally between `## Analysis` (line 154) and `## Profile`. Confirm by reading those sections.

- [ ] **Step 2: Insert `## Memos` section**

Use Edit to add a new top-level section. Suggested skeleton (adapt field names + UI labels to the actual implementation found in Task 2.1):

```markdown
## Memos

A per-study collaborative notes surface. Memos are short markdown notes that team members write during study design and analysis. Available from any admin page via the **Memos** toolbar button (opens as a slide-over Sheet on the right).

### Placement

- Toolbar button visible across all admin study pages.
- Indicator badge shows unread mentions for the current user.

### Composition

- Markdown body.
- @-mentions of project members notify the mentioned user (badge increments on their next page load).
- Memo categories: *methodology*, *analysis*, *general*. Methodology memos are surfaced as a dedicated entry on the Study Designer toolbar.

### Export

Memos are included in the Research Package export. See [Data Export](../guides/data-export.md).
```

- [ ] **Step 3: Verify**

```bash
grep -n "^## Memos" docs/reference/admin-dashboard.md
```
Expected: one match.

- [ ] **Step 4: Commit**

```bash
git add docs/reference/admin-dashboard.md
git commit -m "docs(admin-dashboard): document Memos surface"
```

### Task 2.4: Update `docs/reference/admin-dashboard.md` — Members section

**Files:**
- Modify: `docs/reference/admin-dashboard.md`

- [ ] **Step 1: Insert `## Members` section after `## Profile` (or under a new `## Project` parent if the page is project-scoped)**

Read the actual page source briefly (`frontend/src/pages/admin/MembersPage.tsx` or similar) to capture:
- Where the page sits in the IA (project-scoped or study-scoped).
- What columns the table shows (name, email, role, last activity?).
- What actions are available (invite, change role, remove).

Insert markdown reflecting the actual page. Suggested skeleton:

```markdown
## Members

The dedicated `/admin/projects/<slug>/members` page lists project members with their role (Owner / Researcher / Viewer), invitation status, and last activity. Project Owners can invite new members, change roles, and remove members. The page replaces the previous embedded Members list inside Project Settings.

### Inviting members

Click **Invite Member**. Provide an email address and a role. If SMTP is configured, an invitation email is sent. If not, a shareable invitation link is shown in a dialog.

### Roles

- **Owner**: full access, including member management and study deletion.
- **Researcher**: edit studies, run analyses, manage recruitment.
- **Viewer**: read-only access to studies and data.
```

- [ ] **Step 2: Commit**

```bash
git add docs/reference/admin-dashboard.md
git commit -m "docs(admin-dashboard): document Members page"
```

### Task 2.5: Update `docs/reference/admin-dashboard.md` — Compare / Explorer / Factor canvas

**Files:**
- Modify: `docs/reference/admin-dashboard.md` (under existing `## Analysis` section)

- [ ] **Step 1: Locate the Analysis section**

Currently has subsections: `### Scree plot`, `### Configuration`, `### Results tabs`. We add three subsections.

- [ ] **Step 2: Insert `### Explorer panel` subsection (under Analysis, after Configuration)**

```markdown
### Explorer panel

A diagnostic panel surfaced at the top of the Analysis page when an analysis run is loaded. Shows:

- **Eigenvalue table** for factor counts in a configurable preview range (e.g., 1–10), letting you scan how variance breaks down without re-running.
- **Cumulative variance** per factor count.
- **Recommended factor count** based on the Kaiser criterion, with a manual override.

Use the Explorer to decide how many factors to extract before committing to a full run.
```

- [ ] **Step 3: Insert `### Compare` subsection**

```markdown
### Compare

When two analysis runs exist, the Compare panel aligns them via Tucker φ congruence:

- **φ matrix**: pairwise congruence between factors of the two runs.
- **Aligned arrays**: factors of the second run reordered + sign-flipped to maximize congruence.
- **Delta columns**: per-statement difference between aligned arrays.

Use Compare to verify that minor changes (different N, different rotation, different flagging) produce equivalent factor structures.
```

- [ ] **Step 4: Insert `### Factor canvas` subsection**

```markdown
### Factor canvas

A focus-mode view for one factor at a time. Shows the factor array on the left and a quote picker on the right that pulls participant statements (post-sort comments, audio transcripts) for the highest-loading participants. Use this to build the narrative for each factor by anchoring claims in specific participant voices.
```

- [ ] **Step 5: Verify**

```bash
grep -nE "^### (Explorer panel|Compare|Factor canvas)$" docs/reference/admin-dashboard.md
```
Expected: 3 matches.

- [ ] **Step 6: Commit**

```bash
git add docs/reference/admin-dashboard.md
git commit -m "docs(admin-dashboard): document Explorer, Compare, Factor canvas"
```

### Task 2.6: Update `docs/reference/study-configuration-format.md`

**Files:**
- Modify: `docs/reference/study-configuration-format.md`

- [ ] **Step 1: Read current state**

```bash
grep -n "^##\|distribution\|rough" docs/reference/study-configuration-format.md
```

- [ ] **Step 2: Add `distribution_mode` and `rough_sort_enabled` to the JSON wrapper schema**

Locate the JSON schema/example that documents the import/export shape. Add the two new fields to both the schema description and any example JSON if present. Cross-reference the configuration.md entry.

- [ ] **Step 3: Commit**

```bash
git add docs/reference/study-configuration-format.md
git commit -m "docs(study-config-format): include distribution_mode and rough_sort_enabled"
```

### Task 2.7: Audit `docs/reference/api.md` against `openapi.json`

**Files:**
- Modify: `docs/reference/api.md`

- [ ] **Step 1: Extract list of endpoint paths from openapi.json**

```bash
python -c "import json; spec = json.load(open('openapi.json')); print('\n'.join(sorted(spec['paths'].keys())))" > /tmp/openapi-paths.txt
wc -l /tmp/openapi-paths.txt
```

- [ ] **Step 2: Extract list of endpoint paths documented in api.md**

```bash
grep -oE '`(GET|POST|PUT|DELETE|PATCH) /[^`]+`' docs/reference/api.md | sort -u > /tmp/doc-paths.txt
wc -l /tmp/doc-paths.txt
```

- [ ] **Step 3: Diff**

Compare the two lists manually (the format is different — openapi has paths only, api.md has METHOD + path). Identify missing endpoints. Expect at least: memo CRUD (`/api/admin/projects/{id}/memos`, etc.), Compare endpoints (`/api/admin/studies/{id}/analysis/compare` or similar), Members invitations.

- [ ] **Step 4: Add missing endpoints to `api.md`**

Group new entries under the existing section structure (Auth, Studies, Analysis, etc.). For each: method, path, brief description, auth requirement, rate-limit class if relevant.

- [ ] **Step 5: Verify**

```bash
make check-api
```
Expected: pass (this is the script that verifies the generated frontend client is in sync; not strictly the doc, but worth confirming we didn't break anything).

- [ ] **Step 6: Commit**

```bash
git add docs/reference/api.md
git commit -m "docs(api): document memos, compare, members endpoints"
```

### Task 2.8: Update `docs/tutorials/collecting-responses.md` — drop `is_test_run`

**Files:**
- Modify: `docs/tutorials/collecting-responses.md` (Step 8)

- [ ] **Step 1: Locate the line**

```bash
grep -n "test run\|is_test_run\|test_run" docs/tutorials/collecting-responses.md
```

- [ ] **Step 2: Edit Step 8 list of Participant Table columns**

Old line (around line 104):
```
- **Participant Table**: Searchable, sortable table with status, duration, device type, test run flag, and discard status
```

New:
```
- **Participant Table**: Searchable, sortable table with status, duration, device type, and discard status
```

- [ ] **Step 3: Verify**

```bash
grep -i "test.run" docs/tutorials/collecting-responses.md
```
Expected: zero matches.

### Task 2.9: Update `docs/tutorials/collecting-responses.md` — `/members` page + funnel

**Files:**
- Modify: `docs/tutorials/collecting-responses.md`

- [ ] **Step 1: Add a brief mention of the funnel**

In Step 7 (Monitor Responses from the Study Overview), expand the line about *participant statistics* into:

```markdown
The page shows: study status, recruitment funnel (sent → started → submitted), completion rate, and recent submissions.
```

- [ ] **Step 2: Add a pointer to the Members page**

After Step 5 or Step 10 (wherever a *« share with team members »* discussion fits), add:

```markdown
> **Sharing access with team members.** To give a colleague access to monitor responses, invite them via the project Members page (`/admin/projects/<slug>/members`). See [Admin Dashboard — Members](../reference/admin-dashboard.md#members).
```

- [ ] **Step 3: Verify**

```bash
grep -n "Members\|funnel" docs/tutorials/collecting-responses.md
```
Expected: at least 2 matches.

- [ ] **Step 4: Commit**

```bash
git add docs/tutorials/collecting-responses.md
git commit -m "docs(tutorial): drop is_test_run, add /members link and funnel detail"
```

### Task 2.10: Final verification for B1

- [ ] **Step 1: Stale-reference scan**

```bash
grep -rn "is_test_run\|test run flag" docs/ 2>/dev/null
```
Expected: zero.

- [ ] **Step 2: Run lychee**

```bash
lychee --config lychee.toml docs/ README.md
```

- [ ] **Step 3: `make ci`**

```bash
make ci
```

### Task 2.11: Open PR

- [ ] **Step 1: Push and open PR**

```bash
git push -u origin docs/drift-b1-reference
gh pr create --title "docs: drift B1 — reference docs + collecting-responses patches" --body "$(cat <<'EOF'
## Summary
Closes the doc-vs-code drift on the **reference layer** plus mechanical patches in the collecting-responses tutorial.

- `configuration.md`: documents `distribution_mode` and `rough_sort_enabled`.
- `admin-dashboard.md`: new **Memos**, **Members**, **Compare**, **Explorer panel**, **Factor canvas** sections.
- `study-configuration-format.md`: schema updated for the two new fields.
- `api.md`: memo + compare + members endpoints documented.
- `collecting-responses.md`: drop the dead `is_test_run` mention, add `/members` reference, expand the funnel description.

Spec: [`docs/superpowers/specs/2026-05-02-doc-improvement-design.md`](../blob/main/docs/superpowers/specs/2026-05-02-doc-improvement-design.md)

Wave 2 of 5. No prose refonte yet.

## Test plan
- [x] `grep -r "is_test_run" docs/` returns 0.
- [x] `admin-dashboard.md` table of contents includes Memos, Members, Compare, Explorer, Factor canvas.
- [x] `make ci` passes.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 2: Wait for squash-merge.**

---

# PR 3 — Vague 2 B2: Tutorial 1 refonte + researcher guides + tutorial 5 merge

**Branch:** `docs/drift-b2-tutorial-1-and-merge`

**Pre-flight:**
```bash
git checkout main
git pull --ff-only
git checkout -b docs/drift-b2-tutorial-1-and-merge
```

### Task 3.1: Refonte tab list in `your-first-study.md`

**Files:**
- Modify: `docs/tutorials/your-first-study.md` (around line 48)

- [ ] **Step 1: Read current Study Designer source to confirm tab list**

```bash
grep -rln "Consignes\|consignes" frontend/src/pages/admin frontend/public/locales/en | head
```

Confirm whether the current designer has 6, 7, or another number of tabs and what they are exactly.

- [ ] **Step 2: Update lines 48-57**

Old:
```
The designer has seven tabs:

- **General** -- Title, description, consent form
- **Presort** -- Pre-sorting questionnaire
- **Instruction** -- Condition of instruction for the Q-sort
- **Grid & Q-Set** -- Statements and forced-distribution grid
- **Post-sort** -- Post-sorting questionnaire
- **Branding** -- Logo, colors, partner logos
- **Interface** -- UI label customization and behavioral options
```

New (adapt to what Step 1 confirmed):
```
The designer has the following tabs:

- **General** -- Title, description, consent form
- **Consignes** -- Pre-sort questionnaire, Condition of Instruction, rough-sort toggle, post-sort questionnaire
- **Grid & Q-Set** -- Statements and the distribution grid (forced or free)
- **Branding** -- Logo, colors, partner logos
- **Interface** -- UI label customization and behavioral options
```

(Adjust labels to match the actual UI; the precise wording matters more than my draft.)

- [ ] **Step 3: Commit**

```bash
git add docs/tutorials/your-first-study.md
git commit -m "docs(tutorial-1): refresh tab list to match current designer"
```

### Task 3.2: Add reflexive sidebar — distribution choice

**Files:**
- Modify: `docs/tutorials/your-first-study.md` (Step 6b around line 153)

- [ ] **Step 1: Insert sidebar before the existing slot table**

After the "### 6b: Configure the Forced-Distribution Grid" heading, insert:

```markdown
> **Forced vs free distribution — the methodological choice.**
>
> A *forced* distribution requires participants to fit their sort into the per-column slot counts shown below. It compels trade-offs ("you can only have one statement at +3"), which is what makes Q-sorts comparable across participants in classical Brown-school analysis.
>
> A *free* distribution lets participants place statements without strict slot limits; columns can overflow. This is favoured by some critical-Q practitioners who argue forced distributions impose an artificial structure on subjectivity (Watts & Stenner 2012, ch. 4). Qualis surfaces overflow rows so the sort remains analyzable.
>
> For this tutorial we use forced distribution — it is the most common starting point and produces the cleanest pedagogical example. You can switch to free distribution at any time on the Grid tab if your methodology calls for it.
```

- [ ] **Step 2: Verify**

```bash
grep -n "Forced vs free" docs/tutorials/your-first-study.md
```

### Task 3.3: Add reflexive sidebar — rough-sort toggle

**Files:**
- Modify: `docs/tutorials/your-first-study.md` (Step 9 around line 195)

- [ ] **Step 1: Reframe Step 9**

Step 9 currently treats the rough-sort as a default. Update:

```markdown
## Step 9: Preview Your Study

1. In the designer toolbar, click the **Preview** button. This opens the study in a new tab in pilot mode.
2. Walk through the participant flow.

> **Rough-sort: should you enable it?**
>
> The rough-sort is a 3-pile triage (agree / neutral / disagree) that precedes the fine-sort grid. Only ~38% of published Q studies use it (Dieteren et al. 2023). It lowers cognitive load before the participant has to commit to specific positions, which can help on long Q-sets (40+ statements) or with younger / less experienced participants. On a short, well-instructed sort it adds friction without much benefit.
>
> The toggle lives in the **Consignes** tab → *Rough-sort enabled*. Default: off. If enabled, participants see a triage screen between the Condition of Instruction and the fine-sort grid.

3. At the end you get a local `PILOT-XXXXX` confirmation code. Nothing is persisted to the database.
```

### Task 3.4: Add reflexive sidebar — Condition of Instruction

**Files:**
- Modify: `docs/tutorials/your-first-study.md` (Step 5 around line 116)

- [ ] **Step 1: Insert sidebar at the end of Step 5**

After the example CoI prose, add:

```markdown
> **Writing a non-leading Condition of Instruction.**
>
> The CoI is the most consequential single sentence in your study. A small phrasing change shifts the entire viewpoint participants surface. Some heuristics:
>
> - **Anchor the sort in lived experience or position**, not in evaluation: *"sort according to your personal experience of remote work"* invites a phenomenological frame; *"sort by what is true about remote work"* invites a normative frame and constrains the viewpoints you'll discover.
> - **Avoid moral framings** (*"good vs bad"*, *"right vs wrong"*) unless that is exactly the question — they collapse subjectivity into one axis.
> - **Pilot the CoI on three or four colleagues** and ask them to paraphrase it back. If three of them paraphrase differently, the CoI is ambiguous.
>
> Critical Q-methodologists treat CoI design as a reflexive moment in itself: the choice of frame is a research decision worth documenting (we recommend a methodology memo — see Step 11).
```

### Task 3.5: Mention methodology memo

**Files:**
- Modify: `docs/tutorials/your-first-study.md` (insert new step before activation)

- [ ] **Step 1: Insert new step (renumber subsequent steps if needed)**

After Step 8 (or wherever fits the tutorial flow), insert:

```markdown
## Step 11: Open the methodology memo

Click the **Memos** button in the toolbar (top right). A slide-over panel opens. Click **New methodology memo** and write a short note — even one paragraph — capturing the design decisions you just made: why this CoI, why forced distribution, why this number of statements.

This costs you 5 minutes now and saves you hours later when a co-author asks why you chose forced over free, or when you write the methods section of the paper.

Methodology memos appear on all admin pages of the study and are included in the Research Package export.
```

Renumber the subsequent Activate / What you built / Next steps if needed.

- [ ] **Step 2: Commit Tasks 3.2-3.5 together**

```bash
git add docs/tutorials/your-first-study.md
git commit -m "docs(tutorial-1): add reflexive sidebars + methodology-memo step"
```

### Task 3.6: Update `docs/guides/conducting-studies.md`

**Files:**
- Modify: `docs/guides/conducting-studies.md`

- [ ] **Step 1: Read current content**

```bash
grep -n "^#\|memo\|distribution" docs/guides/conducting-studies.md
```

- [ ] **Step 2: Add a memos section**

Insert (placement: where the workflow discusses team coordination or design decisions):

```markdown
## Using memos as a design and analysis log

Memos are short markdown notes that travel with the study. Three suggested categories:

- **Methodology memos**: rationale for the CoI, the distribution shape, the rough-sort toggle, the choice of language(s). Write these *during* design, not afterwards — they are easier to write before you start contradicting yourself, and they protect you from reviewer questions later.
- **Analysis memos**: notes on factor decisions during the Refinement workflow (number of factors retained, flagging overrides, why a particular factor was dropped). See [Analyzing Results — Refinement](../tutorials/analyzing-results-refinement.md).
- **General memos**: anything else worth tracking (scheduling notes, recruitment observations).

@-mentions notify project members of items that need their attention. Memos are included in the Research Package export, making the analytic trail reproducible.
```

- [ ] **Step 3: Add a brief free-vs-forced distribution paragraph**

Where the guide discusses grid configuration:

```markdown
**Forced vs free distribution.** Qualis supports both. Forced distributions are the classical Brown-school default; free distributions are sometimes preferred in critical-Q work where the slot constraint is itself seen as an analytical artefact. The setting lives on the Grid tab and is reversible until activation. See [Your First Study — Step 6](../tutorials/your-first-study.md#step-6-add-statements-and-configure-the-grid-grid--q-set-tab) for the methodological discussion.
```

### Task 3.7: Update `docs/guides/data-export.md` — verify memo coverage

**Files:**
- Modify: `docs/guides/data-export.md`

- [ ] **Step 1: Search for memo coverage**

```bash
grep -ni "memo" docs/guides/data-export.md
```

- [ ] **Step 2: If no mention, add one**

In the section that lists what the Research Package contains (or under a dedicated table), add:

```markdown
- **`memos.json`** — methodology, analysis, and general memos for the study, with author, timestamp, category, and @-mention metadata. Included in the Research Package and CSV-bundle exports.
```

If memos are already covered, no action.

- [ ] **Step 3: Commit Tasks 3.6-3.7**

```bash
git add docs/guides/conducting-studies.md docs/guides/data-export.md
git commit -m "docs(guides): integrate memos in conducting-studies and data-export"
```

### Task 3.8: Merge tutorial 5 into `docs/contributing/development.md`

**Files:**
- Modify: `docs/contributing/development.md`
- Remove: `docs/tutorials/local-development.md`

- [ ] **Step 1: Read both files in full**

```bash
wc -l docs/contributing/development.md docs/tutorials/local-development.md
```

- [ ] **Step 2: Identify content unique to tutorial 5**

Manually compare. The tutorial likely has step-by-step setup that the dev guide may already cover or cover differently. Useful blocks to merge: the env-var setup details, the seed-data step, the make-target tour, anything pedagogical the dev guide lacks.

- [ ] **Step 3: Merge unique content into `docs/contributing/development.md`**

Use Edit to add the absorbed content into the existing dev guide structure. Do not append blindly; integrate. Strip any tutorial-flavoured phrasing ("In this tutorial, you will...") and rewrite as guide prose ("To set up locally, ...").

- [ ] **Step 4: Remove the tutorial**

```bash
git rm docs/tutorials/local-development.md
```

- [ ] **Step 5: Update inbound links**

```bash
grep -rln "tutorials/local-development\|local-development\.md" docs README.md 2>/dev/null
```

For each file in the output, update the link to point to `docs/contributing/development.md` (or the appropriate relative path):
- `README.md` line ~187: `docs/tutorials/local-development.md` → `docs/contributing/development.md`
- `docs/README.md`: drop the row from the Tutorials table.
- `docs/tutorials/README.md`: drop the entry.
- `docs/tutorials/your-first-study.md`: update the prerequisites line.
- `docs/tutorials/analyzing-results.md` Step 7 (about to be renamed in PR 4 — fix the link here, the rename in PR 4 will keep it working).

- [ ] **Step 6: Verify**

```bash
grep -rn "tutorials/local-development\|local-development\.md" docs README.md 2>/dev/null
```
Expected: zero matches.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "docs: merge local-development tutorial into contributing/development.md"
```

### Task 3.9: Final verification for B2

- [ ] **Step 1: Verify the 4-sidebar refonte**

```bash
grep -nE "Forced vs free|Rough-sort: should you|Writing a non-leading|methodology memo" docs/tutorials/your-first-study.md
```
Expected: at least 4 distinct matches.

- [ ] **Step 2: Lychee**

```bash
lychee --config lychee.toml docs/ README.md
```

- [ ] **Step 3: `make ci`**

```bash
make ci
```

- [ ] **Step 4: Manual read-through**

Open `docs/tutorials/your-first-study.md` and read it as if you were a new researcher. Check that the sidebars feel informative and not preachy, that the renumbering of steps is consistent throughout the file, and that the next-step pointer at the bottom still goes somewhere valid.

### Task 3.10: Open PR

- [ ] **Step 1: Push and open PR**

```bash
git push -u origin docs/drift-b2-tutorial-1-and-merge
gh pr create --title "docs: drift B2 — tutorial 1 refonte, researcher guides, tutorial 5 merge" --body "$(cat <<'EOF'
## Summary
- Refonte `your-first-study.md` with three reflexive sidebars (forced-vs-free distribution, rough-sort opt-in, non-leading CoI) and a new methodology-memo step. Tab list updated to current designer.
- `conducting-studies.md`: memos as design + analysis log, free-vs-forced paragraph.
- `data-export.md`: memo export coverage confirmed/added.
- Merge `docs/tutorials/local-development.md` into `docs/contributing/development.md`; drop the tutorial; update inbound links.

Spec: [`docs/superpowers/specs/2026-05-02-doc-improvement-design.md`](../blob/main/docs/superpowers/specs/2026-05-02-doc-improvement-design.md)

Wave 3 of 5.

## Test plan
- [x] Sidebars present and read informative, not prescriptive.
- [x] `grep -r "tutorials/local-development" .` returns 0.
- [x] `make ci` passes.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 2: Wait for squash-merge.**

---

# PR 4 — Vague 2 B3: Analysis tutorials split into Foundations + Refinement

**Branch:** `docs/drift-b3-analysis-tutorials`

**Pre-flight:**
```bash
git checkout main
git pull --ff-only
git checkout -b docs/drift-b3-analysis-tutorials
```

### Task 4.1: Rename existing tutorial

**Files:**
- Rename: `docs/tutorials/analyzing-results.md` → `docs/tutorials/analyzing-results-foundations.md`

- [ ] **Step 1: git mv**

```bash
git mv docs/tutorials/analyzing-results.md docs/tutorials/analyzing-results-foundations.md
```

- [ ] **Step 2: Update inbound links**

```bash
grep -rln "analyzing-results\.md\|analyzing-results#" docs README.md 2>/dev/null
```

For each file, update `analyzing-results.md` → `analyzing-results-foundations.md`. Likely files: `docs/README.md`, `README.md`, `docs/tutorials/README.md`, `docs/tutorials/collecting-responses.md` (its "Next steps" link).

- [ ] **Step 3: Verify**

```bash
grep -rn "analyzing-results\.md" docs README.md 2>/dev/null
```
Expected: zero (only the new `-foundations.md` and `-refinement.md` should appear).

### Task 4.2: Refonte Foundations content

**Files:**
- Modify: `docs/tutorials/analyzing-results-foundations.md`

- [ ] **Step 1: Update the H1 and intro**

Old H1: `# Analyzing Results`
New H1: `# Analyzing Results — Foundations`

Update the opening paragraph to position this as the first of two analysis tutorials. Suggested:

```markdown
# Analyzing Results — Foundations

In this tutorial, you will run a factor analysis on the study you built in the previous tutorials and learn what each results tab shows. The goal is the *core workflow that produces a publishable factor solution* — defaults that work, the four basic results tabs, exports.

Once you are comfortable with this baseline, [Analyzing Results — Refinement](analyzing-results-refinement.md) covers the iterative tools (Explorer panel, Compare, factor canvas, memos) you reach for when defaults are not enough — when you need to find the right factor count, validate stability, or build the interpretive narrative.
```

- [ ] **Step 2: Add an explicit Refinement pointer at the end**

Replace the existing "Next steps" with:

```markdown
## Next steps

You ran a complete factor analysis with defaults and saw what each tab surfaces. Two paths forward:

- **For most workflows**, this is enough — export, write up, ship. Skip to the export formats covered in [Data Export](../guides/data-export.md).
- **When you need more**, continue to **[Analyzing Results — Refinement](analyzing-results-refinement.md)**:
  - Choose the factor count deliberately (Explorer panel + preview range).
  - Validate stability against an alternate solution (Compare / Tucker φ).
  - Build the interpretive narrative for each factor (factor canvas + quote picker).
  - Trace your collaborative interpretation (memos + @-mentions).
```

- [ ] **Step 3: Light pedagogical pass on the existing steps**

Steps 1-7 of the existing tutorial stay; do not refonte them. Two exceptions:
- Step 2: add a parenthetical *« — these are the classical Brown-school defaults; we explore alternatives in Refinement »*.
- Step 3 (Loadings) and Step 5 (Statements): if either references *« when you are interpreting a real study »*, point to the Refinement tutorial instead of leaving the question hanging.

- [ ] **Step 4: Commit**

```bash
git add docs/tutorials/analyzing-results-foundations.md docs/README.md docs/tutorials/README.md README.md docs/tutorials/collecting-responses.md
git commit -m "docs(tutorial-3): refonte Foundations + Refinement handoff"
```

### Task 4.3: Create Refinement tutorial — skeleton

**Files:**
- Create: `docs/tutorials/analyzing-results-refinement.md`

- [ ] **Step 1: Create file with frontmatter and intro**

```markdown
# Analyzing Results — Refinement

In [Analyzing Results — Foundations](analyzing-results-foundations.md) you ran the standard workflow with defaults. This tutorial covers the iterative tools you reach for when defaults are not enough — when you need to choose the factor count deliberately, validate that minor changes to the analysis produce equivalent results, or build the interpretive narrative for each factor.

These tools are useful for two different audiences:

- The methodologist who wants to *validate* a factor solution before publishing — the **Explorer panel** and **Compare** are the quantitative refinement tools.
- The critical-Q researcher who wants to *interpret* factors as situated viewpoints — the **factor canvas with quote picker** and **memos** are the interpretive layering tools.

Most studies use both. The order below is the order they typically enter a workflow.

**What you will learn:**
- How to choose the factor count by scanning eigenvalues across a preview range.
- How to compare two analysis runs and read Tucker φ congruence.
- How to use focus mode and the quote picker to anchor a factor narrative in participant voice.
- How to log interpretive decisions as memos for collaboration and reproducibility.

**Time required:** ~30 minutes
**Prerequisites:** A Qualis study with at least one analysis run completed (see Foundations).

---
```

### Task 4.4: Refinement Section 1 — Explorer panel

**Files:**
- Modify: `docs/tutorials/analyzing-results-refinement.md`

- [ ] **Step 1: Read the actual Explorer UI**

Re-read the source from Task 2.1 Step 4. Confirm: where the panel sits, what columns, what the preview range slider looks like, whether the Kaiser-recommended count is auto-shown.

- [ ] **Step 2: Append section**

```markdown
## 1. Choosing the factor count (Explorer panel)

When you load an analysis run, the Explorer panel sits at the top of the page. It shows eigenvalue and cumulative variance for a configurable preview range — typically 1 to 10 factors.

**The default Kaiser criterion** (eigenvalue > 1) is a starting point, not a verdict. Reasons to deviate:

- **Variance leveling.** If factors 3 and 4 each explain 8% but factor 5 explains 2%, retain four — the marginal factor adds little.
- **Theoretical legibility.** A four-factor solution that maps onto a known theoretical typology may be preferable to a five-factor solution that splits one viewpoint in two for statistical reasons.
- **Sample-size constraints.** With small N, retaining many factors over-fits. As a rule of thumb, do not retain more factors than `N / 6`.

Adjust the preview range to scan up to 8 or 10 factors and look for an *elbow* — a point where successive eigenvalues drop sharply. That elbow plus the Kaiser line is your starting hypothesis. Re-run the analysis with that factor count.

> **Document your choice.** Open a new analysis memo (Memos toolbar) and write one sentence: *« retained 3 factors based on Kaiser + variance elbow at 4 → 5 »*. This is the kind of decision a reviewer asks about.
```

### Task 4.5: Refinement Section 2 — Compare / Tucker φ

```markdown
## 2. Validating stability (Compare)

Once you have a candidate solution, ask: would a small change in the analysis produce the same factors? Three perturbations worth checking:

1. **Different rotation** — re-run with rotation off, then with Varimax, and Compare them. Strong factors survive both.
2. **Different flagging** — re-run with manual flagging excluding one or two borderline cases. Stable factors are robust to flagging choices.
3. **Different N** — if you have collected more responses since your initial run, re-run on the larger N.

The Compare panel aligns two analysis runs via Tucker φ congruence:
- **φ ≥ 0.95**: factors are essentially identical.
- **0.90 ≤ φ < 0.95**: equivalent — minor differences in loadings.
- **φ < 0.90**: not the same factor; the perturbation did matter.

The aligned-arrays view reorders + sign-flips the second run's factors to maximize congruence with the first, so you can read the delta columns to see *which statements moved between runs*. Statements that moved by more than 1 position are worth a second look.

> **Document your choice.** Save a memo: *« compared run 4 (manual flag, 3F) vs run 7 (auto, 3F): φ_diag = 0.97/0.94/0.91, statements 11 and 23 moved at the boundary — kept run 4 »*.
```

### Task 4.6: Refinement Section 3 — Factor canvas + quote picker

```markdown
## 3. Building the factor narrative (factor canvas)

The factor array tells you *what* a factor agrees and disagrees with. It does not tell you *why this viewpoint exists* — that is the interpretive layer.

Click into a factor on the Analysis page to enter the **factor canvas** in focus mode. The factor array sits on the left; the quote picker is on the right. The quote picker pulls:

- Post-sort comments from participants who flagged most strongly on this factor.
- Audio transcripts (if your study collected post-sort audio) for the same participants.
- Distinguishing statements at the +3 and -3 extremes.

Drag quotes from the picker onto the canvas to anchor specific claims about the factor in specific participant voices. The result is a panel you can copy-paste into the *Findings* section of a paper, with each interpretive claim sourced from one or more participants.

This is also where critical-Q practice diverges from purely statistical interpretation: instead of treating the factor array as a finished object, you treat it as a starting point for interpretive work where situated participant voices remain visible in the writeup.

> **Document your choice.** A memo per factor: *« Factor 1 — flexibility-driven viewpoint, anchored in P12's "control over my schedule" + P27's audio remark on commute time »*.
```

### Task 4.7: Refinement Section 4 — Memos and collaborative interpretation

```markdown
## 4. Tracing collaborative interpretation (memos)

Memos turn analysis from an opaque solo activity into a traceable conversation. Three patterns worth adopting:

- **Decision memos**: every factor-count change, every flagging override, every dropped factor — one memo per decision. This protects you from forgetting why you did what you did, and from the « mais je croyais qu'on avait gardé 4 facteurs » email three weeks later.
- **Interpretive memos**: the kind started in Section 3 — one per factor, anchored in quotes.
- **@-mention threads**: when a co-researcher should weigh in (« @clémence: ce facteur 3 te paraît distinct du 2 ou c'est la même chose dite autrement ? »), use the @-mention. The mentioned user gets a badge on their next page load.

Memos are exported with the Research Package, so the audit trail is reproducible by anyone who opens the archive.

---

## What you built

You went from a default analysis to a deliberately-chosen, stability-validated, narratively-anchored, collaboratively-traced factor solution. The tools — Explorer, Compare, factor canvas, memos — are not steps in a fixed sequence; they are utilities you reach for when defaults are not enough.

## Next steps

You have completed the analysis workflow. For exporting to PQMethod, R, or Ken-Q, see [Data Export](../guides/data-export.md). For methodological background, see [Q-Methodology](../explanation/q-methodology.md).
```

- [ ] **Commit Tasks 4.3-4.7**

```bash
git add docs/tutorials/analyzing-results-refinement.md
git commit -m "docs(tutorial-4): create Refinement tutorial covering Explorer/Compare/Canvas/Memos"
```

### Task 4.8: Update tutorial indices

**Files:**
- Modify: `docs/README.md`
- Modify: `docs/tutorials/README.md`

- [ ] **Step 1: `docs/README.md` Tutorials table**

Replace the single "Analyzing Results" row with two rows for Foundations and Refinement. Adjust paths.

- [ ] **Step 2: `docs/tutorials/README.md`**

Same update — list 4 tutorials (your-first-study, collecting-responses, analyzing-results-foundations, analyzing-results-refinement).

- [ ] **Step 3: Verify**

```bash
grep -nE "analyzing-results-foundations|analyzing-results-refinement" docs/README.md docs/tutorials/README.md
```
Expected: at least 4 matches total.

### Task 4.9: Cross-check `q-methodology.md`

**Files:**
- Modify (light): `docs/explanation/q-methodology.md`

- [ ] **Step 1: Search for distribution discussion**

```bash
grep -nE "distribution|forced|free" docs/explanation/q-methodology.md
```

- [ ] **Step 2: If forced distribution is discussed but free is not, add a paragraph**

Insert a short paragraph (3-5 sentences) covering the free-distribution alternative and the methodological debate. Reference Watts & Stenner 2012 ch. 4 as the standard discussion. Do not refonte the surrounding section.

If the file already covers both, no action.

- [ ] **Step 3: Commit**

```bash
git add docs/README.md docs/tutorials/README.md docs/explanation/q-methodology.md
git commit -m "docs: tutorial indices + free-distribution mention in q-methodology"
```

### Task 4.10: Verification and PR

- [ ] **Step 1: Lychee**

```bash
lychee --config lychee.toml docs/ README.md
```

- [ ] **Step 2: Manual read-through of Refinement**

Read the new tutorial top to bottom. Check: does it land for both audiences (methodologist *and* critical-Q researcher)? Does each section tell you what to *do*, not just describe a feature?

- [ ] **Step 3: `make ci`**

```bash
make ci
```

- [ ] **Step 4: Push and open PR**

```bash
git push -u origin docs/drift-b3-analysis-tutorials
gh pr create --title "docs: drift B3 — analysis tutorials split into foundations + refinement" --body "$(cat <<'EOF'
## Summary
- Rename `analyzing-results.md` → `analyzing-results-foundations.md`. Refonte intro and next-steps to position it as the baseline workflow with an explicit handoff to Refinement.
- New `analyzing-results-refinement.md` covering Explorer panel + preview range, Compare + Tucker φ, factor canvas + quote picker, memos. Pivots between methodologist-facing and critical-Q-facing audiences inside the same tutorial.
- Tutorial indices updated. Free-distribution mention added to q-methodology.md if missing.

Spec: [`docs/superpowers/specs/2026-05-02-doc-improvement-design.md`](../blob/main/docs/superpowers/specs/2026-05-02-doc-improvement-design.md)

Wave 4 of 5.

## Test plan
- [x] Both tutorials present, handoff is explicit.
- [x] Tutorials index lists 4 tutorials.
- [x] Manual read confirms both audiences are addressed.
- [x] `make ci` passes.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 5: Wait for squash-merge.**

---

# PR 5 — Vague 3: README repositioning

**Branch:** `docs/readme-repositioning`

**Pre-flight:**
```bash
git checkout main
git pull --ff-only
git checkout -b docs/readme-repositioning
```

### Task 5.1: Reformulate Statement of need

**Files:**
- Modify: `README.md` lines 21-27

- [ ] **Step 1: Read current paragraph**

```bash
sed -n '19,29p' README.md
```

- [ ] **Step 2: Replace the closing sentence and adjust the surrounding framing**

Old (line 25):
```
Qualis covers the full workflow in a single self-hosted browser application: study design, mobile-first recruitment and data collection, factor analysis, and export to PQMethod, R, and Ken-Q formats. The analytical choices stay visible and editable by the researcher. The platform is targeted at groups practising critical Q-methodology and is also usable for classical workflows.
```

New:
```
Qualis covers the full workflow in a single self-hosted browser application: study design, mobile-first recruitment and data collection, factor analysis, and export to PQMethod, R, and Ken-Q formats. The analytical choices stay visible and editable by the researcher. Qualis runs both classical Brown-school Q workflows and critical-Q practices that emphasise reflexivity, traceability, and interpretive layering — the same tool serves a 30-statement forced-distribution PQMethod-style study and a 60-statement free-distribution study with collaborative memos and audio post-sorts.
```

- [ ] **Step 3: Verify the surrounding paragraph still reads coherently**

Read lines 19-29 again. The Stainton Rogers / Stenner / Watts & Stenner / Sneegas mention earlier in the paragraph still stands as background — it is no longer foregrounded by the closing sentence.

### Task 5.2: Add comparison-table row

**Files:**
- Modify: `README.md` lines 33-46

- [ ] **Step 1: Locate the table**

The table starts at line 33 (`| Capability |`). Insert one row between `Self-hosted` and `Open source` — somewhere that fits the rhythm. Or after `Audio post-sort responses` so the new row sits with other interpretation-related capabilities.

- [ ] **Step 2: Insert row**

```markdown
| Collaborative interpretation (memos, quotes, focus) | No | No | No | No | No | **Yes** |
```

- [ ] **Step 3: Verify table renders correctly**

```bash
grep -c "^|" README.md | head
```
Expected: same count + 1.

### Task 5.3: Codex stress-test on the reformulation

- [ ] **Step 1: Invoke codex-second-opinion in stress-test mode**

Use the `codex-second-opinion` skill, mode *stress-test*. Submit:
- The new closing sentence of the Statement of need.
- The argument: *"Broaden positioning to include classical Brown-school users without losing the critical-Q audience that motivated Qualis in the first place. The new sentence is symmetric — both schools see themselves served. The example pair (PQMethod-style 30-statement vs free-distribution-with-memos 60-statement) makes the symmetry concrete."*
- Ask Codex to argue against: *"You are diluting the critical-Q distinctiveness of Qualis. By treating PQMethod-style workflows as equally central, you signal to the critical-Q audience that the platform's identity has shifted toward methodological neutrality, which is itself a position they reject."*

- [ ] **Step 2: Apply retained feedback**

If Codex surfaces a real risk (e.g., the « *the analytical choices stay visible and editable* » sentence already implicitly favors critical-Q reflexivity and the new closing weakens it), revise accordingly. If the critique is performative, document the divergence in the PR description.

### Task 5.4: Final verification

- [ ] **Step 1: Read the full README top to bottom**

Specifically the Statement of need + comparison table + key features. Does it now read coherently for *both* a PQMethod user and a critical-Q researcher? Test mentally: would either feel out of place?

- [ ] **Step 2: Lychee**

```bash
lychee --config lychee.toml README.md
```

- [ ] **Step 3: `make ci`**

```bash
make ci
```

### Task 5.5: Commit and open PR

- [ ] **Step 1: Commit**

```bash
git add README.md
git commit -m "$(cat <<'EOF'
docs: README — broaden positioning, add collaborative-interpretation row

- Statement of need: replace "targeted at critical Q + also usable for
  classical" with symmetric framing where Qualis serves both classical
  Brown-school and critical-Q workflows.
- Comparison table: add Collaborative interpretation row to surface the
  differentiator vs KADE/qmethod/Ken-Q.

Codex stress-test feedback applied (or divergence noted) in PR description.

Spec: docs/superpowers/specs/2026-05-02-doc-improvement-design.md
Analytical fidelity section deferred until PQMethod/qmethod cross-validation runs.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 2: Push and open PR**

```bash
git push -u origin docs/readme-repositioning
gh pr create --title "docs: README — broaden positioning, add collaborative-interpretation row" --body "$(cat <<'EOF'
## Summary
Two surgical changes to position Qualis for both classical and critical Q-methodology audiences:

- Reformulated the Statement of need's closing sentence so classical Brown-school workflows and critical-Q practices are framed symmetrically. Critical-Q references (Stainton Rogers, Stenner, Watts & Stenner, Sneegas) remain in the paragraph as background.
- Added a *Collaborative interpretation (memos, quotes, focus)* row to the comparison table — the differentiator vs KADE/qmethod/Ken-Q.

Codex stress-test outcome: [paste here]

Spec: [`docs/superpowers/specs/2026-05-02-doc-improvement-design.md`](../blob/main/docs/superpowers/specs/2026-05-02-doc-improvement-design.md)

Wave 5 of 5.

**Deferred**: an *Analytical fidelity* section was originally proposed and dropped from this wave because cross-validation against PQMethod 2.35 and the R `qmethod` package has not been run. A follow-up PR will add it once validation is done.

## Test plan
- [x] Manual read for both audiences.
- [x] `lychee` passes on README.
- [x] `make ci` passes.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Wait for squash-merge.**

---

## Summary

5 PRs, sequential, squash-merged:

1. `docs/hygiene` — duplicate fix, contributing folder consolidation, drop legacy plans + TODO.
2. `docs/drift-b1-reference` — reference docs + collecting-responses patches.
3. `docs/drift-b2-tutorial-1-and-merge` — your-first-study refonte + researcher guides + tutorial 5 merge.
4. `docs/drift-b3-analysis-tutorials` — analysis tutorial split.
5. `docs/readme-repositioning` — README Statement of need + comparison row.

Estim total: ~5-6 days of focused work.
