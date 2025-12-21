/*
 * Open-Q - Open-source platform for conducting Q-methodology research
 * Copyright (C) 2025 Julien Vastenekels
 * Licensed under the GNU Affero General Public License v3.0 or later.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import PostSortPage from './PostSortPage';
import { MemoryRouter } from 'react-router-dom';
import { useConfigStore } from '../store/useConfigStore';
import { useSessionStore } from '../store/useSessionStore';
import { useResponseStore } from '../store/useResponseStore';
import { LayoutProvider } from '../contexts/LayoutContext';

// Mock Stores
vi.mock('../store/useConfigStore');
vi.mock('../store/useSessionStore');
vi.mock('../store/useResponseStore');

const mockUseConfigStore = useConfigStore as unknown as ReturnType<typeof vi.fn>;
const mockUseSessionStore = useSessionStore as unknown as ReturnType<typeof vi.fn>;
const mockUseResponseStore = useResponseStore as unknown as ReturnType<typeof vi.fn>;

// Mock translation
vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key })
}));

describe('PostSortPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const mockConfig = {
        statements: [
            { id: 1, text: 'Card 1 (Extreme -4)' },
            { id: 2, text: 'Card 2 (Extreme +4)' },
            { id: 3, text: 'Card 3 (Neutral 0)' }
        ],
        postsort_config: { extreme_columns: [-4, 4] },
        grid_config: [ // Need grid config for col lookup
             { score: -4, capacity: 1 }, 
             { score: -3, capacity: 1 }, 
             { score: -2, capacity: 1 }, 
             { score: -1, capacity: 1 }, 
             { score: 0, capacity: 1 }, 
             { score: 1, capacity: 1 }, 
             { score: 2, capacity: 1 }, 
             { score: 3, capacity: 1 }, 
             { score: 4, capacity: 1 }
        ]
    };

    const mockResponses = {
        qsort: [
            { statementId: 1, col: 0, row: 0 }, // Index 0 -> Score -4
            { statementId: 2, col: 8, row: 0 }, // Index 8 -> Score +4
            { statementId: 3, col: 4, row: 0 }, // Index 4 -> Score 0
        ],
        postsort: {
             card_comments: {},
             missing_statement: '',
             general_comment: ''
        }
    };

    const setup = () => {
        const setPostSortResponseSpy = vi.fn();
        const setStepSpy = vi.fn();

        // 1. Config Store Mock
        mockUseConfigStore.mockImplementation((selector: any) => {
             return selector({ config: mockConfig });
        });

        // 2. Session Store Mock
        mockUseSessionStore.mockImplementation((selector: any) => {
             return selector({ 
                 isCompleted: false, 
                 confirmationCode: null,
                 setStep: setStepSpy 
             });
        });

        // 3. Response Store Mock
        mockUseResponseStore.mockImplementation((selector: any) => {
             return selector({
                 qsort: mockResponses.qsort,
                 postsort: mockResponses.postsort,
                 setPostSortResponse: setPostSortResponseSpy
             });
        });

        return { setPostSortResponseSpy, setStepSpy };
    };

    it('renders null if config is missing', () => {
        mockUseConfigStore.mockImplementation((selector: any) => selector({ config: null }));
        // Other stores still need valid returns
        mockUseSessionStore.mockImplementation((selector: any) => selector({ isCompleted: false, confirmationCode: null, setStep: vi.fn() }));
        mockUseResponseStore.mockImplementation((selector: any) => selector({ qsort: [], postsort: {} }));
        
        const { container } = render(
             <MemoryRouter>
                <LayoutProvider>
                    <PostSortPage />
                </LayoutProvider>
            </MemoryRouter>
        );
        expect(container.firstChild).toBeNull();
    });

    it('identifies and displays extreme cards only', () => {
        setup();
        render(
            <MemoryRouter>
                <LayoutProvider>
                    <PostSortPage />
                </LayoutProvider>
            </MemoryRouter>
        );

        // Should receive Step 5 update
        // expect(setStepSpy).toHaveBeenCalledWith(5);

        // Extreme Cards
        expect(screen.getByText(/Card 1 \(Extreme -4\)/)).toBeTruthy();
        expect(screen.getByText(/Card 2 \(Extreme \+4\)/)).toBeTruthy();
        
        // Neutral Card logic (should NOT be visible in the prompt list)
        // We look for the text in blockquotes. 
        // Note: 'Card 3 (Neutral 0)' is in the document? No, getCardText uses statements array.
        // But the "Card 3" shouldn't be rendered as a prompt.
        const card3 = screen.queryByText('Card 3 (Neutral 0)');
        expect(card3).toBeNull();
    });

    it('shows validation error for short comments on submit', async () => {
         setup();
         render(
             <MemoryRouter>
                 <LayoutProvider>
                     <PostSortPage />
                 </LayoutProvider>
             </MemoryRouter>
         );

         const submitBtn = screen.getByText('post.submit');
         fireEvent.click(submitBtn);

         // Validation message should appear for both cards
         // "post.extreme.min_chars"
         const warnings = await screen.findAllByText('post.extreme.min_chars');
         expect(warnings.length).toBe(2); // One for each extreme card
    });

    it('updates store when typing comments', () => {
        const { setPostSortResponseSpy } = setup();
        render(
            <MemoryRouter>
                <LayoutProvider>
                    <PostSortPage />
                </LayoutProvider>
            </MemoryRouter>
        );

        const textAreas = screen.getAllByPlaceholderText('post.extreme.placeholder');
        // First one is Card 1 (-4)
        fireEvent.change(textAreas[0], { target: { value: 'This is a valid comment because it is long enough.' } });

        expect(setPostSortResponseSpy).toHaveBeenCalledWith('card_comments', expect.objectContaining({
            1: 'This is a valid comment because it is long enough.'
        }));
    });

    it('tracks missing statement and general comments', () => {
         const { setPostSortResponseSpy } = setup();
         render(
             <MemoryRouter>
                 <LayoutProvider>
                     <PostSortPage />
                 </LayoutProvider>
             </MemoryRouter>
         );
         
         // Missing statement
         const missingInput = screen.getByLabelText('post.missing.label');
         fireEvent.change(missingInput, { target: { value: 'I feel like X is missing' } });
         expect(setPostSortResponseSpy).toHaveBeenCalledWith('missing_statement', 'I feel like X is missing');

         // General
         const generalInput = screen.getByLabelText('post.general.label');
         fireEvent.change(generalInput, { target: { value: 'Great study!' } });
         expect(setPostSortResponseSpy).toHaveBeenCalledWith('general_comment', 'Great study!');
    });

    it('persists comments when re-navigating', async () => {
        let externalComments: Record<number, string> = {};
        
        // Custom setup for this test to link state update to externalComments
        mockUseConfigStore.mockImplementation((selector: any) => selector({ config: mockConfig }));
        mockUseSessionStore.mockImplementation((selector: any) => selector({ isCompleted: false, confirmationCode: null, setStep: vi.fn() }));
        
        mockUseResponseStore.mockImplementation((selector: any) => selector({ 
            qsort: mockResponses.qsort,
            postsort: { ...mockResponses.postsort, card_comments: externalComments },
            setPostSortResponse: (field: string, val: unknown) => {
                 if (field === 'card_comments') externalComments = val as Record<number, string>;
            }
        }));

        const { unmount } = render(
            <MemoryRouter>
                <LayoutProvider>
                    <PostSortPage />
                </LayoutProvider>
            </MemoryRouter>
        );

        const textAreas = screen.getAllByPlaceholderText('post.extreme.placeholder');
        fireEvent.change(textAreas[0], { target: { value: 'Persisted comment for card 1' } });

        unmount();

        render(
            <MemoryRouter>
                <LayoutProvider>
                    <PostSortPage />
                </LayoutProvider>
            </MemoryRouter>
        );

        expect(screen.getByDisplayValue('Persisted comment for card 1')).toBeTruthy();
    });
});
