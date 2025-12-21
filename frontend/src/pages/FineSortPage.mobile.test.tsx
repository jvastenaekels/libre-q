/*
 * Open-Q - Open-source platform for conducting Q-methodology research
 * Copyright (C) 2025 Julien Vastenekels
 * Licensed under the GNU Affero General Public License v3.0 or later.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import FineSortPage from './FineSortPage';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import StudyLayout from '../layouts/StudyLayout';
import { useConfigStore } from '../store/useConfigStore';
import { useResponseStore } from '../store/useResponseStore';
import { useSessionStore } from '../store/useSessionStore';
import { useUIStore } from '../store/useUIStore';

// Mock Stores
vi.mock('../store/useConfigStore');
vi.mock('../store/useResponseStore');
vi.mock('../store/useSessionStore');
vi.mock('../store/useUIStore');

const mockUseConfigStore = useConfigStore as unknown as ReturnType<typeof vi.fn>;
const mockUseResponseStore = useResponseStore as unknown as ReturnType<typeof vi.fn>;
const mockUseSessionStore = useSessionStore as unknown as ReturnType<typeof vi.fn>;
const mockUseUIStore = useUIStore as unknown as ReturnType<typeof vi.fn>;

// Mock useStudyConfig
vi.mock('../hooks/useStudyConfig', () => ({
    useStudyConfig: vi.fn(() => ({ isLoading: false, error: null, retry: vi.fn() }))
}));

// Mock ResizeObserver
global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
};

describe('FineSortPage Mobile Interaction', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Default mocks
        const defaultSessionState = {
            token: null, hasConsented: true, currentStep: 4, maxReachedStep: 4, language: 'en', isCompleted: false, confirmationCode: null, isSaving: false,
            setStep: vi.fn(),
            setLanguage: vi.fn() 
        };
        mockUseSessionStore.mockImplementation((selector: any) => selector ? selector(defaultSessionState) : defaultSessionState);

        mockUseUIStore.mockImplementation((selector: any) => selector ? selector({
            zoomedCard: null, setZoomedCard: vi.fn()
        }) : { zoomedCard: null, setZoomedCard: vi.fn() });
    });

    const mockConfig = {
        statements: [
            { id: 1, text: 'Card 1' },
            { id: 2, text: 'Card 2' }
        ],
        grid_config: [
            { score: -1, capacity: 1 }, 
            { score: 1, capacity: 1 }
        ],
        title: 'Demo', description: 'Demo', instructions: 'Demo', presort_config: {}, language_code: 'en'
    };

    it('allows "Tap-to-Place" interaction: Select Card -> Tap Slot -> Move', async () => {
        // Setup State
        const placeCardInGridSpy = vi.fn();
        
        mockUseConfigStore.mockImplementation((selector) => selector({ config: mockConfig }));
        
        mockUseResponseStore.mockReturnValue({ // useResponseStore is used for both selector AND actions in component
            rough: { agree: [], disagree: [1], neutral: [], history: [] },
            qsort: [],
            placeCardInGrid: placeCardInGridSpy,
            moveCardInGrid: vi.fn(),
            swapCardsInGrid: vi.fn(),
            unplaceCard: vi.fn(),
            resetFineSort: vi.fn()
        });
        // Note: In component:
        // const responses = useResponseStore((state) => ({ rough, qsort }))
        // const actions = useResponseStore()
        // We need the mock to handle both. simpler to mock implementation? 
        // Or just mockReturnValue works if the component usage is compatible.
        // Component usage 1: useResponseStore((state) => ({...})) 
        // Component usage 2: useResponseStore()
        
        // Better mock implementation to handle selector vs no-selector
        const mockResponsesState = {
            rough: { agree: [], disagree: [1], neutral: [], history: [] },
            qsort: [],
            placeCardInGrid: placeCardInGridSpy,
            moveCardInGrid: vi.fn(),
            swapCardsInGrid: vi.fn(),
            unplaceCard: vi.fn(),
            resetFineSort: vi.fn()
        };
        mockUseResponseStore.mockImplementation((selector: any) => selector ? selector(mockResponsesState) : mockResponsesState);

        render(
            <MemoryRouter initialEntries={['/study/demo/sort/fine']}>
                <Routes>
                    <Route path="/study/:slug" element={<StudyLayout />}>
                        <Route path="sort/fine" element={<FineSortPage />} />
                    </Route>
                </Routes>
            </MemoryRouter>
        );

        // 2. Locate Card in Deck
        // Currently GridSort defaults to 'disagree' pile, which has Card 1.
        const card = screen.getByText('Card 1');
        expect(card).toBeTruthy();

        // 3. User Taps Card (Select)
        fireEvent.click(card); // This should toggle 'selectedCardId' state in FineSortPage

        // 4. Verify Selection Visuals (Optional check if we could inspect style, but functional check is better)
        // We can check if `placeCardInGridSpy` has NOT been called yet
        expect(placeCardInGridSpy).not.toHaveBeenCalled();

        // 5. User Taps Empty Slot (Place)
        // Target slot at col 0, row 0 (Score -1)
        const slot = screen.getByTestId('slot_0_0');
        expect(slot).toBeTruthy();

        fireEvent.click(slot);

        // 6. Verify Action
        // placeCardInGrid(cardId, col, row)
        expect(placeCardInGridSpy).toHaveBeenCalledTimes(1);
        expect(placeCardInGridSpy).toHaveBeenCalledWith(1, 0, 0);
    });

    it('allows "Tap-to-Swap" interaction: Select Card -> Tap Occupied Slot -> Swap', async () => {
        // 1. Setup State: Card 2 in Disagree Pile. Card 1 already in Grid at 0,0.
        const unplaceCardSpy = vi.fn();
        const placeCardInGridSpy = vi.fn();
        const swapCardsInGridSpy = vi.fn();

        mockUseConfigStore.mockImplementation((selector) => selector({ config: mockConfig }));

        const mockResponsesState = {
            rough: { agree: [], disagree: [2], neutral: [], history: [] }, 
            qsort: [
                { statementId: 1, col: 0, row: 0 }
            ],
            postsort: { card_comments: {}, missing_statement: '', general_comment: '' },
            placeCardInGrid: placeCardInGridSpy,
            moveCardInGrid: vi.fn(),
            swapCardsInGrid: swapCardsInGridSpy,
            unplaceCard: unplaceCardSpy,
            resetFineSort: vi.fn()
        };
        
        mockUseResponseStore.mockImplementation((selector: any) => selector ? selector(mockResponsesState) : mockResponsesState);

        render(
            <MemoryRouter initialEntries={['/study/demo/sort/fine']}>
                <Routes>
                    <Route path="/study/:slug" element={<StudyLayout />}>
                        <Route path="sort/fine" element={<FineSortPage />} />
                    </Route>
                </Routes>
            </MemoryRouter>
        );

        // 2. Select Card 2 (in Deck)
        const cardInDeck = screen.getByText('Card 2');
        fireEvent.click(cardInDeck);

        // 3. Tap Occupied Slot (Slot 0,0 has Card 1)
        const slot = screen.getByTestId('slot_0_0');
        fireEvent.click(slot);

        // 4. Verify Swap (Implemented as Unplace + Place for Deck->Grid items)
        expect(unplaceCardSpy).toHaveBeenCalledTimes(1);
        expect(unplaceCardSpy).toHaveBeenCalledWith(1); // Unplace Card 1

        expect(placeCardInGridSpy).toHaveBeenCalledTimes(1);
        expect(placeCardInGridSpy).toHaveBeenCalledWith(2, 0, 0); // Place Card 2 at 0,0
    });
});
