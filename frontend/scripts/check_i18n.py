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
