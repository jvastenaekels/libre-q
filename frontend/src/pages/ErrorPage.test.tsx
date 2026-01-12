/*
 * Open-Q - Open-source platform for conducting Q-methodology research
 * Copyright (C) 2025 Julien Vastenekels
 * Licensed under the GNU Affero General Public License v3.0 or later.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/client';
import ErrorPage from './ErrorPage';

const mockResetSession = vi.fn();
const mockResetConfig = vi.fn();
const mockResetResponses = vi.fn();
const mockNavigate = vi.fn();

// Mocks

vi.mock('../store/useSessionStore', () => ({
    useSessionStore: {
        getState: () => ({ resetSession: mockResetSession }),
    },
}));
vi.mock('../store/useConfigStore', () => ({
    useConfigStore: {
        getState: () => ({ resetConfig: mockResetConfig }),
    },
}));
vi.mock('../store/useResponseStore', () => ({
    useResponseStore: {
        getState: () => ({ resetResponses: mockResetResponses }),
    },
}));

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => mockNavigate,
    };
});

describe('ErrorPage', () => {
    // Mock window.location
    const originalLocation = window.location;

    beforeEach(() => {
        // @ts-expect-error - window.location is read-only in JSDOM
        delete window.location;
        // @ts-expect-error - window.location is read-only in JSDOM
        window.location = { href: '' };
        vi.clearAllMocks();
    });

    afterEach(() => {
        // @ts-expect-error - window.location is read-only in JSDOM
        window.location = originalLocation;
    });

    it('renders generic error message by default', () => {
        render(
            <MemoryRouter>
                <ErrorPage />
            </MemoryRouter>
        );
        // "common.errors.default_title" matches mock translation key
        expect(screen.getByText('Oops! Something went wrong.')).toBeInTheDocument();
        expect(screen.getByText('An unexpected error occurred.')).toBeInTheDocument();
    });

    it('renders specific 404 UI', () => {
        render(
            <MemoryRouter>
                <ErrorPage error={new ApiError(404, 'Not found')} />
            </MemoryRouter>
        );
        expect(screen.getByText('Page Not Found')).toBeInTheDocument();
        expect(screen.queryByText('Oops! Something went wrong.')).not.toBeInTheDocument();
    });

    it('resets session on button click for generic error', () => {
        render(
            <MemoryRouter>
                <ErrorPage />
            </MemoryRouter>
        );

        // Button text is now from translation keys
        const resetButton = screen.getByRole('button', { name: 'Reset Session' });
        fireEvent.click(resetButton);

        expect(mockResetSession).toHaveBeenCalled();
        expect(mockResetConfig).toHaveBeenCalled();
        expect(mockResetResponses).toHaveBeenCalled();
        expect(window.location.href).toBe('/');
    });

    it('shows retry button for 429', () => {
        const onRetry = vi.fn();
        render(
            <MemoryRouter>
                <ErrorPage error={new ApiError(429, 'Rate limited')} onRetry={onRetry} />
            </MemoryRouter>
        );

        const retryButton = screen.getByRole('button', { name: 'Retry' });
        fireEvent.click(retryButton);
        expect(onRetry).toHaveBeenCalled();
    });
});
