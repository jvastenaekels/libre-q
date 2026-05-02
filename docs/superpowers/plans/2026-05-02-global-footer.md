# Global Footer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a global footer ("Powered by Qualis · AGPLv3 · GitHub icon") visible on every page except the two immersive Q-sort screens (`FineSortPage`, `RoughSortPage`).

**Architecture:** One presentational `Footer` component reused via three mount points: `AdminLayout` (admin chrome), `StudyLayout` (participant chrome, with route guard), and a new thin `PublicPageLayout` wrapping all standalone routes. The inline "Powered by Qualis" line currently in `StudyAccessGate.tsx` is deleted (covered by the global footer).

**Tech Stack:** React 19, TypeScript, Tailwind CSS, react-i18next, lucide-react (Github icon), Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-05-02-global-footer-design.md`

---

## File Structure

**Create:**
- `frontend/src/components/Footer.tsx` — pure presentational component (~50 LOC)
- `frontend/src/components/Footer.test.tsx` — Vitest unit tests
- `frontend/src/layouts/PublicPageLayout.tsx` — thin wrapper providing `min-h-screen flex flex-col` + mounting `<Footer />`
- `frontend/src/layouts/PublicPageLayout.test.tsx` — single integration test

**Modify:**
- `frontend/src/layouts/AdminLayout.tsx` — mount `<Footer />` after `<Outlet />` in `SidebarInset`
- `frontend/src/layouts/StudyLayout.tsx` — mount `<Footer />` after the mobile-action footer; route-guard hides it on `/fine-sort` and `/rough-sort`
- `frontend/src/layouts/StudyLayout.test.tsx` — extend with route-guard cases
- `frontend/src/App.tsx` — wrap 12 standalone-page route elements with `<PublicPageLayout>`
- `frontend/src/components/study/StudyAccessGate.tsx` — delete the inline `<p>Powered by Qualis</p>` block (lines 109-113)
- `frontend/src/pages/LandingPage.tsx` — replace `min-h-screen` with `flex-1` on root div
- `frontend/src/pages/LoginPage.tsx` — same
- `frontend/src/pages/RegistrationPage.tsx` — same
- `frontend/src/pages/ResearcherHub.tsx` — same
- `frontend/src/pages/ResumePage.tsx` — same (two occurrences)
- `frontend/public/locales/en/translation.json` — add `footer.*` keys
- `frontend/public/locales/fr/translation.json` — same
- `frontend/public/locales/fi/translation.json` — same

Pages with no `min-h-screen` (no change needed): `EmailVerifyPage`, `EmailVerificationSentPage`, `PasswordResetRequestPage`, `PasswordResetConfirmPage`, `TwoFactorRecoveryPage`, `TwoFactorDisablePage`, `ResetPage`. They use `<main className="mx-auto max-w-md ...">` or `min-h-[60vh]` and behave correctly inside `PublicPageLayout`.

---

## Task 1: Add i18n keys (en/fr/fi)

**Files:**
- Modify: `frontend/public/locales/en/translation.json`
- Modify: `frontend/public/locales/fr/translation.json`
- Modify: `frontend/public/locales/fi/translation.json`

- [ ] **Step 1: Add `footer` namespace block to `en/translation.json`**

Insert at the top level (alphabetically near other top-level keys, e.g. after `"errors"` or wherever fits the file's existing order):

```json
"footer": {
    "powered_by": "Powered by Qualis",
    "license": "AGPLv3",
    "github_aria": "View source on GitHub"
}
```

- [ ] **Step 2: Add the same block to `fr/translation.json`**

```json
"footer": {
    "powered_by": "Propulsé par Qualis",
    "license": "AGPLv3",
    "github_aria": "Voir le code source sur GitHub"
}
```

- [ ] **Step 3: Add the same block to `fi/translation.json`**

```json
"footer": {
    "powered_by": "Qualisin tarjoama",
    "license": "AGPLv3",
    "github_aria": "Katso lähdekoodi GitHubissa"
}
```

- [ ] **Step 4: Verify i18n parity**

Run: `cd frontend && npm run i18n-check`
Expected: PASS — no missing keys across locales.

- [ ] **Step 5: Commit**

```bash
git add frontend/public/locales/en/translation.json frontend/public/locales/fr/translation.json frontend/public/locales/fi/translation.json
git commit -m "i18n(footer): add powered_by, license, github_aria keys"
```

---

## Task 2: Footer component (TDD)

**Files:**
- Create: `frontend/src/components/Footer.tsx`
- Test: `frontend/src/components/Footer.test.tsx`

The repo URL constant `https://github.com/jvastenaekels/qualis` and the LICENSE URL `https://github.com/jvastenaekels/qualis/blob/main/LICENSE` are inlined in the component (not extracted to config — they're stable identifiers, not env-dependent).

