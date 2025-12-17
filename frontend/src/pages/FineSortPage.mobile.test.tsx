import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import FineSortPage from './FineSortPage';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import StudyLayout from '../layouts/StudyLayout';
import { useStudyStore } from '../store/useStudyStore';

// Mock Store
vi.mock('../store/useStudyStore');
const mockUseStudyStore = useStudyStore as unknown as ReturnType<typeof vi.fn>;

// Mock ResizeObserver
global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
};

describe('FineSortPage Mobile Interaction', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const mockConfig = {
        statements: [
            { id: 1, text: 'Card 1' },
            { id: 2, text: 'Card 2' }
        ],
        grid_config: [
            { score: -1, capacity: 1 }, 
            { score: 1, capacity: 1 }
        ]
    };

    it('allows "Tap-to-Place" interaction: Select Card -> Tap Slot -> Move', async () => {
        // 1. Setup State: Card 1 is in Neutral Pile (Deck). Grid is empty.
        const placeCardInGridSpy = vi.fn();
        
        mockUseStudyStore.mockReturnValue({
            config: mockConfig,
            responses: {
                rough: { agree: [], disagree: [1], neutral: [] }, 
                qsort: []
            },
            session: { hasConsented: true, currentStep: 4 },
            setStep: vi.fn(),
            placeCardInGrid: placeCardInGridSpy,
            moveCardInGrid: vi.fn(),
            swapCardsInGrid: vi.fn(),
            unplaceCard: vi.fn(),
            resetFineSort: vi.fn()
        });

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
        const swapCardsInGridSpy = vi.fn();

        mockUseStudyStore.mockReturnValue({
            config: mockConfig,
            responses: {
                rough: { agree: [], disagree: [2], neutral: [] }, 
                qsort: [
                    { statementId: 1, col: 0, row: 0 }
                ]
            },
            session: { hasConsented: true, currentStep: 4 },
            setStep: vi.fn(),
            placeCardInGrid: vi.fn(),
            moveCardInGrid: vi.fn(),
            swapCardsInGrid: swapCardsInGridSpy,
            unplaceCard: vi.fn(),
            resetFineSort: vi.fn()
        });

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

        // 4. Verify Swap
        // swapCardsInGrid(incomingId, existingId)
        expect(swapCardsInGridSpy).toHaveBeenCalledTimes(1);
        expect(swapCardsInGridSpy).toHaveBeenCalledWith(2, 1);
    });
});
