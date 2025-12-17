import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import FineSortPage from './FineSortPage';
import { useStudyStore } from '../store/useStudyStore';
import { MemoryRouter } from 'react-router-dom';

// Mock Modules
vi.mock('@dnd-kit/core', async () => {
    const actual = await vi.importActual('@dnd-kit/core');
    return {
        ...actual,
        DndContext: ({ children }: any) => <div>{children}</div>,
        useSensors: () => ({}),
        useSensor: () => ({}),
        PointerSensor: class {},
        TouchSensor: class {},
        DragOverlay: ({ children }: any) => <div>{children}</div>,
    };
});

vi.mock('../contexts/LayoutContext', () => ({
    useLayoutAction: () => ({
        setHeaderAction: vi.fn(),
    }),
}));

vi.mock('../components/GridSort', () => ({
    default: (props: any) => (
        <div data-testid="grid-sort">
            <div data-testid="pile-agree">{props.agreeCards?.length}</div>
            <div data-testid="pile-disagree">{props.disagreeCards?.length}</div>
            <div data-testid="pile-neutral">{props.neutralCards?.length}</div>
        </div>
    )
}));

vi.mock('../components/SortableCard', () => ({
    default: ({ text }: any) => <div data-testid="sortable-card">{text}</div>
}));

// Mock Store
const initialStoreState = useStudyStore.getState();

describe('FineSortPage', () => {
    beforeEach(() => {
        useStudyStore.setState(initialStoreState, true);
        useStudyStore.setState({
            config: {
                slug: 'test',
                title: 'Test',
                description: 'Test',
                instructions: 'Test',
                presort_config: {},
                statements: [
                    { id: 1, text: 'Card 1' },
                    { id: 2, text: 'Card 2' }
                ],
                grid_config: [
                    { score: 0, capacity: 2 }
                ]
            },
            responses: {
                presort: {},
                rough: {
                    agree: [1],
                    disagree: [],
                    neutral: [2],
                    history: []
                },
                qsort: [],
                postsort: {}
            }
        });
    });

    it('renders the GridSort component', () => {
        render(
            <MemoryRouter>
                <FineSortPage />
            </MemoryRouter>
        );
        expect(screen.getByTestId('grid-sort')).toBeTruthy();
    });

    it('places a card correctly in store when logic is triggered', () => {
        // Since DnD is mocked, we can test the store action directly ensuring hooks expose it
        const store = useStudyStore.getState();
        store.placeCardInGrid(1, 0, 0); // Col 0, Row 0 in Store
        
        expect(useStudyStore.getState().responses.qsort).toHaveLength(1);
        expect(useStudyStore.getState().responses.qsort[0]).toEqual({
            statementId: 1,
            col: 0,
            row: 0
        });
    });

    it('renders correct cards in Source Deck tabs', () => {
        useStudyStore.setState({
            config: {
                slug: 'test',
                title: 'Test',
                description: 'Test',
                instructions: 'Test',
                presort_config: {},
                statements: [
                    { id: 1, text: 'Card Agree' },
                    { id: 2, text: 'Card Disagree' },
                    { id: 3, text: 'Card Neutral' }
                ]
            },
            responses: {
                presort: {},
                rough: {
                    agree: [1],
                    disagree: [2],
                    neutral: [3],
                    history: [1, 2, 3]
                },
                qsort: [],
                postsort: {}
            }
        });

        render(
            <MemoryRouter>
                <FineSortPage />
            </MemoryRouter>
        );
        expect(screen.getByTestId('pile-agree').textContent).toBe('1');
        expect(screen.getByTestId('pile-disagree').textContent).toBe('1');
        expect(screen.getByTestId('pile-neutral').textContent).toBe('1');
    });

    it('handles missing config gracefully', () => {
        useStudyStore.setState({ config: null });
        render(
            <MemoryRouter>
                <FineSortPage />
            </MemoryRouter>
        );
        expect(screen.getByText(/Loading/i)).toBeTruthy();
    });
});