- [ ] **Step 1: Write the failing test file**

Create `frontend/src/components/Footer.test.tsx`:

```tsx
/*
 * Qualis - Open-source platform for conducting Q-methodology research
 * Copyright (C) 2025 Julien Vastenekels
 * Licensed under the GNU Affero General Public License v3.0 or later.
 */

import { renderWithProviders, screen } from '@/test-utils/test-utils';
import { describe, expect, it } from 'vitest';

import { Footer } from './Footer';

const REPO_URL = 'https://github.com/jvastenaekels/qualis';
const LICENSE_URL = 'https://github.com/jvastenaekels/qualis/blob/main/LICENSE';

describe('Footer', () => {
    it('renders the "Powered by Qualis" attribution link to the repo', () => {
        renderWithProviders(<Footer />);
        const link = screen.getByRole('link', { name: /Powered by Qualis/i });
        expect(link).toHaveAttribute('href', REPO_URL);
        expect(link).toHaveAttribute('target', '_blank');
        expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('renders the AGPLv3 link to the LICENSE file, hidden on small screens', () => {
        renderWithProviders(<Footer />);
        const link = screen.getByRole('link', { name: 'AGPLv3' });
        expect(link).toHaveAttribute('href', LICENSE_URL);
        expect(link).toHaveAttribute('target', '_blank');
        expect(link).toHaveAttribute('rel', 'noopener noreferrer');
        expect(link.className).toContain('hidden');
        expect(link.className).toContain('sm:inline');
    });

    it('renders the GitHub icon link with aria-label', () => {
        renderWithProviders(<Footer />);
        const link = screen.getByRole('link', { name: /View source on GitHub/i });
        expect(link).toHaveAttribute('href', REPO_URL);
        expect(link).toHaveAttribute('target', '_blank');
        expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('renders the mini Qualis logo as decorative (alt is empty)', () => {
        renderWithProviders(<Footer />);
        const img = screen.getByAltText('');
        expect(img).toHaveAttribute('src', '/qualis-logo.svg');
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/Footer.test.tsx`
Expected: FAIL with "Cannot find module './Footer'" (or similar resolution error).

- [ ] **Step 3: Implement the Footer component**

Create `frontend/src/components/Footer.tsx`:

```tsx
/*
 * Qualis - Open-source platform for conducting Q-methodology research
 * Copyright (C) 2025 Julien Vastenekels
 * Licensed under the GNU Affero General Public License v3.0 or later.
 */

import { Github } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const REPO_URL = 'https://github.com/jvastenaekels/qualis';
const LICENSE_URL = 'https://github.com/jvastenaekels/qualis/blob/main/LICENSE';

export const Footer = () => {
    const { t } = useTranslation();

    return (
        <footer className="border-t border-slate-100 bg-white/70 backdrop-blur">
            <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between text-xs text-slate-400">
                <div className="flex items-center gap-2">
                    <a
                        href={REPO_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 hover:text-slate-600 transition-colors"
                    >
                        <img src="/qualis-logo.svg" alt="" className="h-4 w-4" />
                        <span>{t('footer.powered_by', 'Powered by Qualis')}</span>
                    </a>
                    <span className="hidden sm:inline" aria-hidden="true">
                        ·
                    </span>
                    <a
                        href={LICENSE_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hidden sm:inline hover:text-slate-600 transition-colors"
                    >
                        {t('footer.license', 'AGPLv3')}
                    </a>
                </div>
                <a
                    href={REPO_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={t('footer.github_aria', 'View source on GitHub')}
                    className="hover:text-slate-600 transition-colors"
                >
                    <Github className="h-4 w-4" />
                </a>
            </div>
        </footer>
    );
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/components/Footer.test.tsx`
Expected: PASS — all 4 tests green.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/Footer.tsx frontend/src/components/Footer.test.tsx
git commit -m "feat(footer): Footer component with attribution, license, GitHub link"
```

---

## Task 3: PublicPageLayout wrapper

**Files:**
- Create: `frontend/src/layouts/PublicPageLayout.tsx`
- Test: `frontend/src/layouts/PublicPageLayout.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/layouts/PublicPageLayout.test.tsx`:

```tsx
/*
 * Qualis - Open-source platform for conducting Q-methodology research
 * Copyright (C) 2025 Julien Vastenekels
 * Licensed under the GNU Affero General Public License v3.0 or later.
 */

