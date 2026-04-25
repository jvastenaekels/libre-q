# Axis 07 — Frontend / UX

**Date:** 2026-04-25
**Auditor:** Claude (Sonnet 4.6) via deep-audit session
**Pass:** Standard
**Status:** Complete

---

## Tooling summary

| Tool | Result |
|------|--------|
| `npm run i18n-check` | ✅ All 3 locales (en/fr/fi) in perfect sync — 1 675 keys each |
| Custom identical-values scan | ⚠️ 59 suspicious EN==FR entries; 16 suspicious EN==FI entries (see F-07-001) |
| Hardcoded string grep (JSX) | ⚠️ See F-07-003, F-07-004 |
| axe-core CLI | ❌ Skipped — ChromeDriver version mismatch (installed: 146, required: 148). Dev server started successfully at `http://localhost:5173`. Raw: `.raw/axe-SKIPPED.txt` |
| Manual code review | Components reviewed: `FineSortPage.tsx`, `RoughSortPage.tsx`, `GridSort.tsx`, `SortableCard.tsx`, `DroppableSlot.tsx`, `ConsentPage.tsx`, `LandingPage.tsx`, `ResetPage.tsx`, `StudyStatusPage.tsx`, `FactorArraysView.tsx`, `FactorCharacteristicsTable.tsx` |

---

## Findings

### F-07-001 : Suspicious EN==FR identical values — likely untranslated strings

- **Severity:** major
- **Audience:** [SoftwareX] [Prod]
- **Location:** transverse — `frontend/public/locales/fr/translation.json`
- **Observation:** The i18n-check script confirms structural key parity (all 1 675 keys present in all three locales), but the identical-values scan found **59 keys** where the French translation value is byte-identical to the English value and the string is longer than 4 characters. Representative sample:
  ```
  admin.analysis.configuration: 'Configuration'
  admin.analysis.extraction_method: 'Extraction'
  admin.analysis.rotation_method: 'Rotation'
  admin.concourse.field_description: 'Description'
  admin.data.detail.session: 'Session'
  admin.data.stats.email: 'Emails'
  admin.admin.breadcrumbs.admin: 'Admin'
  admin.hub.n_active_one: '{{count}} active'
  admin.design.qsort.tabs.distribution: 'Distribution'
  admin.design.questions.defaults.option: 'Option'
  ```
  Many of these are genuine cognates (e.g., "Markdown", "Varimax", "Rotation") or proper nouns ("PQMethod (ZIP)", "Admin") that are correctly untranslated. However, several are clearly not translated: `admin.hub.n_active_one`, `admin.design.questions.defaults.option`, `admin.design.qsort.tabs.distribution`.
  For Finnish: 16 identical values, some clearly untranslated: `admin.design.qsort.set.confirm_reset_codes` (full sentence in English visible to Finnish users), `admin.participant.tabs.session: 'Metadata'`.
- **Impact:** French and Finnish users see English strings on the admin UI. For SoftwareX, the multilingual claim is weakened if admin strings fall back to English for non-EN locales. `confirm_reset_codes` is a full English sentence shown in a confirm dialog — egregious.
- **Recommendation:** (1) Audit the 59 FR identical-value entries: split into (a) acceptable cognates/proper nouns — add inline comment in JSON to document the intent; (b) genuine missing translations — translate. Priority: any key that is a full sentence or a UI label visible to non-admin users. (2) For FI, translate `confirm_reset_codes` and `codes_reset` as a minimum. Full audit of 16 entries. (3) Extend `check_i18n.py` with a heuristic to flag sentences (strings containing whitespace + length > 15) that are identical across locales — makes future regressions visible at CI.
- **Effort:** M

---

### F-07-002 : Hardcoded progress bar in RoughSortPage — no ARIA role/label

