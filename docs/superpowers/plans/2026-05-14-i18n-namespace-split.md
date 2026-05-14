# i18n Namespace Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split `frontend/public/locales/<lang>/translation.json` into `participant.json` + `admin.json` per locale, configure i18next to load both namespaces, and update CI tooling — without touching any of the 1320 `t(…)` call sites or the backend.

**Architecture:** PR #1 introduces a one-shot split script, runs it on the 4 existing locales (en, fr, fi, de), updates `i18n.ts` to use `defaultNS: 'participant'` + `fallbackNS: 'admin'`, and updates `check_i18n.py` + `check_interpolations.py` + test fixtures to address two files instead of one. PR #2 differentiates the parity policy (participant strict / admin best-effort). PR #3 amends the 5-languages plan + runbook to reflect the new layout. Each PR is independently mergeable and passes `make ci` at every commit.

**Tech Stack:** TypeScript (React + i18next v26 + i18next-http-backend), Python 3.13 (CI scripts), JSON locale files, pytest, vitest.

**Reference spec:** `docs/superpowers/specs/2026-05-14-i18n-namespace-split-design.md`.
**Precedent PR (assumed merged before starting):** `feat/i18n-tooling` (PR #157) — adds `frontend/scripts/i18n/check_interpolations.py` and `frontend/scripts/i18n/translation-runbook.md`.

---

## File Map

**New files (PR #1):**
- `frontend/scripts/i18n/split_translations.py` — one-shot script that splits `<lang>/translation.json` into `<lang>/participant.json` + `<lang>/admin.json`. Idempotent.
- `frontend/scripts/i18n/test_split_translations.py` — pytest tests for the split script.
- `frontend/scripts/i18n/namespace_partition.py` — shared partition manifest (single source of truth: which top-level keys go into which namespace). Imported by `split_translations.py`, `check_i18n.py`, `check_interpolations.py`, and the test-fixture loader.
- `frontend/public/locales/<en|fr|fi|de>/participant.json` — 4 new files, ~24 KB each.
- `frontend/public/locales/<en|fr|fi|de>/admin.json` — 4 new files, ~81 KB each.

**Modified files (PR #1):**
- `frontend/src/i18n.ts` — configure `ns: ['participant', 'admin']`, `defaultNS: 'participant'`, `fallbackNS: 'admin'`. Add explanatory comment block.
- `frontend/src/test-utils/i18n-test.ts` — register both namespaces in the test i18next instance.
- `frontend/src/test-utils/i18n-test-resources.ts` — split the bundled resources by namespace, sourced from the partition manifest.
- `frontend/scripts/check_i18n.py` — iterate over `['participant', 'admin']`, comparing per-namespace key sets. Strict on both (policy differentiation is in PR #2).
- `frontend/scripts/i18n/check_interpolations.py` — iterate over both namespaces. Strict on both.

**Deleted files (PR #1):**
- `frontend/public/locales/<en|fr|fi|de>/translation.json` — replaced by the two new files; no longer referenced anywhere after PR #1.

**Modified files (PR #2):**
- `frontend/scripts/check_i18n.py` — add policy table; admin namespace becomes warning-only.
- `frontend/scripts/i18n/check_interpolations.py` — same.
- `frontend/src/constants/locales.test.ts` — `participant.json` mandatory, `admin.json` optional.

**Modified files (PR #3):**
- `docs/superpowers/plans/2026-05-13-add-5-european-languages.md` — bootstrap from `en/participant.json`, admin translation flagged optional.
- `frontend/scripts/i18n/translation-runbook.md` — reference new file layout.

---

## Phase 1 — PR #1: file split + tooling rewiring

The PR branches from `main` (after PR #157 has merged). End state: 4 locales each shipping two JSON files, i18next resolving both, `make ci` green.

### Task 1: Author the namespace partition manifest

The partition (which top-level keys go where) is a contract used by the split script, the CI checkers, and the test fixtures. One source of truth.

**Files:**
- Create: `frontend/scripts/i18n/namespace_partition.py`

- [ ] **Step 1: Create the manifest**

```python
"""Single source of truth for the i18n namespace partition.

Maps top-level translation.json keys to the target namespace file.
Used by:
  - split_translations.py (to slice locale files)
  - check_i18n.py (to iterate over the right key sets per namespace)
  - check_interpolations.py (same)
  - frontend/src/test-utils/i18n-test-resources.ts (re-exported via JSON manifest)
"""

# Top-level key → target namespace.
# Every top-level key in en/translation.json must appear here.
PARTITION: dict[str, str] = {
    # Participant-facing + public + shared chrome
    "common": "participant",
    "layout": "participant",
    "footer": "participant",
    "errors": "participant",
    "landing": "participant",
    "welcome": "participant",
    "consent": "participant",
    "presort": "participant",
    "rough": "participant",
    "fine": "participant",
    "post": "participant",
    "audio": "participant",
    "resume": "participant",
    "erasure": "participant",
    "study": "participant",
    # Researcher-facing
    "admin": "admin",
    "auth": "admin",
}

NAMESPACES: tuple[str, ...] = ("participant", "admin")


def keys_for_namespace(ns: str) -> list[str]:
    """Return the top-level keys assigned to a given namespace."""
    return [k for k, target in PARTITION.items() if target == ns]
```

- [ ] **Step 2: Smoke check it imports**

Run from repo root:
```bash
python3 -c "from frontend.scripts.i18n.namespace_partition import PARTITION, keys_for_namespace; print('participant:', keys_for_namespace('participant')); print('admin:', keys_for_namespace('admin'))"
```

Expected output:
```
participant: ['common', 'layout', 'footer', 'errors', 'landing', 'welcome', 'consent', 'presort', 'rough', 'fine', 'post', 'audio', 'resume', 'erasure', 'study']
admin: ['admin', 'auth']
```

- [ ] **Step 3: Commit**

```bash
git add frontend/scripts/i18n/namespace_partition.py
git commit -m "feat(i18n): add namespace partition manifest"
```

---

### Task 2: Author the split script with tests

**Files:**
- Create: `frontend/scripts/i18n/split_translations.py`
- Create: `frontend/scripts/i18n/test_split_translations.py`

- [ ] **Step 1: Write the failing tests**

Create `frontend/scripts/i18n/test_split_translations.py`:

```python
"""Tests for the locale file splitter."""
import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent))

from split_translations import partition_locale, split_locale_file  # noqa: E402


class TestPartitionLocale:
    def test_splits_known_top_level_keys(self):
        data = {
            "common": {"next": "Next"},
            "welcome": {"start": "Start"},
            "admin": {"dashboard": {"title": "Dashboard"}},
            "auth": {"login": {"email_label": "Email"}},
        }
        participant, admin = partition_locale(data)
        assert participant == {
            "common": {"next": "Next"},
            "welcome": {"start": "Start"},
        }
        assert admin == {
            "admin": {"dashboard": {"title": "Dashboard"}},
            "auth": {"login": {"email_label": "Email"}},
        }

    def test_empty_input_returns_empty_outputs(self):
        participant, admin = partition_locale({})
        assert participant == {}
        assert admin == {}

    def test_only_participant_keys(self):
        data = {"common": {"yes": "Yes"}, "post": {"submit": "Submit"}}
        participant, admin = partition_locale(data)
        assert participant == data
        assert admin == {}

    def test_only_admin_keys(self):
        data = {"admin": {"hub": {"title": "Hub"}}}
        participant, admin = partition_locale(data)
        assert participant == {}
        assert admin == data

    def test_unknown_top_level_key_raises(self):
        data = {"common": {}, "rogue": {"x": "y"}}
        with pytest.raises(ValueError, match="rogue"):
            partition_locale(data)

    def test_preserves_nested_structure(self):
        data = {
            "admin": {
                "studies": {
                    "list": {"empty": "No studies"},
                    "n_one": "{{count}} study",
                    "n_other": "{{count}} studies",
                }
            }
        }
        _, admin = partition_locale(data)
        assert admin == data


class TestSplitLocaleFile:
    def test_writes_both_files_and_deletes_source(self, tmp_path):
        src = tmp_path / "translation.json"
        src.write_text(
            json.dumps(
                {
                    "common": {"yes": "Yes"},
                    "admin": {"hub": {"title": "Hub"}},
                }
            ),
            encoding="utf-8",
        )

        split_locale_file(src, delete_source=True)

        participant_path = tmp_path / "participant.json"
        admin_path = tmp_path / "admin.json"
        assert participant_path.exists()
        assert admin_path.exists()
        assert not src.exists()

        assert json.loads(participant_path.read_text()) == {"common": {"yes": "Yes"}}
        assert json.loads(admin_path.read_text()) == {"admin": {"hub": {"title": "Hub"}}}

    def test_keeps_source_when_delete_source_false(self, tmp_path):
        src = tmp_path / "translation.json"
        src.write_text(json.dumps({"common": {"yes": "Yes"}}), encoding="utf-8")
        split_locale_file(src, delete_source=False)
        assert src.exists()
        assert (tmp_path / "participant.json").exists()

    def test_idempotent_when_run_twice(self, tmp_path):
        src = tmp_path / "translation.json"
        src.write_text(
            json.dumps(
                {"common": {"yes": "Yes"}, "admin": {"hub": {"title": "Hub"}}}
            ),
            encoding="utf-8",
        )
        split_locale_file(src, delete_source=False)
        # Second run: should overwrite cleanly, not append/duplicate.
        split_locale_file(src, delete_source=False)
        assert json.loads((tmp_path / "participant.json").read_text()) == {
            "common": {"yes": "Yes"}
        }
        assert json.loads((tmp_path / "admin.json").read_text()) == {
            "admin": {"hub": {"title": "Hub"}}
        }
```

- [ ] **Step 2: Run tests, verify they fail**

Run from repo root:
```bash
cd frontend/scripts/i18n
/home/julien/tools/qualis/backend/.venv/bin/python -m pytest test_split_translations.py -v
```

Expected: FAIL with `ModuleNotFoundError: No module named 'split_translations'`.

- [ ] **Step 3: Implement the split script**

Create `frontend/scripts/i18n/split_translations.py`:

```python
"""Split <locale>/translation.json into <locale>/participant.json + <locale>/admin.json.

Idempotent: running again overwrites the targets with fresh content.

Usage:
    python3 frontend/scripts/i18n/split_translations.py              # all locales under public/locales
    python3 frontend/scripts/i18n/split_translations.py en fr        # specific locales
    python3 frontend/scripts/i18n/split_translations.py --keep       # don't delete the source translation.json
"""
import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from namespace_partition import PARTITION  # noqa: E402


def partition_locale(data: dict) -> tuple[dict, dict]:
    """Return (participant_data, admin_data) from a translation.json dict.

    Raises ValueError if a top-level key is not in the partition manifest.
    """
    participant: dict = {}
    admin: dict = {}
    for key, value in data.items():
        target = PARTITION.get(key)
        if target is None:
            raise ValueError(
                f"Unknown top-level key {key!r} in translation.json — "
                f"add it to namespace_partition.PARTITION first."
            )
        if target == "participant":
            participant[key] = value
        elif target == "admin":
            admin[key] = value
        else:
            raise ValueError(f"Unknown target namespace {target!r} for key {key!r}.")
    return participant, admin


def split_locale_file(translation_path: Path, *, delete_source: bool) -> None:
    """Split one locale's translation.json. Writes participant.json + admin.json
    in the same directory. Optionally deletes the source.
    """
    with open(translation_path, encoding="utf-8") as f:
        data = json.load(f)
    participant, admin = partition_locale(data)

    participant_path = translation_path.parent / "participant.json"
    admin_path = translation_path.parent / "admin.json"

    with open(participant_path, "w", encoding="utf-8") as f:
        json.dump(participant, f, ensure_ascii=False, indent=4)
        f.write("\n")  # trailing newline to match existing project convention
    with open(admin_path, "w", encoding="utf-8") as f:
        json.dump(admin, f, ensure_ascii=False, indent=4)
        f.write("\n")

    if delete_source:
        translation_path.unlink()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "locales",
        nargs="*",
        help="Locale codes to split (default: all under public/locales).",
    )
    parser.add_argument(
        "--keep",
        action="store_true",
        help="Keep the source translation.json after splitting (default: delete).",
    )
    args = parser.parse_args()

    locales_dir = Path(__file__).resolve().parent.parent.parent / "public" / "locales"
    if not locales_dir.exists():
        print(f"Error: {locales_dir} not found.", file=sys.stderr)
        return 1

    if args.locales:
        targets = args.locales
    else:
        targets = sorted(d.name for d in locales_dir.iterdir() if d.is_dir())

    delete_source = not args.keep
    for code in targets:
        translation_path = locales_dir / code / "translation.json"
        if not translation_path.exists():
            print(f"⚠️  {code}: translation.json not found, skipping")
            continue
        split_locale_file(translation_path, delete_source=delete_source)
        print(f"✓ {code}: split into participant.json + admin.json")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 4: Run tests, verify they pass**

```bash
cd frontend/scripts/i18n
/home/julien/tools/qualis/backend/.venv/bin/python -m pytest test_split_translations.py -v
```

Expected: 9/9 PASS.

- [ ] **Step 5: Smoke-test against a real locale file with --keep**

```bash
cd /home/julien/tools/qualis
python3 frontend/scripts/i18n/split_translations.py en --keep
ls -la frontend/public/locales/en/
```

Expected: `participant.json`, `admin.json`, AND `translation.json` all present in `en/`.

Sanity check sizes:
```bash
wc -c frontend/public/locales/en/participant.json frontend/public/locales/en/admin.json
```

Expected: `participant.json` is ~24 KB, `admin.json` is ~81 KB.

- [ ] **Step 6: Verify split → recombine reproduces the original**

```bash
python3 -c "
import json
orig = json.load(open('frontend/public/locales/en/translation.json'))
participant = json.load(open('frontend/public/locales/en/participant.json'))
admin = json.load(open('frontend/public/locales/en/admin.json'))
recombined = {**participant, **admin}
assert recombined == orig, 'mismatch between original and recombined'
print('OK: split is lossless')
"
```

Expected: `OK: split is lossless`.

- [ ] **Step 7: Clean up smoke-test artefacts**

```bash
rm frontend/public/locales/en/participant.json frontend/public/locales/en/admin.json
```

(We'll regenerate these properly in Task 5.)

- [ ] **Step 8: Commit**

```bash
git add frontend/scripts/i18n/split_translations.py frontend/scripts/i18n/test_split_translations.py
git commit -m "feat(i18n): add split_translations.py with tests"
```

---

### Task 3: Update CI checkers to address two namespaces

Both `check_i18n.py` and `check_interpolations.py` currently read a single `translation.json` per locale. After the split, they must iterate over `participant.json` + `admin.json`. **Both are strict at this stage** — policy differentiation lands in PR #2.

**Files:**
- Modify: `frontend/scripts/check_i18n.py` (full rewrite)
- Modify: `frontend/scripts/i18n/check_interpolations.py` (minimal change to iterate over namespaces)

- [ ] **Step 1: Rewrite `check_i18n.py`**

Open `frontend/scripts/check_i18n.py` and replace its contents with:

```python
"""Verify that each non-en locale has the same key set as en, per namespace.

After the namespace split (PR i18n-namespace-split #1), each locale ships
two files: participant.json and admin.json. Both must match the en key set
exactly. Policy differentiation (admin best-effort) lands in PR #2.
"""
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "i18n"))

from i18n_utils import get_keys
from namespace_partition import NAMESPACES


def load(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def check_namespace(locales_dir, namespace, languages):
    master_file = os.path.join(locales_dir, "en", f"{namespace}.json")
    if not os.path.exists(master_file):
        print(f"❌ Missing master file: {master_file}")
        return False

    master_keys = get_keys(load(master_file))
    ok = True

    for lang in languages:
        target_file = os.path.join(locales_dir, lang, f"{namespace}.json")
        if not os.path.exists(target_file):
            print(f"❌ {lang}/{namespace}.json missing")
            ok = False
            continue

        target_keys = get_keys(load(target_file))
        missing = master_keys - target_keys
        extra = target_keys - master_keys

        if not missing and not extra:
            print(f"  ✓ {lang}/{namespace}.json in sync")
        else:
            ok = False
            if missing:
                print(f"  ❌ {lang}/{namespace}.json missing keys: {sorted(missing)}")
            if extra:
                print(f"  ⚠️  {lang}/{namespace}.json extra keys: {sorted(extra)}")
    return ok


def check_i18n():
    locales_dir = os.path.join(os.path.dirname(__file__), "../public/locales")
    languages = sorted(
        d
        for d in os.listdir(locales_dir)
        if os.path.isdir(os.path.join(locales_dir, d)) and d != "en"
    )

    overall = True
    for namespace in NAMESPACES:
        print(f"\nChecking namespace: {namespace}")
        if not check_namespace(locales_dir, namespace, languages):
            overall = False

    if not overall:
        print("\nFAIL: at least one locale is out of sync.")
        sys.exit(1)
    print("\nAll localization files are in sync with en!")


if __name__ == "__main__":
    check_i18n()
```

- [ ] **Step 2: Update `check_interpolations.py` to iterate over namespaces**

Edit `frontend/scripts/i18n/check_interpolations.py`. Replace its `main()` function with the version below (only `main()` changes — `extract_placeholders`, `walk`, and `check_locale` are unchanged):

```python
def main() -> int:
    from namespace_partition import NAMESPACES  # local import to avoid cycles

    locales_dir = Path(__file__).resolve().parent.parent.parent / "public" / "locales"

    if len(sys.argv) > 1:
        targets = sys.argv[1:]
    else:
        targets = sorted(
            d.name
            for d in locales_dir.iterdir()
            if d.is_dir() and d.name != "en"
        )

    overall_ok = True
    for namespace in NAMESPACES:
        en_path = locales_dir / "en" / f"{namespace}.json"
        if not en_path.exists():
            print(f"Error: {en_path} not found.", file=sys.stderr)
            return 1
        with open(en_path, encoding="utf-8") as f:
            en_data = json.load(f)

        print(f"\nChecking namespace: {namespace}")
        for code in targets:
            target_path = locales_dir / code / f"{namespace}.json"
            if not target_path.exists():
                print(f"⚠️  {code}/{namespace}.json not found")
                overall_ok = False
                continue
            with open(target_path, encoding="utf-8") as f:
                target_data = json.load(f)
            errors = check_locale(en_data, target_data)
            if errors:
                overall_ok = False
                print(f"❌ {code}/{namespace}.json: {len(errors)} interpolation mismatch(es)")
                for e in errors:
                    print(f"   {e['key']}: expected {e['expected']}, got {e['found']}")
            else:
                print(f"✓ {code}/{namespace}.json: interpolations OK")
    return 0 if overall_ok else 1
```

- [ ] **Step 3: Update the validator's tests to match the new main flow**

Open `frontend/scripts/i18n/test_check_interpolations.py`. The existing pure-function tests (`TestExtractPlaceholders`, `TestWalk`, `TestCheckLocale`) keep working — they test the helpers, not `main()`. No changes needed.

Verify by running:
```bash
cd frontend/scripts/i18n
/home/julien/tools/qualis/backend/.venv/bin/python -m pytest test_check_interpolations.py -v
```

Expected: 16/16 PASS.

- [ ] **Step 4: Do not commit yet**

The scripts now expect `participant.json` + `admin.json`, but those files don't exist yet. Running `make check` would fail. Commit happens together with Task 5.

---

### Task 4: Update i18n loader and test fixtures

**Files:**
- Modify: `frontend/src/i18n.ts`
- Modify: `frontend/src/test-utils/i18n-test.ts`
- Modify: `frontend/src/test-utils/i18n-test-resources.ts`

- [ ] **Step 1: Update `i18n.ts`**

Open `frontend/src/i18n.ts` and replace the `.init({...})` block with:

```ts
    .init({
        // Namespaces: 'participant' carries the participant flow + public chrome
        // (common, layout, footer, errors, landing, welcome, consent, presort,
        // rough, fine, post, audio, resume, erasure, study); 'admin' carries
        // researcher-facing copy (admin.*, auth.*).
        //
        // Resolution: t('common.next') resolves in defaultNS 'participant'.
        // t('admin.dashboard.title') misses in 'participant' and falls back to
        // 'admin' via fallbackNS. The admin.json file keeps the 'admin.' and
        // 'auth.' top-level prefixes inside it, so the full path resolves
        // without renaming any of the 1320 t(...) call sites in the codebase.
        ns: ['participant', 'admin'],
        defaultNS: 'participant',
        fallbackNS: 'admin',
        fallbackLng: 'en',
        supportedLngs: SUPPORTED_I18N_LANGUAGES,
        debug: false,

        interpolation: {
            escapeValue: false, // not needed for react as it escapes by default
        },

        backend: {
            loadPath: '/locales/{{lng}}/{{ns}}.json?v=20260514_v1',
        },

        detection: {
            order: ['querystring', 'navigator', 'htmlTag', 'path', 'subdomain'],
            lookupQuerystring: 'lang',
            caches: ['localStorage'],
        },
    });
```

The only functional changes vs current state: `ns`, `defaultNS`, `fallbackNS`, and bumped cache key in `loadPath`.

- [ ] **Step 2: Inspect current test fixture wiring**

```bash
cat frontend/src/test-utils/i18n-test.ts frontend/src/test-utils/i18n-test-resources.ts
```

Note how the current code registers translations. Look for any `resources: { en: { translation: ... } }`-shaped config — that's what needs splitting.

- [ ] **Step 3: Update `i18n-test-resources.ts`**

The current file likely imports `en/translation.json`. Change it to import both `en/participant.json` and `en/admin.json`, and export a resources map keyed by namespace.

Replace the file contents with:

```ts
/*
 * Test-only i18n resource bundle. Real app loads via i18next-http-backend;
 * tests load synchronously from imported JSON.
 *
 * After the namespace split, each locale ships two files. Keep both registered
 * here so unit tests can resolve any key the app code uses.
 */

import enParticipant from '../../public/locales/en/participant.json';
import enAdmin from '../../public/locales/en/admin.json';

export const testI18nResources = {
    en: {
        participant: enParticipant,
        admin: enAdmin,
    },
};
```

If the current file also bundles fr/fi/de fixtures, mirror them the same way (one block per locale, two namespaces each). Most likely only `en` is bundled for tests — if so, the snippet above is complete.

- [ ] **Step 4: Update `i18n-test.ts`**

Open `frontend/src/test-utils/i18n-test.ts` and update its i18next init call to register both namespaces. Locate the `.init({...})` block and change the relevant fields to:

```ts
        ns: ['participant', 'admin'],
        defaultNS: 'participant',
        fallbackNS: 'admin',
        resources: testI18nResources,
```

Keep everything else (lng, fallbackLng, interpolation config) unchanged.

- [ ] **Step 5: Do not commit yet**

JSON files for `participant.json` and `admin.json` don't exist yet, so the TypeScript imports in Step 3 would fail to compile right now. Commit happens together with Task 5.

---

### Task 5: Run the split and commit the atomic transition

This is the commit that flips the layout. Everything from Tasks 3 and 4 lands here together along with the freshly generated locale files.

- [ ] **Step 1: Run the split on all 4 existing locales**

```bash
cd /home/julien/tools/qualis
python3 frontend/scripts/i18n/split_translations.py
```

Expected output:
```
✓ de: split into participant.json + admin.json
✓ en: split into participant.json + admin.json
✓ fi: split into participant.json + admin.json
✓ fr: split into participant.json + admin.json
```

The old `translation.json` files are deleted by the script (default behaviour).

- [ ] **Step 2: Confirm file layout**

```bash
ls frontend/public/locales/en/ frontend/public/locales/fr/ frontend/public/locales/fi/ frontend/public/locales/de/
```

Each directory should contain exactly two files: `participant.json` and `admin.json`. No `translation.json`.

- [ ] **Step 3: Run the rewritten i18n checks**

```bash
cd frontend && npm run i18n-check
cd frontend && npm run check-interpolations
```

Expected: both report each locale's `participant.json` and `admin.json` as in sync, exit 0.

- [ ] **Step 4: Run frontend type-check and unit tests**

```bash
cd frontend && npm run type-check
cd frontend && npm run test -- --run
```

Expected: type-check passes (the new JSON imports in `i18n-test-resources.ts` resolve). Unit tests pass.

- [ ] **Step 5: Manual smoke test in dev server**

```bash
cd frontend && npm run dev
```

Open `http://localhost:5173/`. For each of the 4 languages (use `?lang=en|fr|fi|de`):
- Visit the landing page → no English fallback strings in non-English locales.
- Visit `/<some-study-slug>` (any test study) → participant welcome flow renders fully in the chosen language.
- Visit `/app/dashboard` → admin sidebar, dashboard cards render fully in the chosen language.

If any string falls back to English visibly, inspect the browser console for i18next warnings (missing key reports) and trace it: either a key landed in the wrong namespace (fix `namespace_partition.PARTITION`, re-run split) or `defaultNS`/`fallbackNS` is misconfigured.

Stop the dev server.

- [ ] **Step 6: Run full local CI**

```bash
make ci
```

Must pass.

- [ ] **Step 7: Commit everything atomically**

```bash
git add frontend/src/i18n.ts \
        frontend/src/test-utils/i18n-test.ts \
        frontend/src/test-utils/i18n-test-resources.ts \
        frontend/scripts/check_i18n.py \
        frontend/scripts/i18n/check_interpolations.py \
        frontend/public/locales/
git status  # confirm no other files staged; old translation.json files should appear as deleted
git commit -m "feat(i18n): split locales into participant + admin namespaces

- Split <lang>/translation.json into <lang>/participant.json (~24 KB,
  participant + public chrome) and <lang>/admin.json (~81 KB, admin + auth).
- Configure i18next with defaultNS='participant' and fallbackNS='admin' so
  every existing t('admin.*') and t('common.*') call site resolves
  unchanged. Backend continues to emit fully-qualified keys.
- Rewrite check_i18n.py to verify parity per namespace. Update
  check_interpolations.py likewise. Both remain strict at this stage;
  policy differentiation is in the next PR.
- Update test-utils fixture loader to register both namespaces.
- 4 locales (en, fr, fi, de) shipped; no behaviour change to participants
  or researchers.

Per design doc 2026-05-14-i18n-namespace-split-design.md.
"
```

- [ ] **Step 8: Push and open PR**

```bash
git push -u origin HEAD
gh pr create --title "refactor(i18n): split locales into participant + admin namespaces" --body "$(cat <<'EOF'
## Summary
- Splits the monolithic `translation.json` (~100 KB, 17 top-level namespaces) into `participant.json` (~24 KB, 15 namespaces — common, layout, footer, errors, landing, welcome, consent, presort, rough, fine, post, audio, resume, erasure, study) and `admin.json` (~81 KB, 2 namespaces — admin, auth).
- Configures i18next with `defaultNS: 'participant'` + `fallbackNS: 'admin'` so every existing `t(...)` call site resolves unchanged. **Zero call-site renames. Backend unchanged.**
- Rewrites `check_i18n.py` and `check_interpolations.py` to iterate per namespace. Both stay strict here; policy differentiation (admin best-effort) is the follow-up PR.
- Single source of truth for the partition: `frontend/scripts/i18n/namespace_partition.py`.

## Why
The current monolith makes adding a new locale cost ~100 KB of translation, of which 75% is researcher-facing admin chrome. The split decouples participant translation (high-value, native-review-worthy) from admin translation (low-priority, English-fallback-acceptable). See `docs/superpowers/specs/2026-05-14-i18n-namespace-split-design.md`.

## Test plan
- [x] `make ci` passes locally
- [x] `split_translations.py` tests: 9/9 pass
- [x] `check_interpolations.py` tests: 16/16 pass
- [x] Visual smoke: en, fr, fi, de — participant flow + admin dashboard, no English fallback in non-EN locales
- [ ] Reviewer confirms backend emitter (`_format_import_warning`) still resolves correctly in admin warnings UI

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Phase 2 — PR #2: differentiated parity policy

After PR #1 lands, both namespaces are strict. PR #2 makes `admin` best-effort so future locales can ship with `participant.json` only.

### Task 6: Add the parity policy table

**Files:**
- Modify: `frontend/scripts/check_i18n.py`
- Modify: `frontend/scripts/i18n/check_interpolations.py`

- [ ] **Step 1: Branch**

```bash
git checkout main && git pull --rebase origin main && git checkout -b refactor/i18n-best-effort-admin
```

- [ ] **Step 2: Update `check_i18n.py` with policy**

Open `frontend/scripts/check_i18n.py`. Find the top of the file (after the imports) and add:

```python
# Per-namespace parity policy.
# strict=True  : mismatched keys → CI error (exit 1).
# strict=False : mismatched keys → warning, CI passes.
# required=True: target file must exist for every declared language.
NAMESPACE_POLICY: dict[str, dict[str, bool]] = {
    "participant": {"required": True, "strict": True},
    "admin":       {"required": False, "strict": False},
}
```

Then replace `check_namespace()` with a policy-aware version:

```python
def check_namespace(locales_dir, namespace, languages):
    policy = NAMESPACE_POLICY[namespace]
    master_file = os.path.join(locales_dir, "en", f"{namespace}.json")
    if not os.path.exists(master_file):
        print(f"❌ Missing master file: {master_file}")
        return False

    master_keys = get_keys(load(master_file))
    ok = True

    for lang in languages:
        target_file = os.path.join(locales_dir, lang, f"{namespace}.json")
        if not os.path.exists(target_file):
            if policy["required"]:
                print(f"❌ {lang}/{namespace}.json missing (required)")
                ok = False
            else:
                print(f"⚠️  {lang}/{namespace}.json missing (best-effort, EN fallback)")
            continue

        target_keys = get_keys(load(target_file))
        missing = master_keys - target_keys
        extra = target_keys - master_keys

        if not missing and not extra:
            print(f"  ✓ {lang}/{namespace}.json in sync")
        else:
            severity = "❌" if policy["strict"] else "⚠️ "
            if missing:
                print(f"  {severity} {lang}/{namespace}.json missing keys: {sorted(missing)}")
            if extra:
                print(f"  {severity} {lang}/{namespace}.json extra keys: {sorted(extra)}")
            if policy["strict"]:
                ok = False
    return ok
```

- [ ] **Step 3: Apply the same policy to `check_interpolations.py`**

Open `frontend/scripts/i18n/check_interpolations.py`. Add a policy table at module level:

```python
NAMESPACE_POLICY: dict[str, dict[str, bool]] = {
    "participant": {"required": True, "strict": True},
    "admin":       {"required": False, "strict": False},
}
```

Then modify the `main()` body. Where it currently handles a missing target file:

```python
            if not target_path.exists():
                print(f"⚠️  {code}/{namespace}.json not found")
                overall_ok = False
                continue
```

Replace with:

```python
            policy = NAMESPACE_POLICY[namespace]
            if not target_path.exists():
                if policy["required"]:
                    print(f"❌ {code}/{namespace}.json not found (required)")
                    overall_ok = False
                else:
                    print(f"⚠️  {code}/{namespace}.json not found (best-effort)")
                continue
```

And where it handles interpolation mismatches:

```python
            if errors:
                overall_ok = False
                print(f"❌ {code}/{namespace}.json: ...")
                ...
```

Replace with:

```python
            if errors:
                severity = "❌" if policy["strict"] else "⚠️ "
                if policy["strict"]:
                    overall_ok = False
                print(f"{severity} {code}/{namespace}.json: {len(errors)} interpolation mismatch(es)")
                for e in errors:
                    print(f"   {e['key']}: expected {e['expected']}, got {e['found']}")
```

- [ ] **Step 4: Run both checks against current state — must still pass**

```bash
cd /home/julien/tools/qualis
make check
```

Expected: green. Nothing has changed in the locale files; we've only made the checkers more lenient.

- [ ] **Step 5: Commit**

```bash
git add frontend/scripts/check_i18n.py frontend/scripts/i18n/check_interpolations.py
git commit -m "feat(i18n): differentiate parity policy (participant strict, admin best-effort)"
```

---

### Task 7: Make `locales.test.ts` admin-optional

**Files:**
- Modify: `frontend/src/constants/locales.test.ts`

- [ ] **Step 1: Read the current test**

```bash
cat frontend/src/constants/locales.test.ts
```

The test currently checks that `translation.json` exists per declared language. After PR #1, that file is gone. The test needs updating to check `participant.json` (mandatory) and `admin.json` (optional, presence-only warning).

- [ ] **Step 2: Update the test**

Replace the file contents with:

```ts
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { SUPPORTED_LANGUAGES } from './languages';

const thisDir = path.dirname(fileURLToPath(import.meta.url));
const localesDir = path.resolve(thisDir, '../../public/locales');

describe('locale resources', () => {
    it('has a participant.json for each supported language (mandatory)', () => {
        const missing = SUPPORTED_LANGUAGES.filter(
            ({ code }) => !fs.existsSync(path.join(localesDir, code, 'participant.json'))
        ).map(({ code }) => code);

        expect(missing).toEqual([]);
    });

    it('admin.json is optional but, if present, must be a valid JSON file', () => {
        for (const { code } of SUPPORTED_LANGUAGES) {
            const adminPath = path.join(localesDir, code, 'admin.json');
            if (!fs.existsSync(adminPath)) {
                continue; // best-effort: locale may legitimately skip admin
            }
            // If it exists, it must parse.
            expect(() => JSON.parse(fs.readFileSync(adminPath, 'utf-8'))).not.toThrow();
        }
    });
});
```

- [ ] **Step 3: Run the test**

```bash
cd frontend && npm run test -- --run src/constants/locales.test.ts
```

Expected: PASS (all 4 locales have both files at this point).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/constants/locales.test.ts
git commit -m "test(i18n): allow admin.json to be optional per locale"
```

---

### Task 8: Add a regression test for the policy

Prove the policy actually works: removing a participant key must fail; removing an admin key must warn. To run the script against a fixture tree, first refactor it to accept an optional path argument.

**Files:**
- Modify: `frontend/scripts/check_i18n.py` (small refactor for testability)
- Create: `frontend/scripts/i18n/test_check_i18n_policy.py`

- [ ] **Step 1: Refactor `check_i18n.py` to accept an optional path argument**

Open `frontend/scripts/check_i18n.py`. Change the `check_i18n()` function signature and body:

```python
def check_i18n(locales_dir: str | None = None) -> int:
    if locales_dir is None:
        locales_dir = os.path.join(os.path.dirname(__file__), "../public/locales")
    languages = sorted(
        d
        for d in os.listdir(locales_dir)
        if os.path.isdir(os.path.join(locales_dir, d)) and d != "en"
    )

    overall = True
    for namespace in NAMESPACES:
        print(f"\nChecking namespace: {namespace}")
        if not check_namespace(locales_dir, namespace, languages):
            overall = False

    if not overall:
        print("\nFAIL: at least one locale is out of sync.")
        return 1
    print("\nAll localization files are in sync with en!")
    return 0


if __name__ == "__main__":
    import sys
    arg_dir = sys.argv[1] if len(sys.argv) > 1 else None
    sys.exit(check_i18n(arg_dir))
```

Verify it still works with no arguments:

```bash
cd /home/julien/tools/qualis && python3 frontend/scripts/check_i18n.py
```

Expected: same output as before, exit 0.

- [ ] **Step 2: Write the regression test**

Create `frontend/scripts/i18n/test_check_i18n_policy.py`:

```python
"""End-to-end policy test: participant strict, admin best-effort.

Copies the real locales tree to tmpdir, mutates it to simulate failure
modes, and runs check_i18n() programmatically (no subprocess).
"""
import json
import shutil
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent.parent.parent
sys.path.insert(0, str(REPO_ROOT / "frontend" / "scripts"))
sys.path.insert(0, str(REPO_ROOT / "frontend" / "scripts" / "i18n"))

import check_i18n  # noqa: E402

SRC_LOCALES = REPO_ROOT / "frontend" / "public" / "locales"


@pytest.fixture
def locales_copy(tmp_path):
    dst = tmp_path / "locales"
    shutil.copytree(SRC_LOCALES, dst)
    return dst


def remove_key_from(json_path: Path, dotted_key: str) -> None:
    data = json.loads(json_path.read_text(encoding="utf-8"))
    parts = dotted_key.split(".")
    node = data
    for p in parts[:-1]:
        node = node[p]
    del node[parts[-1]]
    json_path.write_text(json.dumps(data, ensure_ascii=False, indent=4), encoding="utf-8")


def test_baseline_passes(locales_copy):
    """Untouched locale tree should pass."""
    rc = check_i18n.check_i18n(str(locales_copy))
    assert rc == 0


def test_missing_admin_key_warns_but_passes(locales_copy, capsys):
    """Removing an admin key in fr should produce a warning, exit 0."""
    remove_key_from(locales_copy / "fr" / "admin.json", "admin.hub.title")
    rc = check_i18n.check_i18n(str(locales_copy))
    captured = capsys.readouterr()
    assert rc == 0
    assert "⚠️" in captured.out
    assert "admin.hub.title" in captured.out


def test_missing_participant_key_fails(locales_copy, capsys):
    """Removing a participant key in fr should fail (exit 1)."""
    remove_key_from(locales_copy / "fr" / "participant.json", "common.next")
    rc = check_i18n.check_i18n(str(locales_copy))
    captured = capsys.readouterr()
    assert rc == 1
    assert "❌" in captured.out
    assert "common.next" in captured.out


def test_missing_admin_file_warns_but_passes(locales_copy, capsys):
    """Deleting fr/admin.json entirely should warn but pass."""
    (locales_copy / "fr" / "admin.json").unlink()
    rc = check_i18n.check_i18n(str(locales_copy))
    captured = capsys.readouterr()
    assert rc == 0
    assert "⚠️" in captured.out
    assert "missing (best-effort" in captured.out


def test_missing_participant_file_fails(locales_copy, capsys):
    """Deleting fr/participant.json should fail."""
    (locales_copy / "fr" / "participant.json").unlink()
    rc = check_i18n.check_i18n(str(locales_copy))
    captured = capsys.readouterr()
    assert rc == 1
    assert "❌" in captured.out
    assert "missing (required)" in captured.out
```

- [ ] **Step 3: Run the regression tests**

```bash
cd /home/julien/tools/qualis
/home/julien/tools/qualis/backend/.venv/bin/python -m pytest frontend/scripts/i18n/test_check_i18n_policy.py -v
```

Expected: 5/5 PASS.

- [ ] **Step 4: Run all i18n tests together**

```bash
cd frontend/scripts/i18n
/home/julien/tools/qualis/backend/.venv/bin/python -m pytest -v
```

Expected: all green (split tests 9, interpolation tests 16, policy tests 5 = 30 total).

- [ ] **Step 5: Run `make ci`**

```bash
cd /home/julien/tools/qualis
make ci
```

Must pass.

- [ ] **Step 6: Commit**

```bash
git add frontend/scripts/check_i18n.py frontend/scripts/i18n/test_check_i18n_policy.py
git commit -m "test(i18n): regression test for differentiated parity policy"
```

- [ ] **Step 7: Push and open PR**

```bash
git push -u origin HEAD
gh pr create --title "feat(i18n): differentiated parity policy (admin best-effort)" --body "$(cat <<'EOF'
## Summary
- Adds a per-namespace parity policy table: `participant` strict (mismatches fail CI), `admin` best-effort (mismatches warn, CI still passes).
- A locale can now legitimately ship with `participant.json` only — `admin.json` is allowed to be missing or partial, with runtime fallback to `en/admin.json` via i18next's existing `fallbackLng`.
- Refactors `check_i18n.py` to accept an optional locales path (enables end-to-end tests).
- Updates `locales.test.ts` to mirror the policy (participant.json mandatory per declared language, admin.json optional).
- Adds 5 end-to-end regression tests proving each branch of the policy fires correctly.

## Why
Unblocks shipping participant-only locales for the 5-European-languages plan: a new locale costs ~24 KB of translation (participant), with admin translation as an optional follow-up.

## Test plan
- [x] `make ci` passes locally
- [x] Policy regression tests: 5/5 pass
- [x] All i18n tests: 30/30 pass
- [ ] Reviewer confirms warning output is readable in CI logs

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Phase 3 — PR #3: documentation alignment

### Task 9: Update the 5-languages plan to reflect the new layout

**Files:**
- Modify: `docs/superpowers/plans/2026-05-13-add-5-european-languages.md`

- [ ] **Step 1: Branch**

```bash
git checkout main && git pull --rebase origin main && git checkout -b docs/i18n-plan-after-split
```

- [ ] **Step 2: Read the existing plan**

```bash
cat docs/superpowers/plans/2026-05-13-add-5-european-languages.md
```

- [ ] **Step 3: Apply targeted edits**

Open the file and make the following changes:

1. In the **Architecture** paragraph: replace `~2647 keys, 100% complete at merge time` with `~24 KB of participant copy (mandatory) + ~81 KB of admin copy (optional follow-up)`.
2. In the **File Map** section under "New files (each language PR)": change `frontend/public/locales/<code>/translation.json` to:
   ```
   - `frontend/public/locales/<code>/participant.json` — mandatory, full translation (~24 KB).
   - `frontend/public/locales/<code>/admin.json` — optional, may be added in a follow-up PR; missing = English fallback at runtime.
   ```
3. In every Task that says `cp frontend/public/locales/en/translation.json frontend/public/locales/<code>/translation.json`, replace `translation.json` with `participant.json`. (Tasks 6, 7, 8, 9, 10.)
4. In every Task's translation prompt for Claude Code, change references from `translation.json` to `participant.json` and add a sentence: "Admin (`admin.json`) is out of scope for this PR — leave it as English fallback. A follow-up PR may add it later."
5. In the **Drift handling across PRs** section, narrow the discussion to `participant.json` (admin drift is allowed under best-effort).
6. In the **Acceptance for the full plan** section, change item 4 to read: "Switching to each new locale via `?lang=<code>` renders the participant flow without any English fallback. (Admin may show English; that is acceptable under the best-effort policy.)"

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/plans/2026-05-13-add-5-european-languages.md
git commit -m "docs(i18n): align 5-languages plan with namespace split (admin optional)"
```

---

### Task 10: Update the translation runbook

**Files:**
- Modify: `frontend/scripts/i18n/translation-runbook.md`

- [ ] **Step 1: Apply targeted edits**

Open `frontend/scripts/i18n/translation-runbook.md` and make these changes:

1. **Inputs** section: replace the line about `translation.json` with:
   ```
   - `frontend/public/locales/en/participant.json` — mandatory translation target, ~24 KB, 15 top-level namespaces.
   - `frontend/public/locales/en/admin.json` — optional translation target, ~81 KB, 2 top-level namespaces (`admin`, `auth`). Skip for participant-only locales.
   ```

2. **Output** section: same substitution.

3. **Chunking order**: split into two ordered lists:
   ```
   ### participant.json (mandatory)
   1. common
   2. layout
   3. footer
   4. errors
   5. landing
   6. welcome
   7. consent
   8. presort
   9. rough
   10. fine
   11. post
   12. audio
   13. resume
   14. erasure
   15. study

   ### admin.json (optional)
   16. auth
   17. admin — largest namespace, sub-chunk by its second-level keys.
   ```

4. **Stop conditions**: clarify that `participant.json` must satisfy strict parity, `admin.json` can be skipped entirely or be partial.

5. **Human review checklist**: keep the existing items but note that `auth.*` items are now admin-side (researcher login/register/2FA) and can be skipped if admin translation is deferred.

- [ ] **Step 2: Commit**

```bash
git add frontend/scripts/i18n/translation-runbook.md
git commit -m "docs(i18n): runbook reflects namespace split (admin optional)"
```

- [ ] **Step 3: Push and open PR**

```bash
git push -u origin HEAD
gh pr create --title "docs(i18n): align plan + runbook with namespace split" --body "$(cat <<'EOF'
## Summary
- Aligns the 5-European-languages plan with the new file layout: bootstrap from `participant.json`, admin translation is an optional follow-up per language.
- Updates the translation runbook to reference `participant.json` + `admin.json` and to flag admin as best-effort.

No code changes.

## Test plan
- [ ] Reviewer confirms the plan reads correctly end-to-end after the edits

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Acceptance for the full plan

The refactor is done when:

- [ ] PR #1 merged: `<lang>/translation.json` is gone; `participant.json` + `admin.json` are present for `en`, `fr`, `fi`, `de`; the app renders identically.
- [ ] PR #2 merged: removing a key from `fr/admin.json` produces a warning and `make check` exits 0; removing a key from `fr/participant.json` exits 1.
- [ ] PR #3 merged: the 5-languages plan and the translation runbook reflect the new layout.
- [ ] `make ci` passes on `main` after each merge.
- [ ] A subsequent "add Spanish locale" PR can ship with only `frontend/public/locales/es/participant.json`, no `admin.json`, and pass CI cleanly.
