/*
 * Qualis - Open-source platform for conducting Q-methodology research
 * Copyright (C) 2025 Qualis Team
 * Licensed under the GNU Affero General Public License v3.0 or later.
 */

/**
 * Unit tests for useAudioRecorder — pure-logic paths only. The full
 * mocked record/stop/auto-stop/codec/cleanup lifecycle is covered
 * end-to-end through the component by the unchanged
 * AudioRecorder.test.tsx (the behaviour-preservation oracle).
 */

import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAudioRecorder } from './useAudioRecorder';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (_k: string, d?: string) => d ?? _k }),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function makeProps(over: Record<string, unknown> = {}) {
    return {
        questionKey: 'q1',
        maxDurationSeconds: 180,
        onRecordingComplete: vi.fn().mockResolvedValue(undefined),
        onRecordingDeleted: vi.fn().mockResolvedValue(undefined),
        ...over,
    } as Parameters<typeof useAudioRecorder>[0];
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe('useAudioRecorder — initial state', () => {
    it('starts idle with zero duration and no audio url', () => {
        const { result } = renderHook(() => useAudioRecorder(makeProps()));
        expect(result.current.status.state).toBe('idle');
        expect(result.current.recording.duration).toBe(0);
        expect(result.current.playback.audioUrl).toBeNull();
        expect(result.current.waveform.audioLevels).toHaveLength(5);
    });
});
