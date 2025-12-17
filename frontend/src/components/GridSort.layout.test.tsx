import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import GridSort from './GridSort';
import { DndContext } from '@dnd-kit/core';

// Mock dependencies
vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: any) => <>{children}</>,
  horizontalListSortingStrategy: {},
  rectSortingStrategy: {},
}));

vi.mock('./SortableCard', () => ({
  default: ({ text }: any) => <div>{text}</div>
}));

vi.mock('./DroppableSlot', () => ({
  default: ({ children, id, className }: any) => (
    <div data-testid="droppable-slot" data-id={id} className={className}>
      {children}
    </div>
  )
}));

describe('GridSort Layout', () => {
    const defaultProps = {
        agreeCards: [],
        disagreeCards: [],
        neutralCards: [],
        gridColumns: [
            { score: -2, capacity: 2 },
            { score: 0, capacity: 4 },
            { score: 2, capacity: 2 },
        ],
        responses: { qsort: [] },
        renderSlotContent: () => null,
    };

    it('renders the correct number of slots based on capacity', () => {
        render(
            <DndContext>
                <GridSort {...defaultProps} />
            </DndContext>
        );
        
        const slots = screen.getAllByTestId('droppable-slot');
        // Total capacity: 2 + 4 + 2 = 8
        expect(slots).toHaveLength(8);
    });

    it('has sufficient top padding to prevent hidden slots', () => {
         render(
            <DndContext>
                <GridSort {...defaultProps} />
            </DndContext>
        );
        const gridContainer = screen.getByTestId('grid-container');
        expect(gridContainer.className).toContain('py-12');
        expect(gridContainer.className).toContain('py-12');
        // expect(gridContainer.className).toContain('overflow-y-auto'); // Removed as logic changed with zoom lib
    });
});
