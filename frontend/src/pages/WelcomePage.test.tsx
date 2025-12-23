/*
 * Open-Q - Open-source platform for conducting Q-methodology research
 * Copyright (C) 2025 Julien Vastenekels
 * Licensed under the GNU Affero General Public License v3.0 or later.
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WelcomePage from './WelcomePage';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { useConfigStore } from '../store/useConfigStore';
import { useSessionStore } from '../store/useSessionStore';

// Mocks
const mockConfig = {
    title: 'Test Study',
    subtitle: 'Test Subtitle',
    slug: 'test-study',
    description: 'Test Description',
    objective: 'Test Objective',
    instructions: 'Test **Content**',
    statements: [],
    consent: {
        title: null,
        description: null
    }
};

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string, defaultValue: string) => defaultValue || key }),
}));

vi.mock('../hooks/useStudyConfig', () => ({
    useStudyConfig: () => ({ isLoading: false, error: null })
}));

describe('WelcomePage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Setup initial state
        useConfigStore.getState().setConfig(mockConfig as any);
        useSessionStore.getState().resetSession();
    });

    it('renders study details (title, subtitle, description, objective)', () => {
        render(
            <MemoryRouter>
                <WelcomePage />
            </MemoryRouter>
        );
        expect(screen.getByText('Test Study')).toBeInTheDocument();
        expect(screen.getByText('Test Subtitle')).toBeInTheDocument();
        expect(screen.getByText('Test Description')).toBeInTheDocument();
        expect(screen.getByText('Test Objective')).toBeInTheDocument();
    });

    it('renders instructions markdown', () => {
        render(
            <MemoryRouter>
                <WelcomePage />
            </MemoryRouter>
        );
        // Label
        expect(screen.getByText('Instructions')).toBeInTheDocument();
        
        // Markdown Content - split check to be resilient to formatting/newlines
        expect(screen.getByText('Content')).toBeInTheDocument();
        
        // Check for bold tag
        const strong = document.querySelector('strong');
        expect(strong).toBeInTheDocument();
        expect(strong?.textContent).toBe('Content');
    });

    it('renders continue button and navigates to consent', async () => {
        render(
             <MemoryRouter initialEntries={['/study/test-study/welcome']}>
                 <Routes>
                     <Route path="/study/:slug/welcome" element={<WelcomePage />} />
                     <Route path="/study/:slug/consent" element={<div>Consent Page</div>} />
                 </Routes>
             </MemoryRouter>
         );
 
         const button = screen.getByRole('button', { name: /Continue/i });
         expect(button).toBeInTheDocument();
         
         fireEvent.click(button);
 
         await waitFor(() => {
             expect(screen.getByText('Consent Page')).toBeInTheDocument();
         });
    });
});
