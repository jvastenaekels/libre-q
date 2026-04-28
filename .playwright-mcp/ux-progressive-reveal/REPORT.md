# Qualis admin interface — progressive disclosure & cognitive-load audit

**Date:** 2026-04-28
**Method:** Two-pass walkthrough on `localhost:5173` — empty study (`Étude vide pour audit UX`) and seeded study (`Perspectives on remote work`). For each admin page: source-level mapping (page + hook), Playwright snapshot, full-page screenshot, programmatic counts of above-fold and total interactive elements. Persona overlay limited to two extremes — **P1 (Marina, Q-expert)** and **P2 (Tomás, novice)** — to bracket the cognitive-load spectrum.
**Scope:** 13 admin pages plus 4 modal dialogs. Screenshots in `.playwright-mcp/ux-progressive-reveal/`.
**Out of scope:** Participant-facing flows. Items already shipped in PR #46 (responsive header overlap, ISO language picker, eigenvalues 4xx, brand mismatch, methodology mémo, activate-study confirmation, retention policy, CSV import, bilingual edit banner).

Severity: 🔴 blocker · 🟠 confusion · 🟡 friction · 🟢 polish

---

## Headline assessment

Qualis demonstrates **strong intentional disclosure in two patterns**: form dialogs (CreateStudyDialog, Add Item, Bulk Import) are minimal and decision-postponing, and **content-driven sections** (curation progress bar, bulk-action bar, aged-data alerts) only appear when data warrants. Right-rail Vérification on Design and the 5-state lifecycle pills on Overview are best-in-class status surfaces.

**Three cognitive-load problems compound across the admin surface:**

1. **Empty states show full configuration UI for actions impossible on a draft study.** Lifecycle, Data, and Analysis present complete admin chrome on a study with zero participants — zero-filled metric cards, sortable headers over empty rows, anonymisation date pickers above a disabled CTA, factor-extraction dropdowns with rationale paragraphs above a "need 2+ participants" warning. The user's first contact with each tool is a wall of UI controls that **cannot be acted on**.

2. **Section over-stacking on Study Design**: the "Général" tab packs five unrelated concerns (general parameters, study presentation, flow steps, consent form, methodological mémo) into a single scrollable page — 19 above-fold buttons, 52 total, on a tab that already lives inside a 7-tab navigator.

3. **Optional / secondary features given primary visual weight, while the same feature is de-emphasized elsewhere.** The Concourse construction mémo is an always-open card eating ~40 % vertical space above the actual item list — but the Study Design methodology mémo (same conceptual feature, same optionality) sits collapsed-looking at the *bottom* of the Général tab. The bulk-import paste card on Q-tri dominates the section while the per-statement add button is a thin text link. Yellow alerts do four different jobs (ambient guidance / required-action warning / context indicator / hard blocker). Six distinct French labels exist for "save changes" (verified by `grep` on translation files). These are not visual nits — they are coherence failures that force the user to re-learn each page's emphasis rules.

The remaining work — collapse always-open mémos, group the Design toolbar, reconcile dashboard 1-vs-N cards — is small once the three patterns above are addressed.

---

## Quantitative grid

Counts measured at viewport 1440×900 with sidebar expanded. *Above-fold* = visible without scrolling. *Total* = all visible elements on the full page.

| Page | State | Above-fold buttons | Total buttons | Total inputs | Cognitive load |
|---|---|---|---|---|---|
| Dashboard (1 study) | empty | ~10 | ~12 | 0 | LOW |
| Dashboard (2 studies) | empty | 6 | 8 | 0 | LOW |
| Study Overview | empty | 6 | 8 | 1 | LOW |
| Project Settings | empty | 5 | 9 | 2 | LOW |
| Profile | empty | 5 | 8 | 4 | LOW |
| Study Settings | empty | 4 | 7 | 1 | LOW |
| Lifecycle | empty | 3 | 6 | 1 | LOW *(but high-noise zeros, see 🟠4)* |
| Recruitment | empty/populated | 7 | 14 | 4 | MEDIUM |
| Analysis | empty | 7 | 11 | 1 | MEDIUM *(rationale walls, see 🔴3)* |
| Data | empty | 16 | 19 | 1 | HIGH *(filter-chrome over zero rows)* |
| Concourse Detail | populated (4 items) | 12 | 40 | 2 | HIGH |
| Design — Général tab | empty | 19 | 52 | 7 | **VERY HIGH** |
| Design — Général tab | populated | 20 | 56 | 7 | **VERY HIGH** |
| Design — Q-tri tab | empty | 23 | 32 | 1 | HIGH |

Reference threshold (Miller / Krug): a primary-action surface above ~12 simultaneous controls starts producing measurable choice-paralysis. Design tabs sit ~2× over.

---

## Findings — by dimension

### D1 — Initial visible surface (above-fold count)

**Strong:** Dashboard, Overview, Settings (project, study, profile) all stay under 10 above-fold buttons.
**Weak:** Design tabs (Général: 19, Q-tri: 23). Concourse Detail (12). Data (16, mostly empty-table chrome).

### D2 — Smart defaults

