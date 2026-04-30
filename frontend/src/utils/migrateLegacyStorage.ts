/*
 * Qualis - Open-source platform for conducting Q-methodology research
 * Copyright (C) 2025 Julien Vastenekels
 * Licensed under the GNU Affero General Public License v3.0 or later.
 */

/**
 * One-shot migration: rename localStorage and sessionStorage keys from the
 * pre-rename `libre-q-*` namespace to the post-rename `qualis-*` namespace
 * (project rename 2026-04). Idempotent — second and subsequent calls are
 * no-ops once the legacy keys are gone.
 *
 * Protected categories at time of writing:
 * - qualis-draft-backup-{slug}  (in-flight study designer recoveries)
 * - qualis-test-draft-{slug}    (cross-tab pilot synchronisation)
 * - qualis-test-config-{slug}   (study designer config snapshot)
 * - qualis-pilot-reset-{slug}   (pilot reset signal between tabs)
 * - qualis-pilot-mode           (sessionStorage flag)
 * - qualis-resumed-via-link     (sessionStorage flag)
 * - libre-q-{pilot-,}responses   (Zustand-persisted participant responses)
 *
 * The migration runs once at app boot from main.tsx, before any code reads
 * from the new namespace, so the first read on each existing key sees the
 * preserved value.
 */
export function migrateLegacyStorage(): void {
    const storages: Storage[] = [];
    try {
        storages.push(localStorage);
    } catch {
        // SSR / disabled-storage environments: nothing to migrate.
    }
    try {
        storages.push(sessionStorage);
    } catch {
        // Same as above for sessionStorage.
    }

    const PREFIX = 'libre-q-';
    for (const storage of storages) {
        const legacyKeys: string[] = [];
        for (let i = 0; i < storage.length; i++) {
            const key = storage.key(i);
            if (key?.startsWith(PREFIX)) legacyKeys.push(key);
        }
        for (const oldKey of legacyKeys) {
            const newKey = `qualis-${oldKey.slice(PREFIX.length)}`;
            const value = storage.getItem(oldKey);
            // Don't clobber: if the user has already produced a qualis-namespaced
            // value (e.g. by visiting a tab that ran post-migration code first),
            // keep the new one.
            if (value !== null && storage.getItem(newKey) === null) {
                storage.setItem(newKey, value);
            }
            storage.removeItem(oldKey);
        }
    }
}