import { renderWithProviders, screen } from '@/test-utils/test-utils';
import { describe, expect, it } from 'vitest';

import { PublicPageLayout } from './PublicPageLayout';

describe('PublicPageLayout', () => {
    it('renders the children and the global Footer', () => {
        renderWithProviders(
            <PublicPageLayout>
                <div data-testid="page-content">Hello</div>
            </PublicPageLayout>
        );
        expect(screen.getByTestId('page-content')).toBeInTheDocument();
        // Footer signature: the "Powered by Qualis" attribution link
        expect(screen.getByRole('link', { name: /Powered by Qualis/i })).toBeInTheDocument();
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/layouts/PublicPageLayout.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement PublicPageLayout**

Create `frontend/src/layouts/PublicPageLayout.tsx`:

```tsx
/*
 * Qualis - Open-source platform for conducting Q-methodology research
 * Copyright (C) 2025 Julien Vastenekels
 * Licensed under the GNU Affero General Public License v3.0 or later.
 */

import type { ReactNode } from 'react';
import { Footer } from '@/components/Footer';

interface PublicPageLayoutProps {
    children: ReactNode;
}

export const PublicPageLayout = ({ children }: PublicPageLayoutProps) => (
    <div className="min-h-screen flex flex-col">
        <div className="flex-1 flex flex-col">{children}</div>
        <Footer />
    </div>
);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/layouts/PublicPageLayout.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/layouts/PublicPageLayout.tsx frontend/src/layouts/PublicPageLayout.test.tsx
git commit -m "feat(layouts): PublicPageLayout wrapper mounts global Footer"
```

---

## Task 4: Mount Footer in AdminLayout

**Files:**
- Modify: `frontend/src/layouts/AdminLayout.tsx`

- [ ] **Step 1: Add the Footer import**

In `frontend/src/layouts/AdminLayout.tsx`, after the existing `import { cn } from '@/lib/utils';` (line 20), add:

```tsx
import { Footer } from '@/components/Footer';
```

- [ ] **Step 2: Mount Footer after the Outlet wrapper**

Locate the existing block at `AdminLayout.tsx:160-174`:

```tsx
                <div
                    className={cn(
                        'flex flex-1 flex-col transition-all duration-300 min-w-0',
                        !location.pathname.includes('/design')
                            ? 'gap-3 sm:gap-4 p-3 sm:p-4 pt-0'
                            : 'overflow-hidden max-w-full'
                    )}
                >
                    <Outlet
                        context={{
                            project: adminProject,
                            study: adminStudy,
                        }}
                    />
                </div>
```

Add `<Footer />` as a sibling **after** that closing `</div>` (still inside `SidebarInset`):

```tsx
                <div
                    className={cn(
                        'flex flex-1 flex-col transition-all duration-300 min-w-0',
                        !location.pathname.includes('/design')
                            ? 'gap-3 sm:gap-4 p-3 sm:p-4 pt-0'
                            : 'overflow-hidden max-w-full'
                    )}
                >
                    <Outlet
                        context={{
                            project: adminProject,
                            study: adminStudy,
                        }}
                    />
                </div>
                <Footer />
```

- [ ] **Step 3: Manual verification**

Run: `cd frontend && npm run dev`
In a browser, navigate to `/app/<any-project>/dashboard`. Verify the footer appears at the bottom of the content area (not under the sidebar) with text "Powered by Qualis · AGPLv3" on the left and a GitHub icon on the right.

- [ ] **Step 4: Run lint + types**

Run: `make ci-fast`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/layouts/AdminLayout.tsx
git commit -m "feat(footer): mount global Footer in AdminLayout"
```

---

## Task 5: Mount Footer in StudyLayout with route guard

**Files:**
- Modify: `frontend/src/layouts/StudyLayout.tsx`
- Modify: `frontend/src/layouts/StudyLayout.test.tsx`

- [ ] **Step 1: Write the failing test cases**

Open `frontend/src/layouts/StudyLayout.test.tsx`. The file already mocks `react-i18next` so `t(key)` returns the literal key — assertions must use the i18n key (`footer.powered_by`), not the resolved English text.

The file uses two render patterns: bare `renderWithProviders(<StudyLayout />, { initialEntries: ['/study/test/welcome'] })` and `<Routes><Route path="/study/:slug/X" element={<StudyLayout />} /></Routes>`. The `Layout Scroll Behavior` block (lines 141-220) uses the second pattern and is the closest precedent for testing per-route behavior — copy that pattern.

Append a new `describe` block at the end of the file (after the last `describe`):

```tsx
describe('Layout Global Footer', () => {
    beforeEach(() => {
        useConfigStore.setState({
            config: {
                title: 'Test Study',
                slug: 'slug',
                statements: [],
                grid_config: [],
                presort_config: {},
                postsort_config: {},
                available_languages: ['en'],
                require_code: false,
                require_consent: true,
                consent_text: 'Consent',
                // biome-ignore lint/suspicious/noExplicitAny: mock config
            } as any,
            isLoading: false,
            error: null,
        });
        useSessionStore.setState({
            token: null,
            hasConsented: true,
            currentStep: 1,
            maxReachedStep: 1,
            language: 'en',
            isCompleted: false,
            confirmationCode: null,
            isSaving: false,
        });
    });

    it('renders the global Footer on /welcome', () => {
        renderWithProviders(
            <Routes>
                <Route path="/study/:slug/welcome" element={<StudyLayout />} />
            </Routes>,
            { initialEntries: ['/study/slug/welcome'] }
        );
        expect(screen.getByRole('link', { name: 'footer.github_aria' })).toBeInTheDocument();
    });

    it('hides the global Footer on /fine-sort', () => {
        renderWithProviders(
            <Routes>
                <Route path="/study/:slug/fine-sort" element={<StudyLayout />} />
            </Routes>,
            { initialEntries: ['/study/slug/fine-sort'] }
        );
        expect(screen.queryByRole('link', { name: 'footer.github_aria' })).not.toBeInTheDocument();
    });

    it('hides the global Footer on /rough-sort', () => {
        renderWithProviders(
            <Routes>
                <Route path="/study/:slug/rough-sort" element={<StudyLayout />} />
            </Routes>,
            { initialEntries: ['/study/slug/rough-sort'] }
        );
        expect(screen.queryByRole('link', { name: 'footer.github_aria' })).not.toBeInTheDocument();
    });
});
```

The `footer.github_aria` link is queried because it has a unique aria-label even when t() returns keys. The "Powered by Qualis" link's accessible name would be the image alt + the key text `footer.powered_by` — match-able but noisier. The GitHub icon link is the cleanest signature.

- [ ] **Step 2: Run tests to verify the new cases fail**

Run: `cd frontend && npx vitest run src/layouts/StudyLayout.test.tsx`
Expected: the new "renders the global Footer on /welcome" test FAILS (footer not yet mounted); the two "hides" tests PASS by accident (no footer at all). After implementation, all three should PASS.

- [ ] **Step 3: Add the Footer import to StudyLayout.tsx**

Near the top of `frontend/src/layouts/StudyLayout.tsx`, alongside other component imports, add:

```tsx
import { Footer } from '@/components/Footer';
```

- [ ] **Step 4: Mount Footer with route guard**

Inside `StudyLayoutContent`, the structure currently ends with:

```tsx
            </main>

            {/* Mobile Footer (Primary Action) */}
            {showMobileFooter && (
                <div className="md:hidden flex-none bg-white border-t border-slate-200 p-4 sticky bottom-0 z-sticky pb-safe shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                    {headerAction}
                </div>
            )}
        </div>
    );
};
```

(see `StudyLayout.tsx:889-898`).

`useLocation()` is already in scope in `StudyLayoutContent` (it's used to compute `overflow-hidden` on `<main>` at line 865 — confirm by reading the function's body; if not already destructured at the top, add `const location = useLocation();` at the appropriate place near other hooks).

Add the route-guarded `<Footer />` as a new sibling immediately after the mobile-footer block:

```tsx
            </main>

            {/* Mobile Footer (Primary Action) */}
            {showMobileFooter && (
                <div className="md:hidden flex-none bg-white border-t border-slate-200 p-4 sticky bottom-0 z-sticky pb-safe shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                    {headerAction}
                </div>
            )}

            {/* Global attribution footer — hidden on the two immersive Q-sort screens */}
            {!['/fine-sort', '/rough-sort'].some((p) => location.pathname.endsWith(p)) && (
                <Footer />
            )}
        </div>
    );
};
```

- [ ] **Step 5: Run tests to verify they all pass**

Run: `cd frontend && npx vitest run src/layouts/StudyLayout.test.tsx`
Expected: PASS — all three new cases plus all pre-existing cases.

- [ ] **Step 6: Run lint + types**

Run: `make ci-fast`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/layouts/StudyLayout.tsx frontend/src/layouts/StudyLayout.test.tsx
git commit -m "feat(footer): mount global Footer in StudyLayout, hidden on Q-sort screens"
```