**Excellent across the board.** CreateStudyDialog pre-checks current locale (FR), sub-locales optional. Add Item dialog auto-increments code (C4 → C5). Analysis Config defaults to ACP / 3 factors / Varimax / Auto-flagging — all editable but immediately runnable. Study retention defaults to 12 months with currentLocale-aware copy ("Valeurs courantes : 6, 12, 24, 60"). Slug auto-generation from title with dirty-flag override. **Preserve.**

### D3 — Disclosure mechanisms

**Inconsistent.**
- Used well: Tabs on Design + Analysis + Q-tri sub-tabs (Énoncés/Distribution); modals for Add Item / Bulk Import / Tag Manager / Add Language / Confirmations / Create Study; collapsibles on Lifecycle Chronologie + Recruitment "Comment fonctionne l'accès" help.
- **Missing where it matters:** Design "Général" tab stacks 5 sections raw (no collapsibles); Analysis empty state shows full Configuration card (4 dropdowns + 4 rationale paragraphs) instead of a "no data yet" stub; Lifecycle empty state shows full inventory + audio + anonymisation UI; Concourse mémo card always-open even when populated.

### D4 — Visual hierarchy

**Strong.** Primary CTAs blue, danger zones in red with confirmation gates, optional fields explicitly labeled "(Optionnel)", language readiness pills (en — Prêt / fr — En attente) clearly status-colored. Brouillon/Active lifecycle pills make state legible at a glance. **Preserve.**

### D5 — Postponement of decision

**Best-in-class on entry.** CreateStudyDialog says "Vous pourrez configurer les énoncés et les paramètres plus tard." — perfect.
**Worst on Design.** Once inside Design, the user is presented with all 5 sections of the "Général" tab simultaneously: presentation copy + flow steps + consent + mémo. There is no scaffolding equivalent to "configure title now, come back for consent later".

### D6 — Empty-state handling

**The weakest dimension overall.** Three pages fail this test on the freshly-created study:
- **Lifecycle**: 5 zero-filled metric cards + 2 aged-data alerts (both 0) + audio storage (0 MB) + anonymisation date picker + disabled "Anonymiser au 2025-04-28" button. None of this is actionable on a draft study with 0 participants.
- **Data**: 4 zero metric cards + table with sort/filter icons in headers over an empty body + prominent blue "Exporter les données" button (exports zero data).
- **Analysis**: Configuration card with 4 dropdowns and 4 rationale paragraphs visible above a "Need 2+ participants" alert. The user spends cognitive budget reading methodology copy on dropdowns they cannot use yet.

The honest contract is: "When you have at least N participants who have completed the sort, this page will show {inventory | exports | factor analysis}. Configure your study and share the link to start collecting." Then collapse the chrome behind a disclosure or render only after data exists.

### D7 — Modal/dialog discipline

**Strong.** Modals are reserved for: form-with-required-fields (Add Item, Create Study, Import Study), bulk operations (Bulk Import, Tag Manager), and confirmations (Activate, Delete, Bulk Status). No spurious context-switches; no nested dialogs; no modals doing the work of a section. **Preserve.**

### D8 — Cross-page coherence and hierarchy of secondary features

**Weak.** The same conceptual feature (e.g. methodology mémo) is presented with different visual weight in different pages. Six distinct French labels are used for the single conceptual action of "commit the form to the server" (verified across `frontend/public/locales/fr/*.json`). Empty-state messages follow ≥4 different copy patterns. Yellow status colour is overloaded across four semantic roles (guidance / warning / context-indicator / blocker). Right rails appear on some pages and not others without an apparent rule. Status pills (lifecycle / item / language readiness / member role) use unrelated colour systems. None of these is individually critical; together they prevent the user from **transferring learning across pages** — every screen requires re-learning what blue, yellow, "Enregistrer" and the right rail mean *here*.

---

## Hierarchy of secondary features (cross-page coherence)

The user has a fixed cognitive budget. When optional/secondary features are placed with the same visual weight as primary ones, that budget is wasted on disambiguating instead of acting. Below: every place where a clearly-secondary feature has primary placement, and the asymmetries that signal coherence loss.

### H1 — Mémo asymmetry: same feature, opposite placement

| Location | Visual weight | Position |
|---|---|---|
| Concourse Detail — `Mémo de construction` | Large card (~40 % vertical), always-open, dedicated section heading "Contexte méthodologique" wraps it | **Top of page**, above the curation panel and the item list |
| Study Design > Général — `Mémo méthodologique` | Same-size textarea, no section heading inflation | **Bottom** of a 5-section scroll, after consent |

Both fields are optional, both serve the same goal (document methodological choices for replication). Their placement is opposite. **Coherence fix:** treat both as collapsible-with-summary. Closed-by-default once non-empty (with summary like "Mémo méthodologique — 2 paragraphes (Sneegas 2020 cité)"); expanded-by-default when empty (to invite first entry). Same component in both places.

### H2 — Bulk-import vs single-add asymmetry on Q-tri

The "Ajout en masse (copier-coller)" card on Design Q-tri occupies a large content area with 3 radio modes ("Tout remplacer" / "Ajouter à la liste" / "Fusionner par code") and an 8-line textarea — visible by default. The per-statement "Ajouter" button is a thin text link below the Q-set heading. For a researcher with ≤10 statements (the common case for a pilot), single-add is the natural mode; the bulk path dominates the visual hierarchy.