- **Severity:** major
- **Audience:** [SoftwareX] [Prod]
- **Location:** `frontend/src/pages/RoughSortPage.tsx:271-279`
- **Observation:** The Q-sort progress indicator (1/30, 2/30… tracking how many cards sorted) is rendered as a raw `<div>` with a `style={{ width: '${progress}%' }}`. It has no `role="progressbar"`, no `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, or `aria-label`. Screen readers are entirely blind to progress in the primary participant journey.
  ```tsx
  <div className="w-full h-1 bg-gray-100 flex-none z-30">
      <div
          className="h-full transition-all duration-300 ease-out"
          style={{ width: `${progress}%`, backgroundColor: 'var(--brand-accent)' }}
      />
  </div>
  ```
  Note: The Radix-based `<Progress>` component at `frontend/src/components/ui/progress.tsx` correctly wraps `@radix-ui/react-progress` (which injects ARIA roles automatically). This hand-rolled progress bar bypasses that.
- **Impact:** WCAG 2.1 AA, criterion 4.1.2 (Name, Role, Value). Participants using screen readers cannot follow their progress during the rough-sort phase — the most time-consuming step of the Q-sort. Directly relevant to the SoftwareX claim of accessibility.
- **Recommendation:** Replace the raw `<div>` pair with the `<Progress>` Radix component already in the design system, or at minimum add `role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100} aria-label={t('rough.progress.label', 'Sorting progress')}` to the outer div.
- **Effort:** S

---

### F-07-003 : Hardcoded English strings on participant-facing pages

- **Severity:** major
- **Audience:** [SoftwareX] [Prod]
- **Location:** Multiple files (see below)
- **Observation:** Several participant-visible strings are hardcoded English, bypassing the i18n system entirely:
  1. `frontend/src/pages/LandingPage.tsx:34` — `"Enter your study code to begin."` — no `t()` call. This is the first screen any participant sees.
  2. `frontend/src/pages/LandingPage.tsx:40` — `<label htmlFor="study-code" className="sr-only">Study Code</label>` — sr-only label hardcoded in English; screen-reader users hear English regardless of locale.
  3. `frontend/src/pages/LandingPage.tsx:63` — `"Go to Study"` button text — no `t()`.
  4. `frontend/src/pages/ResetPage.tsx:35` — `"Resetting study session..."` — participant sees this during the loading/reset phase.
  5. `frontend/src/pages/StudyStatusPage.tsx:88` — `"Libre-Q Platform"` footer — minor (proper name), but inconsistent.
  6. `frontend/src/pages/ConsentPage.tsx:25` — `message: 'You must consent to participate.'` inside the Zod schema validation rule. This message is **not** surfaced to the user (the UI renders `t('welcome.consent.error', ...)` instead), so this is benign but a maintenance trap if the error handling changes.
- **Impact:** Items 1–4 are visible to French and Finnish participants. LandingPage is reached before locale selection is possible in many cases — this is the most critical entry point. WCAG 3.1.1 (Language of Page) and real UX impact for non-English participants in multilingual studies.
- **Recommendation:** Wrap the four participant-visible strings in `t()` with appropriate keys (add to all three locale files). For LandingPage specifically, the locale may not yet be loaded from study config at this point — ensure `useTranslation()` is called and that a fallback/default locale is set in i18next config. The Zod schema message (item 6) should also be replaced with a dynamic `t()` call for future-proofing, but is low priority.
- **Effort:** S

---

### F-07-004 : Hardcoded English aria-labels on participant-critical interactive elements

- **Severity:** minor
- **Audience:** [Prod]
- **Location:** Multiple files (see below)
- **Observation:** Several `aria-label` attributes that are read by screen readers are hardcoded English strings rather than `t()` keys:
  1. `frontend/src/components/GridSort.tsx:186` — `aria-label="Expand instructions"` (mobile toggle button for the condition-of-instruction panel in the fine-sort grid)
  2. `frontend/src/components/GridSort.tsx:220` — `aria-label="Minimize instructions"`
  3. `frontend/src/components/GridSort.tsx:240` — `aria-label="Grid controls"` (toolbar)
  4. `frontend/src/components/GridSort.tsx:321` — `aria-label="Grid legend"` (legend group)
  5. `frontend/src/components/GridSort.tsx:488` — `aria-label="Cancel selection"`
  6. `frontend/src/pages/RoughSortPage.tsx:322` — `aria-label="Close tip"`
  7. `frontend/src/components/admin/designer/QSortEditor.tsx:1367,1406` — `` `Increase capacity for column ${idx}` `` / `` `Decrease capacity for column ${idx}` `` (interpolated English, admin panel)
  8. `frontend/src/components/MethodologyTips.tsx:150,188` — `"Previous tip"` / `"Next tip"`
  Note: Several of these (GridSort toolbar, fine-sort toolbar label `fine.toolbar.label`) appear in the i18n identical-values list for FI — confirming the localization gap.
- **Impact:** Screen-reader users in French or Finnish will hear English labels for key interactive elements in the fine-sort grid, which is the most complex interaction in the participant journey. Items 1–5 are on the critical WCAG AA path.
- **Recommendation:** Pass these labels through `t()`. They are already partially covered: `translation.fine.toolbar.label` exists in the translation files but its value is the same in EN and FI (F-07-001 overlap). Coordinate fix with F-07-001.
- **Effort:** S

---

### F-07-005 : `StudyStatusControl` — `div[role="button"]` missing `onKeyDown`

- **Severity:** minor
- **Audience:** [Prod]
- **Location:** `frontend/src/components/admin/dashboard/StudyStatusControl.tsx:272`
- **Observation:** The clickable study-state pipeline steps (Draft → Active → Paused → Closed) render their trigger as:
  ```tsx
  <div role="button" tabIndex={0} className="outline-none">
      {content}
  </div>
  ```
  This `div` lacks an `onKeyDown` handler. Keyboard users who focus it with Tab and press Enter or Space see no response (the click handler is on the `AlertDialogTrigger` that wraps it, but the trigger delegates to the Radix `asChild` mechanism; whether keyboard events bubble correctly through `asChild` here depends on Radix internals and is not guaranteed). The `outline-none` class also suppresses the default focus ring without providing an alternative.
  Compare: `AdminDashboard.tsx:724` has the same `role="button"` pattern but correctly adds `onKeyDown` and `tabIndex`; `DroppableSlot.tsx` correctly wires `onKeyDown`. `StudyStatusControl` is the only broken instance.
- **Impact:** WCAG 2.1 AA, criterion 2.1.1 (Keyboard). Admin users who navigate by keyboard cannot change study state (launch, pause, close) without a mouse. Admin-only path; lower severity than participant-critical paths.
- **Recommendation:** Add `onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.click(); } }}` to the `div`, or switch to a native `<button>` wrapped in `AlertDialogTrigger asChild`. Also add `focus-visible:ring-2 focus-visible:ring-indigo-400` to replace the suppressed default outline.
- **Effort:** S

---

### F-07-006 : `FactorArraysView` — distinguishing-statement colour swatch in legend is colour-only

- **Severity:** minor
- **Audience:** [SoftwareX] [Prod]
- **Location:** `frontend/src/components/admin/analysis/FactorArraysView.tsx:152-155`
- **Observation:** The legend at the bottom of the factor arrays table uses only a coloured square (amber-50 background, amber-200 border) to identify distinguishing statements:
  ```tsx
  <div className="w-3 h-3 rounded bg-amber-50 border border-amber-200" />
  {t('admin.analysis.distinguishing_legend', 'Distinguishing statement')}
  ```
  The colour square has no `aria-hidden="true"` and no textual or shape alternative for colour-blind users. Within the table cells themselves, distinguishing statements are similarly marked only by amber background vs white — no icon or textual annotation. Note: the table cells do carry a `title` attribute (full statement text), but this does not provide the distinguishing-status cue.
  Cross-reference: `FactorCharacteristicsTable` correctly uses `aria-hidden="true"` on its icons and `sr-only` spans for the benchmark badges — the same pattern should be applied here.
- **Impact:** WCAG 2.1 AA, criterion 1.4.1 (Use of Colour). Users with deuteranopia or protanopia cannot distinguish highlighted cells. This is in the analysis output — the scientific core of the tool — and affects researcher users.
- **Recommendation:** (1) Add `aria-hidden="true"` to the legend swatch `<div>`. (2) Add a non-colour indicator to distinguishing-statement cells: a small asterisk or `★` icon alongside the statement code, or a `<span className="sr-only">{t('admin.analysis.distinguishing_marker', '(distinguishing)')}</span>` inside the cell. (3) The colour contrast of amber-700 text on amber-50 background is borderline; verify against WCAG 1.4.3 (4.5:1 for normal text).
- **Effort:** S

---

### F-07-007 : `window.confirm()` used for destructive actions — inaccessible on mobile and un-translatable

- **Severity:** minor
- **Audience:** [Prod] [SoftwareX]
- **Location:** `frontend/src/pages/FineSortPage.tsx:366`, `frontend/src/pages/WelcomePage.tsx:299`, `frontend/src/components/admin/designer/IntroductionEditor.tsx:44`, `frontend/src/utils/studyResetHelpers.ts:54`
- **Observation:** Four locations use `window.confirm()` for destructive-action confirmation (fine-sort reset, study session reset, introduction text reset, generic study reset helper). Native browser confirm dialogs:
  - Are not styleable and cannot be localized through `react-i18next` (the string passed is the raw argument, bypassing the i18n pipeline in some browsers)
  - Are blocked by default in some mobile browsers (Android WebView, iOS in-app browsers) and some desktop environments (browser settings)
  - Are not accessible to assistive technologies in consistent ways
  - Break the visual design and user experience established by the Radix `AlertDialog` already in use elsewhere in the codebase (`StudyStatusControl` uses `AlertDialog` for the same class of confirmations)
  Note: `useStudyPersistence.ts:57` has a comment stating the confirm logic was intentionally removed — this shows the codebase is partially migrated away from `window.confirm`.
- **Impact:** On platforms where `window.confirm` is blocked (common in Electron, in-app browsers, some kiosk deployments), fine-sort reset and study restart are silently blocked or ignored. For the participant Q-sort flow, this could trap a participant.
- **Recommendation:** Replace all four occurrences with Radix `AlertDialog` (already in the design system). The migration pattern is already demonstrated in `StudyStatusControl`. Priority: `FineSortPage` (participant-facing), then the others.
- **Effort:** M

---

### F-07-008 : `LandingPage` entirely outside the i18n system — no `useTranslation` import

- **Severity:** minor
- **Audience:** [SoftwareX] [Prod]
- **Location:** `frontend/src/pages/LandingPage.tsx` (entire file)
- **Observation:** `LandingPage` is the entry point for participants (before they know which study to join). The file has no `useTranslation` import. This means not only are the visible strings hardcoded (F-07-003), but any future additions will also bypass i18n unless the hook is added explicitly. This is a structural gap, not just individual missing `t()` calls.
- **Impact:** All participants using French or Finnish are greeted with an English landing page. While locale cannot be inferred before slug entry (study config drives locale), i18next can use the browser's Accept-Language as a fallback — the LandingPage should at minimum try to respect it.
- **Recommendation:** Add `import { useTranslation } from 'react-i18next'` and call `const { t } = useTranslation()` in `LandingPage`. Add translation keys for the three visible strings (F-07-003 items 1–3). Configure i18next's `lng` detection to use `navigator.language` as fallback before study config is available.
- **Effort:** S (subsumed by F-07-003 if addressed together)

---

### F-07-009 : Fine-sort keyboard alternative exists but is undiscoverable on mobile

- **Severity:** observation
- **Audience:** [SoftwareX]
- **Location:** `frontend/src/pages/RoughSortPage.tsx:403-424`, `frontend/src/pages/FineSortPage.tsx:100-109`
- **Observation:** Both the rough-sort (swipe) and fine-sort (drag-and-drop) participant interactions have proper keyboard alternatives:
  - Rough-sort: arrow-key handlers (←/→/↓ for disagree/agree/neutral, Z for undo) are implemented at `RoughSortPage.tsx:186-212`; keyboard shortcuts are visually indicated on desktop (`hidden lg:flex`), correctly hidden on mobile.
  - Fine-sort: `KeyboardSensor` from dnd-kit is registered and `SortableCard` correctly handles `Enter`/`Space` via `onKeyDown`. The select-then-place interaction works via keyboard.
  The keyboard alternative for fine-sort is not documented for users on any screen size — no hint is surfaced. On desktop, the rough-sort `kbd` hint is shown, but fine-sort has no equivalent. This is an observation rather than a WCAG violation since dnd-kit's keyboard support is functional via the standard dnd-kit keyboard protocol.
- **Impact:** Power users and accessibility-dependent users may not discover the keyboard fine-sort interaction. For SoftwareX, the accessibility claim would be stronger with explicit keyboard documentation.
- **Recommendation:** Add a collapsible keyboard-shortcut hint in the GridSort toolbar or footer (parallel to the rough-sort `kbd` hint pattern). Alternatively, surface this in the `MethodologyTips` component which already exists and is shown during fine-sort.
- **Effort:** S

---

### F-07-010 : i18n identical-values scan reveals FI `confirm_reset_codes` is a full untranslated sentence

- **Severity:** major (subcase of F-07-001 — listed separately for tracking)
- **Audience:** [Prod]
- **Location:** `frontend/public/locales/fi/translation.json` — key `admin.design.qsort.set.confirm_reset_codes`
- **Observation:** The Finnish locale contains:
  ```json
  "confirm_reset_codes": "Are you sure you want to re-sequence all statement codes (s1, s2, s3...)?"
  ```
  This is a full English-language confirmation dialog sentence shown to Finnish admin users when they trigger statement code re-sequencing. Confirmed by the identical-values scan. Unlike the cognates in F-07-001, this is unambiguously a translation gap — a Finnish researcher would see English in a critical destructive-action dialog.
- **Impact:** Finnish admin users see English in a confirmation dialog. Degrades the multilingual claim.
- **Recommendation:** Translate to Finnish. If no Finnish translator is available, add a TODO comment in the locale file and lower severity to minor. For SoftwareX, acknowledge in the manuscript that Finnish is a community-contribution locale if translations are incomplete.
- **Effort:** S

---

## Summary

| ID | Severity | Effort | Topic |
|----|----------|--------|-------|
| F-07-001 | major | M | 59 EN==FR / 16 EN==FI suspicious identical-value entries |
| F-07-002 | major | S | Progress bar missing ARIA role/attributes (participant journey) |
| F-07-003 | major | S | Hardcoded EN strings on participant-facing pages (LandingPage, ResetPage) |
| F-07-004 | minor | S | Hardcoded EN `aria-label` on critical fine-sort/rough-sort interactive elements |
| F-07-005 | minor | S | `StudyStatusControl` `div[role=button]` missing `onKeyDown`, outline suppressed |
| F-07-006 | minor | S | Distinguishing-statement colour swatch in `FactorArraysView` is colour-only |
| F-07-007 | minor | M | `window.confirm()` inaccessible on mobile, un-localizable, breaks design system |
| F-07-008 | minor | S | `LandingPage` entirely outside i18n (no `useTranslation` import) — subsumed by F-07-003 |
| F-07-009 | observation | S | Fine-sort keyboard alternative undiscoverable (no user-visible hint) |
| F-07-010 | major | S | FI locale: full English sentence in `confirm_reset_codes` dialog |

**Total: 3 major, 4 minor, 1 observation** (F-07-008 subsumed; F-07-010 listed as a major subcase of F-07-001 for tracking)

### Cross-references

- F-04-007 (0% test coverage on `FactorArraysView`/`FactorCharacteristicsTable`): the colour-only issue in F-07-006 would be caught by rendering tests if they existed.
- F-04-006 (no e2e for admin analysis): axe-core could be integrated into Playwright e2e to automate WCAG detection on the analysis pages once tests exist.

### Notes on axe-core

Dev server started successfully but axe-core CLI required ChromeDriver 148 while the system has Chrome 146. The WCAG findings above are therefore based entirely on code review. A future automated scan should resolve the driver mismatch (`npx browser-driver-manager install chrome`) and re-run axe on at minimum: `/` (landing), `/study/:slug/rough-sort`, `/study/:slug/fine-sort`, `/admin`.