---

## Task 6: Wrap standalone routes with PublicPageLayout

**Files:**
- Modify: `frontend/src/App.tsx`

The 12 routes to wrap are listed below with their exact element forms. Wrap each by changing `element: <X />` → `element: <PublicPageLayout><X /></PublicPageLayout>`.

- [ ] **Step 1: Add the PublicPageLayout import**

In `frontend/src/App.tsx`, alongside the other layout imports (around line 44 where `AdminLayout`, `ProjectLayout`, `StudyFocusLayout` are imported), add:

```tsx
import { PublicPageLayout } from './layouts/PublicPageLayout';
```

- [ ] **Step 2: Wrap each standalone route element**

Make these exact replacements in `frontend/src/App.tsx`. Each replacement is a single `element:` value swap.

| Route | Before | After |
|---|---|---|
| `/` | `element: <LandingPage />` | `element: <PublicPageLayout><LandingPage /></PublicPageLayout>` |
| `/login` | `element: <LoginPage />` | `element: <PublicPageLayout><LoginPage /></PublicPageLayout>` |
| `/register` | `element: <RegistrationPage />` | `element: <PublicPageLayout><RegistrationPage /></PublicPageLayout>` |
| `/verify-email` | `element: <EmailVerifyPage />` | `element: <PublicPageLayout><EmailVerifyPage /></PublicPageLayout>` |
| `/verify-email-sent` | `element: <EmailVerificationSentPage />` | `element: <PublicPageLayout><EmailVerificationSentPage /></PublicPageLayout>` |
| `/forgot-password` | `element: <PasswordResetRequestPage />` | `element: <PublicPageLayout><PasswordResetRequestPage /></PublicPageLayout>` |
| `/reset-password` | `element: <PasswordResetConfirmPage />` | `element: <PublicPageLayout><PasswordResetConfirmPage /></PublicPageLayout>` |
| `/2fa/recover` | `element: <TwoFactorRecoveryPage />` | `element: <PublicPageLayout><TwoFactorRecoveryPage /></PublicPageLayout>` |
| `/2fa/disable` | `element: <TwoFactorDisablePage />` | `element: <PublicPageLayout><TwoFactorDisablePage /></PublicPageLayout>` |
| `/study/:slug/resume/:token` | `element: <ResumePage />` | `element: <PublicPageLayout><ResumePage /></PublicPageLayout>` |
| `/study/:slug/reset` | `element: <ResetPage />` | `element: <PublicPageLayout><ResetPage /></PublicPageLayout>` |
| `/hub` (child `index: true`) | `element: <ResearcherHub />` | `element: <PublicPageLayout><ResearcherHub /></PublicPageLayout>` |