**Fix:** invert the default. Single-add card visible (4 fields like the concourse Add dialog); "Ajout en masse" collapsed under "Coller plusieurs énoncés depuis Excel" disclosure.

### H3 — Aged-data alerts in empty Lifecycle

Two yellow "Anciens de plus d'un / deux ans (non anonymisés): 0" bars occupy vertical space on a study with 0 participants. The alert pattern is reserved (in healthy UX) for **non-zero** risk states. Surfacing zero counts trains the user to ignore yellow alerts overall, eroding the channel's signal value.

**Fix:** render aged-data alerts only when the count is `> 0`. Strengthens 🟠4.

### H4 — "Importer une étude" button equal weight to "Créer une étude"

On the Dashboard, the two buttons sit side-by-side at equal weight in the top-right CTA cluster. Importing a study (re-using a JSON config from a prior study or shared template) is a **lower-frequency** action than creating one. Equal weight implies equal prevalence and forces the user to compare-and-disambiguate on every visit.

**Fix:** primary CTA = "Créer une étude" (filled blue). Secondary = "Importer" (ghost / outline button), or move under a `⋯` overflow menu next to the primary.

### H5 — "Tester l'étude" prominence on Design header

The Design page top toolbar gives "Tester l'étude" the same visual weight as "Enregistré" (save state) and "Activer l'étude" (publication CTA). Test mode is a **diagnostic aside**, not a publication-path action. P5 (Lina, GDPR steward) flagged in the previous audit that "Tester" semantics are unclear (does it record data?). Putting it inline with the publication cluster reinforces ambiguity.

**Fix:** move "Tester l'étude" into a "Preview" cluster near the language toggle (editing context), not the publication cluster.

### H6 — Help collapsible on Recruitment open-by-default for repeat users

The blue collapsible "Comment fonctionne l'accès des participants" is open by default on every visit. For a returning admin who has read it once, it's persistent friction. The pattern should be: open-by-default on first visit, collapsed-by-default on subsequent visits (persist via `localStorage`). Same fix applies to the Q-tri "Equilibre de la grille" guidance card if a user dismisses it.

### H7 — "Contexte méthodologique" heading inflation

On Concourse Detail, the optional Mémo card is wrapped in a labeled section "Contexte méthodologique" with subtitle "Champs de documentation optionnels…". A section-level heading for a single optional field over-promotes the feature. The label is even *redundant* with the card's own heading "Mémo de construction".

**Fix:** drop the wrapping section. The card's own heading is sufficient.

### H8 — Audio-storage section on Lifecycle for studies that never collected audio

The Lifecycle page renders a "Stockage audio" panel (Enregistrements / Taille totale) on every visit. For studies whose Q-sort design has no audio post-sort step, this panel is permanently `0 / 0.00 MB` — pure visual noise.

**Fix:** render only when `study.has_audio_step === true` (or equivalently, when audio storage > 0). Same conditional rendering pattern as bulk-action bar on concourse.

---

## Coherence findings (verified by source/locale grep)

### C1 — Six distinct French labels for "commit form changes"

Grep on `frontend/public/locales/fr/*.json` returns:

| Label | Used by |
|---|---|
| `Enregistrer les modifications` | Project Settings (general), Recruitment (URL), Profile (personal info) |
| `Enregistrer les règles d'accès` | Recruitment (access rules) |
| `Enregistrer le mémo` | Concourse (construction memo) |
| `Enregistrer` | Generic admin save |
| `Enregistrer les notes` | Analysis (factor notes) |
| `Changer le mot de passe` | Profile (password) |

Plus the Design toolbar's per-state buttons: `Save` / `Saved` / `Enregistré` / `Save Changes`. **8 distinct labels for the same conceptual action.**

The variation is well-intentioned (each label clarifies *what* is being saved), but it forces the user to re-parse the button on every form. Standard UX pattern: a single short verb ("Enregistrer" or "Sauvegarder") consistently — section context comes from the section heading, not the button. When the section heading is ambiguous (e.g. two save buttons in one card), the disambiguating label is the right call — but those are the rare case, not the rule.

