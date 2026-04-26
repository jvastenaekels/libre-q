import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useConfigStore } from '../store/useConfigStore';
import { useSessionStore } from '../store/useSessionStore';
import { applyStudyOverrides } from '../utils/i18nOverrides';
import { useGetStudyConfig } from './useGetStudyConfig';
import { useStudyConfig } from './useStudyConfig';

// Mock the query hook
vi.mock('./useGetStudyConfig', () => ({
    useGetStudyConfig: vi.fn(),
}));

// Mock the i18n overrides utility
vi.mock('../utils/i18nOverrides', () => ({
    applyStudyOverrides: vi.fn(),
    resetBaseLocales: vi.fn(),
}));

// Mock i18n instance methods for tracking
vi.mock('../i18n', () => ({
    default: {
        changeLanguage: vi.fn(),
        language: 'en',
    },
}));

// Mock react-router-dom
vi.mock('react-router-dom', () => ({
    useParams: () => ({ slug: 'test-study' }),
    useLocation: () => ({ pathname: '/study/test-study/welcome' }),
}));

describe('useStudyConfig', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset Stores
        useConfigStore.getState().resetConfig();
        useSessionStore.getState().resetSession();
    });

    it('fetches study config on mount', async () => {
        const mockData = {
            slug: 'test-study',
            title: 'Test Title EN',
            description: 'Test Description EN',
            instructions: 'Test Instructions EN',
            presort_config: {},
            statements: [],
        };

        vi.mocked(useGetStudyConfig).mockReturnValue({
            data: mockData,
            isLoading: false,
            error: null,
            refetch: vi.fn(),
        });

        renderHook(() => useStudyConfig());

        await waitFor(() => {
            expect(useConfigStore.getState().config?.title).toBe('Test Title EN');
        });
    });

    it('applies UI overrides when present in config', async () => {
        const uiLabels = { 'common.agree': 'Approve' };
        const mockData = {
            slug: 'test-study',
            title: 'Test Title',
            description: 'Desc',
            instructions: 'Instr',
            presort_config: {},
            statements: [],
            ui_labels: uiLabels,
            language: 'en',
        };

        vi.mocked(useGetStudyConfig).mockReturnValue({
            data: mockData,
            isLoading: false,
            error: null,
            refetch: vi.fn(),
            // biome-ignore lint/suspicious/noExplicitAny: mock hook
        } as any);

        renderHook(() => useStudyConfig());

        await waitFor(() => {
            expect(applyStudyOverrides).toHaveBeenCalledWith('en', uiLabels);
        });
    });
    it('handles API errors (e.g. 404/500) gracefully', async () => {
        const error = new Error('Not Found');
        vi.mocked(useGetStudyConfig).mockReturnValue({
            data: undefined,
            isLoading: false,
            error: error,
            refetch: vi.fn(),
            // biome-ignore lint/suspicious/noExplicitAny: mock hook
        } as any);

        renderHook(() => useStudyConfig());

        await waitFor(() => {
            // Check if error state is updated in the store
            // Note: useStudyConfig primarily sets the config.
            // If useGetStudyConfig returns an error, it's typically handled by the component usage
            // (checking `error` returned by the hook or store).
            // Let's verify standard behavior: if error, config remains null/empty or error is logged?
            // Actually, looking at useStudyConfig implementation:
            // It relies on useGetStudyConfig.
            // If the store is not updated, that's expected.
            // But we should verify it DOES NOT update with invalid data.
            const cfg = useConfigStore.getState().config;
            expect(cfg).toBeNull();
        });
    });

    it('Pilot Mode: Falls back to server when local draft is missing', async () => {
        // Mock URL to be in test mode
        vi.spyOn(URLSearchParams.prototype, 'get').mockImplementation((key) => {
            if (key === 'mode') return 'test';
            return null;
        });

        // Ensure no local draft
        localStorage.clear();

        const mockServerData = {
            slug: 'test-study',
            title: 'Server Fallback Title',
            language: 'en',
            presort_config: {},
            statements: [],
        };

        const refetchMock = vi.fn().mockResolvedValue({ data: mockServerData });

        vi.mocked(useGetStudyConfig).mockReturnValue({
            data: undefined,
            isLoading: false,
            error: null,
            refetch: refetchMock,
            // biome-ignore lint/suspicious/noExplicitAny: mock hook
        } as any);

        renderHook(() => useStudyConfig());

        await waitFor(() => {
            expect(refetchMock).toHaveBeenCalled();
            expect(useConfigStore.getState().config?.title).toBe('Server Fallback Title');
        });
    });

    // ── Defensive guard against the OOM loop fixed in 0a31428 ────────────────
    // The data-sync effect refuses to write a response whose `slug` differs
    // from the URL slug. Without this guard, an in-flight stale response
    // (e.g. switching studies before the previous fetch resolves) would
    // populate the store with the wrong slug, the slug-guard would fire a
    // reset, the refetch would replay, and the loop would exhaust the heap.
    // See `useStudyConfig.ts:246-253` for the rationale comment.
    it('does NOT write a config response whose slug mismatches the URL slug', async () => {
        // The router mock pins the URL slug to 'test-study'. Mock the API
        // hook to return a response with a different slug — this is exactly
        // the stale-in-flight scenario the guard exists for.
        const mismatchedData = {
            slug: 'wrong-slug',
            title: 'Should Not Be Written',
            language: 'en',
            presort_config: {},
            statements: [],
        };

        vi.mocked(useGetStudyConfig).mockReturnValue({
            data: mismatchedData,
            isLoading: false,
            error: null,
            refetch: vi.fn(),
            // biome-ignore lint/suspicious/noExplicitAny: mock hook
        } as any);

        renderHook(() => useStudyConfig());

        // Give effects a tick to run; the guard returns synchronously so
        // setConfig should not have fired.
        await waitFor(() => {
            // Store stays at reset (config = null) — the mismatched payload
            // was rejected by the guard, never reaching setConfig.
            expect(useConfigStore.getState().config).toBeNull();
        });
    });
});