For `/hub`, the wrap goes on the **child** `index: true` element, not on the parent `RequireAdmin` element. The relevant block currently looks like:

```tsx
{
    path: '/hub',
    element: <RequireAdmin />,
    children: [
        {
            index: true,
            element: <ResearcherHub />,
        },
    ],
},
```

becomes:

```tsx
{
    path: '/hub',
    element: <RequireAdmin />,
    children: [
        {
            index: true,
            element: (
                <PublicPageLayout>
                    <ResearcherHub />
                </PublicPageLayout>
            ),
        },
    ],
},
```

- [ ] **Step 3: Manual verification — visit each route**

Run: `cd frontend && npm run dev`

Quick browser-tour each of: `/`, `/login`, `/register`, `/forgot-password`, `/reset-password`, `/hub` (after login as admin), `/2fa/recover`. Confirm the footer appears at the bottom of every screen. Note any pages that scroll unexpectedly or where the footer overlaps content — these are signals that the page's own `min-h-screen` is creating a double-flex height (Task 7 fixes those).

- [ ] **Step 4: Run lint + types**

Run: `make ci-fast`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat(footer): wrap standalone routes with PublicPageLayout"
```

---

## Task 7: Replace `min-h-screen` with `flex-1` on five wrapped pages

These pages set `min-h-screen` on their root `<div>`. Inside `PublicPageLayout`, this forces `100vh` for the page alone — pushing the footer below the fold. Replace `min-h-screen` with `flex-1` so the page fills the available height (parent's flex zone) without forcing a full viewport.

**Files:**
- Modify: `frontend/src/pages/LandingPage.tsx`
- Modify: `frontend/src/pages/LoginPage.tsx`
- Modify: `frontend/src/pages/RegistrationPage.tsx`
- Modify: `frontend/src/pages/ResearcherHub.tsx`
- Modify: `frontend/src/pages/ResumePage.tsx`

- [ ] **Step 1: LandingPage**

In `frontend/src/pages/LandingPage.tsx`, change line 26 from:
```tsx
<div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4">
```
to:
```tsx
<div className="flex-1 bg-gray-50 flex flex-col justify-center items-center p-4">
```

- [ ] **Step 2: LoginPage**

In `frontend/src/pages/LoginPage.tsx`, change line 193 from:
```tsx
<div className="min-h-screen w-full flex items-center justify-center bg-[#fafafa] p-4">
```
to:
```tsx
<div className="flex-1 w-full flex items-center justify-center bg-[#fafafa] p-4">
```

- [ ] **Step 3: RegistrationPage**

In `frontend/src/pages/RegistrationPage.tsx`, change line 189 from:
```tsx
<div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-6">
```
to:
```tsx
<div className="flex flex-1 flex-col items-center justify-center bg-slate-50 p-6">
```

- [ ] **Step 4: ResearcherHub**

In `frontend/src/pages/ResearcherHub.tsx`, change line 48 from:
```tsx
<div className="min-h-screen bg-gray-50/50">
```
to:
```tsx
<div className="flex-1 bg-gray-50/50">
```

- [ ] **Step 5: ResumePage (two occurrences)**

In `frontend/src/pages/ResumePage.tsx`, change line 69 from:
```tsx
<div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-8 space-y-6">
```
to:
```tsx
<div className="flex-1 bg-slate-50 flex flex-col items-center justify-center p-8 space-y-6">
```

And change line 95 (second occurrence — same className) the same way:
```tsx
<div className="flex-1 bg-slate-50 flex flex-col items-center justify-center p-8 space-y-6">
```

- [ ] **Step 6: Manual verification**

Run: `cd frontend && npm run dev`. Re-visit `/`, `/login`, `/register`, `/hub`, and `/study/test-slug/resume/abc` (will likely show the error branch — that's fine, both branches have the same className). Confirm:
- No vertical scroll on initial render (footer fits in the viewport).
- Background colour fills the full content area, not just the centered card.
- Footer sits flush at the bottom.

- [ ] **Step 7: Run unit + integration tests**

Run: `make ci-fast`
Expected: PASS — page tests should still find their content; the only change is `min-h-screen` → `flex-1`.

If any page-specific test asserts the className (e.g. snapshot or a `.toContain('min-h-screen')`), update those assertions.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/pages/LandingPage.tsx frontend/src/pages/LoginPage.tsx frontend/src/pages/RegistrationPage.tsx frontend/src/pages/ResearcherHub.tsx frontend/src/pages/ResumePage.tsx
git commit -m "fix(layouts): use flex-1 on PublicPageLayout-wrapped pages so Footer fits"
```