**Fix:** standardise on `Enregistrer` for all per-section saves. Reserve longer labels for cases where two save buttons appear together (e.g. Recruitment's two cards). Update the i18n keys + propagate to `en` and `fi`.

### C2 — Empty-state copy follows ≥4 patterns

| Pattern | Examples |
|---|---|
| **Title + body + CTA** | "Aucun lien de recrutement / Créez votre premier lien d'accès pour commencer à inviter des participants." |
| **Single sentence + recovery action** | "Aucun élément. Ajoutez votre premier énoncé." · "Aucun concours dans cet espace de travail. Créez-en un d'abord." |
| **Single sentence + filter hint** | "Aucun élément accepté dans ce concours. Décochez « Acceptés uniquement » pour tout voir." |
| **Bare statement** | "Aucune donnée de langue pour l'instant." · "Aucun commentaire." · "Aucune." |

Compounding: some empty states have **icons** (envelope, search), others don't. Some are inside a card with border, others are inline grey text.

**Fix:** standardise an `<EmptyState>` component with three slots: icon (optional), title (required), body (required), CTA (optional). Migrate existing copy to populate the slots; reserve "bare statement" form for inline contexts only (filtered-empty within a populated table).

### C3 — Yellow alert overloaded across 4 semantic roles

Yellow with a lightbulb / shield / warning icon currently signals:

| Role | Example |
|---|---|
| Ambient guidance (always-on pedagogy) | "Configurons l'étude dans les moindres détails" (Design Général header) |
| Soft validation warning | "Equilibre de la grille — Q-set entre 30 et 60 items" (Q-tri) |
| Hard blocker | "Au moins 2 participants complétés sont nécessaires pour l'analyse" (Analysis empty) |
| Context indicator | "Vous éditez la version EN. Utilisez le sélecteur…" (Design with locale mismatch) |
| Hard error | "Capacité de grille incorrecte — Vous avez 0 énoncés mais la grille n'a que 34 emplacements" (Q-tri) |

Five roles, one color. The user can't tell at a glance whether yellow means "tip", "warning", "you can't proceed", or "you're in an unusual mode".

**Fix:** restrict yellow to ambient guidance + soft validation warnings only. Hard blockers and errors should use red (currently used only for danger zones). Context indicators (locale mismatch) should use blue (currently used for the recruitment status banner — a related concept).

### C4 — Sidebar `Tableau de bord` appears at both project level and study level

The sidebar is contextually swapped: when in a project, the top item is "Tableau de bord" (project dashboard). When in a study, the top item is also "Tableau de bord" (study overview). Same label, different scope. The breadcrumb is the only signal of which one you're on.

**Fix:** rename the study-scope item to "Vue d'ensemble" (matches the breadcrumb label that's already used) or "Étude — Vue d'ensemble". Reserve "Tableau de bord" for the project-scope dashboard.

### C5 — Right-rail use is arbitrary across pages

Pages WITH right rail: Study Design (Vérification + Languages), Project Settings (Gérer l'équipe + Matrice des permissions), Profile (2FA card only — others stacked).
Pages WITHOUT right rail: Overview, Recruitment, Data, Lifecycle, Analysis, Settings, Concourse Detail.

There is no apparent rule. Profile is especially incoherent — three independent sections, two on left, one on right.

**Fix:** define a rule. Reasonable rule: right rail = persistent context-of-record (readiness checklist, role matrix). Editing forms always go in the main column. Apply the rule and migrate Profile to a 3-card stack or a 2-column grid.

### C6 — H1 naming inconsistent

Pages where H1 = page name: Overview ("Tableau de bord"), Recruitment ("Accès & Recrutement"), Lifecycle ("Inventaire des données & cycle de vie"), Profile ("Profil et sécurité"), Analysis ("Analyse").
Pages where H1 = first section name: Settings ("Cycle de vie" — but the page is generally Settings).
Pages where H1 = study name: Design ("Étude vide pour audit UX" as H2).

**Fix:** every admin page H1 = page-scope name. Settings page H1 should be "Réglages" or "Paramètres de l'étude".

### C7 — Status-pill design system not unified

Pills used across the admin surface:

| Domain | Pills | Color system |
|---|---|---|
| Study lifecycle | Brouillon / Active / En pause / Fermée | Yellow / green / grey / dark-grey |
| Concourse item status | Proposé / Accepté / Rejeté | Yellow / green / red |
| Language readiness | En attente / Prêt | Orange / green |
| Member role | Owner / Researcher / Observer (in dropdown) | Plain text, no color |

Yellow means "draft" in lifecycle, "proposed" in concourse, but "warning/blocker" in alerts. Green means "active study" + "accepted item" + "ready language" — that's defensible. Member roles get no color treatment at all.

**Fix:** define a small status-pill design system (e.g. `<StatusPill kind={…}>` with documented mapping of state → color). Audit all current usages to align. Keep concourse statuses (which a Q-methodologist already understands) authoritative for color semantics.

---

## Prioritized findings

### 🔴 1. Design "Général" tab combines 5 unrelated concerns

File: `frontend/src/pages/admin/StudyDesignPage.tsx` + tab `IntroductionEditor`.
The "Général" tab renders, in one scrollable column: (a) Paramètres généraux (default language), (b) Présentation de l'étude (title/subtitle/objective), (c) Aperçu du déroulement (intro RTE + 4 step rows), (d) Formulaire de consentement (title + RTE with ~30 lines of legal default), (e) Mémo méthodologique. **52 buttons total, 19 above the fold, 7 inputs, 8 headings.** This is on the *first* tab of a 7-tab navigator that itself implements progressive disclosure — the sub-page undermines the outer pattern. P2 (Tomás): "where do I start?" P1 (Marina): "I want to bulk-edit consent without scrolling past flow steps."

**Fix direction:** Split the tab into 3 sub-cards using `<Accordion>` (Radix) with `defaultOpen={['presentation']}`: only Présentation expanded by default; Aperçu, Consentement, Mémo collapse-by-default with a one-line summary visible. Or split into separate sub-tabs alongside the 7 main tabs (Général now becomes a router for 4 sub-views).

### 🔴 2. Empty-state pages show full configuration UI for actions impossible on a draft study

Three pages — `/lifecycle`, `/data`, `/analysis` — present their fully-instantiated chrome on a draft study with 0 participants. Cognitive load is high (Data: 16 fold buttons; Analysis: 4 dropdowns + 4 rationale paragraphs); actionability is zero (every CTA is either disabled or operates on no data).

**Fix direction:** add an empty-state branch in each hook that renders only:
- a one-paragraph honest contract ("Cette page deviendra utile dès que des participants compléteront le tri.");
- a single CTA pointing to the prerequisite step (`Configurez l'accès → Recrutement` / `Activez l'étude` / `Partagez le lien`);
- a collapsible "Voir les paramètres avancés" for the rare user who wants to pre-configure (e.g. anonymisation cutoff before any data).

### 🔴 3. Analysis page rationale walls in empty state

File: `frontend/src/pages/admin/AnalysisPage.tsx`. Each of {Extraction, Facteurs, Rotation, Marquage} is rendered with a 50-100 word rationale paragraph (good pedagogy when running an analysis) — but on a study with 0 sorts, the user must scroll through 4 walls of theory before seeing the disabled "Lancer l'analyse" button at the bottom. P1 (Marina) finds this overlong; P2 (Tomás) doesn't yet have the context to understand it.

**Fix direction:** when no analysis has been run AND no eligible participants exist, render the empty contract from finding 🔴2. When analysis IS possible, keep Extraction + Facteurs as primary, collapse Rotation + Marquage + Bootstrap behind "Paramètres avancés (Varimax / Auto / pas de bootstrap)" with a one-line current-value summary. Rationale paragraphs become Popover-on-hover next to each field label.

### 🟠 4. Lifecycle page in empty state shows aged-data alerts and anonymisation UI for a study with 0 participants

File: `frontend/src/pages/admin/DataLifecyclePage.tsx`. Two yellow "Anciens de plus d'un / deux ans (non anonymisés): 0" bars are rendered when there is nothing to anonymise. The "Anonymisation en masse" section is fully constructed with a date picker defaulting to today, a candidates count of 0, and a disabled "Anonymiser antérieurs au 2025-04-28" button. P5 (Lina, GDPR steward) reading the previous audit loved this surface — but only on a populated study.

**Fix direction:** in empty state, render a one-line "Aucune donnée participante encore. Cette page activera l'inventaire RGPD dès la première soumission." and gate the anonymisation card behind `if (totalParticipants > 0)`.

### 🟠 5. Construction mémo card on Concourse always-open even when populated

File: `frontend/src/pages/admin/ConcourseDetailPage.tsx` lines 275-340 (per source map). The mémo card eats ~40% of vertical space above the actual item list on every visit. For a researcher iterating on a 30-60 item Q-set, scrolling past their own previously-saved methodology mémo each time is friction. The mémo is pedagogically excellent but its placement is greedy.

**Fix direction:** mémo collapsed-by-default with summary "Mémo méthodologique — 2 paragraphes (Sneegas 2020 cité)" once non-empty; expanded-by-default + persistent when empty (to prompt initial entry). Use `localStorage` to remember per-user preference once expanded.

### 🟠 6. Data page shows sortable table chrome over empty rows

File: `frontend/src/pages/admin/DataExportsPage.tsx`. With 0 participants, the table renders a header row with sort arrows (↑↓) and filter funnels (▽) on Statut / Consentement / Indicateurs / Durée / Soumis columns — none of which can sort or filter anything. The 4 metric cards above are all 0. The blue "Exporter les données" button exports an empty file.

**Fix direction:** when `participants.length === 0`, replace the metric+table block with the empty-state card (already shown lower on the page: "Aucun participant pour l'instant. Partagez le lien…"). Hide the Export button or disable it with tooltip "Aucune donnée à exporter".

### 🟠 7. Design page top-right toolbar packs 6 controls without grouping

Top-right of every Study Design view (visible in `full-02-design-general.png`): `[Brouillon pill] [FR ▾] [Tester l'étude] [Enregistré] [↑] [↓] [Activer l'étude]`. Six independent controls, no visual grouping, no overflow menu. The pill is status not action; the language selector is editing-context not publication; Test/Save are content actions; Import/Export are config-IO; Activate is publication. Five conceptual groups jammed together.

**Fix direction:** group as `[Brouillon · FR ▾]` (context cluster) | `[Tester · Enregistré]` (content cluster) | `[⋯ Importer/Exporter]` (overflow) | `[Activer l'étude]` (primary publication CTA). Saves ~40% header width and clarifies semantics.

### 🟠 8. Step list ("Faisons connaissance / Premières impressions / Votre perspective / Pourquoi") collapsed without preview

The 4 step rows on Design Général show only emoji + name. Names are the *participant-facing* labels, not Q-canonical step types. P2 (Tomás) cannot tell which step is pre-sort vs post-sort vs the Q-sort itself. Each row must be opened to discover its content. P1 (Marina) flagged this in the previous audit.

**Fix direction:** each row shows: emoji + participant label + small grey type badge (Pré-tri / Q-tri / Post-tri) + 1-line preview of first content field (e.g., truncated condition of instruction). Opening the row reveals the full editor.

### 🟡 9. Sidebar item "Réglages" but page H1 is "Cycle de vie"

File: `frontend/src/pages/admin/GeneralSettingsPage.tsx`. The sidebar nav item is labeled "Réglages" (Settings); the page H1 reads "Cycle de vie" because the page leads with the retention/archive/delete sections. Either the sidebar label should become "Cycle de vie & suppression" or the page should have an H1 "Réglages" with "Cycle de vie" as a section H2.

### 🟡 10. Project Settings "Matrice des permissions" lists 2 roles, dropdown offers 3

The right-rail "Matrice des permissions" documents Chercheur (Création) and Observateur (Lecture seule). The members table dropdown lets you set Owner / Researcher / Observer (3 roles). Owner is undocumented in the matrix.

### 🟡 11. Dashboard treats 1 study and 2+ studies with different card layouts

Single-study dashboard (`empty-00-dashboard-1study.png`) renders the study as an expanded card with 4 sub-action buttons (Conception / Accès / Données / Analyse). Two-study dashboard (`empty-10-dashboard-2studies.png`) renders both as compact rows with no sub-action grid. The mental model breaks: at study #2, the user loses the quick-jump menu they had at study #1.

**Fix direction:** pick one — either always show sub-actions on hover/expand of every row, or never show them on the dashboard and route the user through the study Overview page consistently.

### 🟡 12. Recruitment date pickers always visible

File: `frontend/src/pages/admin/RecruitmentPage.tsx`. The "Fenêtre de collecte" section renders `Ouvre le` + `Ferme le` date pickers by default with placeholder `jj/mm/aaaa --:--`. Most studies do not need a time window. Could be collapsed under a toggle "Limiter dans le temps" (off by default).

### 🟡 13. Concourse "Tout sélectionner" + per-row checkboxes always visible

Bulk-select chrome is rendered on every row even when no selection mode is active. Could appear on hover (desktop) or behind a "Sélectionner plusieurs" button (more discoverable than the implicit checkbox column).

### 🟢 14. Profile 2FA in right rail vs main column for other sections

Visual inconsistency: Information personnelle and Mot de passe are in the left main column; 2FA is in a right-rail card. Three independent sections — either all stacked vertically, or all in a 2-column grid, would be more coherent.

### 🟢 15. Study Settings retention field has no min/max constraint

Number input for "Conservation (mois)" accepts any value; helper text suggests 6/12/24/60. Could enforce min=1 max=120 and add a quick-pick row.

### 🟢 16. Bulk-import textarea on Q-tri occupies more space than Add button

Inside Q-tri tab, "Ajout en masse (copier-coller)" gets a large card with 3 radio modes; the per-statement "Ajouter" lives as a small text button below. For a researcher with ≤10 statements (P3 Aïcha's pilot study), single-add is the natural mode; the bulk path is over-promoted.

---

## What works — preserve and replicate

| Pattern | Where | Why it works |
|---|---|---|
| **CreateStudyDialog** | Dashboard → Créer une étude | 3 fields, smart locale default, microcopy "Vous pourrez configurer plus tard" — perfect entry-point postponement |
| **Add Item dialog** | Concourse → Ajouter un élément | 3 fields, code auto-increments (C5 after C4), language pre-filled in heading, "Source (Optionnel)" cue — exactly what a 4-row dialog should look like |
| **Lifecycle pills** | Study Overview | 5-state pill row (Brouillon / Active / En pause / Fermée) with current state highlighted yellow — instant state legibility |
| **Right-rail Vérification** | Study Design | Always-visible readiness checklist (5 items) + per-language status pills (en — Prêt / fr — En attente) — researcher always knows what's missing |
| **Curation progress bar** | Concourse Detail | "Curation 1 / 4 éléments — 2 items encore à examiner" + status pill counts — concourse → Q-set narrowing is visible at a glance |
| **Bulk-action bar** | Concourse Detail | Appears only on selection (line ~609 in source map) — exemplary content-driven disclosure |
| **Aged-data alerts** | Lifecycle (when populated) | "Anciens de plus d'un an (non anonymisés): N" — proactive risk surfacing tied to GDPR Art. 5 |
| **Methodology rationale per param** | Analysis Config (when running) | Each dropdown has a 50-word plain-language rationale acknowledging Q-methodology debates — strong pedagogy |
| **Citations in empty Historique** | Analysis | "Documenter les choix analytiques favorise la reproductibilité (Watts & Stenner 2012 ; Sneegas 2020)" in the empty state — the empty state has citations |
| **Bilingual edit banner** | Study Design (multi-language) | Yellow "Vous éditez la version EN" — solves the previous audit's confusion finding |
| **Recruitment status banner** | /recruitment when draft | Blue "Votre étude est en mode brouillon. Configurez l'URL et préparez les liens — les participants ne pourront pas accéder tant qu'elle n'est pas activée." — honest about state |
| **Per-language readiness** | Study Design right rail | "en — Prêt / fr — En attente" — multilingual completeness explicit |
| **Q-set balance guidance** | Q-tri tab | Yellow card "Q-set équilibré généralement entre 30 et 60 items pour une analyse factorielle robuste" — Q-canonical pedagogy in context |

---

## Persona signals

### P1 (Marina, Q-expert, 40 studies)

**Reactions matching disclosure quality:**
- ✓ Mémo de construction with citations: "they read the literature"
- ✓ Per-param methodology rationale on Analysis: "they acknowledge the debate"
- ✓ Lifecycle aged-data alerts: "GDPR done by people who get it"
- ✓ Empty Historique with Watts & Stenner / Sneegas citations: "the empty state has citations — wow"

**Friction points specific to expert use:**
- ✗ Design "Général" tab forces scrolling past content she doesn't need to edit
- ✗ Analysis rationale paragraphs on every visit (she knows them — would prefer collapsed-with-summary)
- ✗ Construction mémo always-open on populated concourse (she filled it once, doesn't need to re-read it every time)

### P2 (Tomás, novice, first Q study)

**Reactions matching scaffolding quality:**
- ✓ CreateStudyDialog "plus tard" microcopy: "OK I don't have to know everything now"
- ✓ Yellow Q-set balance guidance ("30-60 items"): "thank you, that's the answer I needed"
- ✓ Right-rail Vérification: "always shows me what's left"
- ✓ Recruitment status banner: "ah, that's why participants can't access yet"

**Friction points specific to novice use:**
- ✗ Design Général tab: "where do I start with 5 sections?"
- ✗ Empty Lifecycle / Data / Analysis: "is this broken? everything is zero and disabled"
- ✗ Step names ("Faisons connaissance / Premières impressions / Votre perspective / Pourquoi"): "which one is the actual Q-sort?"
- ✗ Analysis page rationale walls: "this is theory before I have results"

---

## Recommended action plan

### Wave A — empty-state contracts (high leverage / low cost)

**A1.** Render an honest empty state on `/lifecycle`, `/data`, `/analysis` when the study has 0 participants. One-paragraph contract + single next-step CTA + "Voir les paramètres avancés" disclosure. Eliminates 🔴2, 🟠4, 🟠6.
**A2.** Hide the "Exporter les données" CTA on Data when no data exists; or disable with explanatory tooltip.
**A3.** Hide the "Anonymisation en masse" card on Lifecycle until 1+ completed participant exists.

Estimated cost: 1 PR, ~3 hooks touched (`useDataLifecyclePage`, `useDataExportsPage`, `useAnalysisPage`), no new components. Reduces above-fold counts on three pages by ~60%.

### Wave B — Design page progressive split (highest single user-impact)

**B1.** On the "Général" tab, collapse Aperçu du déroulement / Formulaire de consentement / Mémo méthodologique into Accordion sections, default-closed. Only Présentation expanded. Reduces 19 above-fold buttons to ~6. Solves 🔴1.
**B2.** Step rows show 1-line preview + Q-canonical type badge (Pré-tri / Q-tri / Post-tri). Solves 🟠8.
**B3.** Group the 6-control top-right toolbar into 3 clusters with a `⋯` overflow for Import/Export. Solves 🟠7.

Estimated cost: 1 PR, touches `IntroductionEditor`, `StudyPageHeader`, step renderer. New `<Accordion>` wrapper + small badge component. Reduces Design's 52 total buttons to ~32.

### Wave C — Analysis configuration disclosure

**C1.** Promote Extraction + Facteurs to primary-visible; collapse Rotation + Marquage + Bootstrap behind "Paramètres avancés" with current-value summary line. Rationale paragraphs become Popover-on-hover. Solves 🔴3 (when analysis IS possible) — the empty state remains handled by Wave A.

Estimated cost: small PR, touches `useAnalysisPage` + AnalysisConfig component.

### Wave D — small consistency fixes

**D1.** Concourse mémo collapsible by default once non-empty; expanded when empty (🟠5 + H1).
**D2.** Recruitment date pickers behind "Limiter dans le temps" toggle (🟡12).
**D3.** Sidebar label or H1 reconciliation on `/settings` (🟡9 + C6).
**D4.** Project Settings permission matrix to include Owner role (🟡10).
**D5.** Dashboard 1-vs-N consistency: pick one card pattern (🟡11).
**D6.** Profile 2FA layout: align with other sections (🟢14 + C5).
**D7.** Drop "Contexte méthodologique" wrapper section on Concourse (H7).
**D8.** Hide audio-storage panel when study has no audio step (H8).
**D9.** Hide aged-data alerts when count is 0 (H3).

Estimated cost: 1 PR for D1-D9 (small touch-ups).

### Wave E — coherence & secondary-feature hierarchy

The previous waves remove cognitive overhead from individual pages. Wave E removes the *cross-page* re-learning cost.

**E1. Standardise the save-button label.** One label (`Enregistrer`) for all per-section saves; longer disambiguating labels reserved for cards with multiple save buttons. Touches `frontend/public/locales/{en,fr,fi}/admin.json` + a handful of Button copy. Solves C1.

**E2. Build an `<EmptyState>` primitive** (icon optional, title required, body required, CTA optional). Migrate the ≥10 empty-state copies to instances. Solves C2 + standardises the "no data yet" treatment that Wave A relies on.

**E3. Define a color/severity contract for alerts.** Yellow = guidance + soft warning. Red = hard blocker / error. Blue = context indicator + status. Migrate the 5 yellow misuses. Solves C3.

**E4. Rename the study-scope "Tableau de bord" to "Vue d'ensemble"** (matches existing breadcrumb) to disambiguate from the project-scope dashboard. Solves C4.

**E5. Right-rail rule.** Define and document: right rail = persistent context-of-record (readiness checklist, role matrix). Migrate Profile 2FA out of the rail. Solves C5 (subsumes D6).

**E6. Status-pill design system.** Introduce `<StatusPill kind={…}>` with documented state→color mapping. Audit existing usages. Solves C7.

**E7. Bulk-add vs single-add inversion on Q-tri.** Single-add card visible by default; bulk-paste behind disclosure. Solves H2.

**E8. Demote "Importer une étude" to outline / overflow.** Frees CTA real estate for the dominant action. Solves H4.

**E9. Move "Tester l'étude" out of the publication cluster** on Design header into the editing-context cluster. Solves H5 (companion to 🟠7).

**E10. Persistent-dismissed help collapsibles.** Help cards open-by-default once; closed-by-default after user dismissal (per-user `localStorage`). Solves H6.

Estimated cost: Wave E = 1 design-system PR (E1, E2, E3, E6) + 1 navigation PR (E4, E7, E8, E9, E10) + 1 layout PR (E5). Sequence after Waves A–B so the new components are ready when other pages are reorganised.

---

## Conclusions

**The product is fundamentally well-conceived.** Every page reflects a designer who understands Q-methodology: the curation panel maps narrowing-from-concourse-to-Q-set, the analysis page acknowledges PCA-vs-centroid debates with citations, the lifecycle page surfaces RGPD Art. 5 in plain language, the bulk-import "fusionner par code" mode quietly serves multilingual researchers. The previous audit (PR #46) closed the surface-level gaps — terminology, brand, responsive layout, empty-state errors. **None of this is at risk in this audit.**

What this audit surfaces is a **second-order pattern**: the admin interface treats the *populated* study as the canonical state. Every page is designed to look great when there are 30 statements, 50 participants, 3 factors. On that fully-populated state Qualis is excellent. On the *first hour* of a new study — the moment when adoption is decided, when P2 (Tomás) decides whether this tool is for him — the same chrome becomes a wall. Empty Lifecycle / Data / Analysis pages render their full configuration UI for actions that cannot be performed; the Design "Général" tab piles 5 sections on the user's first contact with content authoring; secondary features (mémo cards, bulk-import paste boxes, aged-data alerts on zero counts) are placed with primary visual weight.

The other thread is **coherence**: 6 distinct French labels for "save", ≥4 patterns for empty-state copy, yellow doing 5 different jobs, right rails appearing arbitrarily. None individually breaks the experience; together they prevent the user from *transferring learning across pages*. Each new admin page becomes a re-learning task instead of a recognition task.

**Two PRs would shift the experience materially:**
- **Wave A** (empty-state contracts on Lifecycle/Data/Analysis) — 3 hooks, ~1 day, removes the largest "wall on first contact" pattern.
- **Wave B** (Design Général Accordion split + step preview + toolbar grouping) — 3 components, ~1–2 days, halves the page that is currently the heaviest cognitive load in the entire admin surface.

**Wave E** (coherence + secondary-feature hierarchy) is more diffuse — best done as a design-system PR introducing `<EmptyState>`, `<StatusPill>`, and a documented alert-color contract, then migrating call sites. Higher long-term leverage but lower per-PR visibility.

The patterns to *preserve* are listed in "What works — preserve and replicate". Especially: CreateStudyDialog's postponement microcopy, the right-rail Vérification with per-language pills, citations in empty Historique, aged-data alerts (when populated), per-param methodology rationales (when analysis is possible). These are what make Qualis distinctive; the audit is about removing what fights them.

---

## Files referenced

- Source map agent output (this audit, conversation transcript)
- `frontend/src/pages/admin/StudyDesignPage.tsx` + `frontend/src/hooks/admin/useStudyDesignPage.ts`
- `frontend/src/pages/admin/AnalysisPage.tsx` + `frontend/src/hooks/admin/useAnalysisPage.ts`
- `frontend/src/pages/admin/DataLifecyclePage.tsx`
- `frontend/src/pages/admin/DataExportsPage.tsx`
- `frontend/src/pages/admin/ConcourseDetailPage.tsx` (lines 275-340 mémo, 609 bulk-bar)
- `frontend/src/pages/admin/RecruitmentPage.tsx`
- `frontend/src/pages/admin/GeneralSettingsPage.tsx`
- `frontend/src/pages/admin/ProjectSettingsPage.tsx`
- `frontend/src/pages/admin/ProfilePage.tsx`
- `frontend/src/pages/admin/StudyOverviewPage.tsx`
- `frontend/src/components/admin/AdminDashboard.tsx`
- Screenshots: `.playwright-mcp/ux-progressive-reveal/empty-*.png`, `full-*.png` (20 PNG)
- Previous audit: `.playwright-mcp/ux-audit/REPORT.md` (PR #46) — addressed terminology, responsive, GDPR, brand. This audit complements it on disclosure/load.