---

## Task 8: Remove inline "Powered by Qualis" from StudyAccessGate

**Files:**
- Modify: `frontend/src/components/study/StudyAccessGate.tsx`

The global Footer (mounted by `StudyLayout` for participant pages) now covers attribution. The inline `<p>Powered by Qualis</p>` becomes redundant.

- [ ] **Step 1: Delete the inline block**

In `frontend/src/components/study/StudyAccessGate.tsx`, delete lines 109-113:

```tsx
            <p className="mt-8 text-slate-400 text-xs font-medium flex items-center gap-2">
                <span className="w-8 h-px bg-slate-200" />
                Powered by Qualis
                <span className="w-8 h-px bg-slate-200" />
            </p>
```

After deletion, the file's render output ends at the closing `</Card>`:

```tsx
            </Card>
        </div>
    );
};
```

- [ ] **Step 2: Manual verification**

Run: `cd frontend && npm run dev`. Open a password-protected study (or temporarily force the gate to render in dev). Confirm:
- The inline "Powered by Qualis" line under the unlock card is gone.
- The global footer appears at the bottom of the viewport (mounted by `StudyLayout`).
- Visual spacing under the card looks reasonable (no empty `mt-8` gap left over).

- [ ] **Step 3: Run lint + types + tests**

Run: `make ci-fast`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/study/StudyAccessGate.tsx
git commit -m "refactor(footer): remove inline attribution from StudyAccessGate (covered by global Footer)"
```

---

## Task 9: Full CI gate

- [ ] **Step 1: Run full make ci**

Run: `make ci`
Expected: PASS — backend lint/types/tests, frontend lint/types/tests, build all green.

- [ ] **Step 2: (Optional) Run admin-flow e2e**

If the admin chrome was visually altered, run a smoke e2e:
Run: `cd frontend && npx playwright test e2e/admin/account-settings.spec.ts`
Expected: PASS.

The Q-sort participant flow does NOT have its admin chrome touched here — the footer is hidden on `/fine-sort` and `/rough-sort` precisely to avoid disturbing it. Skip e2e on the participant flow unless visually verifying.

- [ ] **Step 3: Final commit hygiene check**

Run: `git log --oneline main..HEAD`
Expected: 8 commits, each scoped to one task, with messages following the existing repo convention (`feat(footer):`, `i18n(footer):`, `refactor(footer):`).

If commits look right, the branch is ready to merge or open as a PR.

---

## Out of scope (per spec)

- Configurable per-deployment Terms of Use slot (env var → conditional link)
- Language switcher in the footer
- Dedicated `qualis-mark.svg` icon-only logo variant (revisit if `qualis-logo.svg` at `h-4 w-4` looks too busy during Task 4 manual verification)
- Footer version display
- Footer on `RouteErrorBoundary` (the spec leaves this as a "worth a quick check"; if the boundary's render is reached during Task 9 verification and it looks bare without a footer, wrap it with `PublicPageLayout` as a one-line follow-up)
