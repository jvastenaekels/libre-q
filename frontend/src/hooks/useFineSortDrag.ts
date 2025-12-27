/**
 * useFineSortDrag Hook
 *
 * Encapsulates the complex drag-and-drop logic for the Fine Sort grid.
 * Configures DndKit sensors, drag events, and interactions with the grid placement logic.
 */

import type { DragStartEvent, DragEndEvent, DragMoveEvent } from '@dnd-kit/core';
import React, { useState, useCallback, useEffect } from 'react';
import type { ReactZoomPanPinchRef } from 'react-zoom-pan-pinch';
import { useUIStore } from '../store/useUIStore';
import { useGridPlacement } from './useGridPlacement';
import { useDragAutoInteraction } from './useDragAutoInteraction';

// Define minimal types needed for the hook to avoid circular deps or complex mocks
interface Statement {
    id: number;
    text: string;
}
export interface DragCard {
    statementId: number;
    col: number;
    row: number;
}

interface GridColumn {
    capacity: number;
}

interface Actions {
    placeCardInGrid: (id: number, col: number, row: number) => void;
    moveCardInGrid: (id: number, col: number, row: number) => void;
    swapCardsInGrid: (id1: number, id2: number) => void;
    unplaceCard: (id: number) => void;
}

export interface InteractionUtils {
    zoomIn: (step?: number) => void;
    zoomOut: (step?: number) => void;
    performAutoFit: () => void;
    transformRef: React.RefObject<ReactZoomPanPinchRef>;
    wrapperRef: React.RefObject<HTMLDivElement>;
    contentRef: React.RefObject<HTMLDivElement>;
}

interface UseFineSortDragProps {
    responses: {
        qsort: DragCard[];
    };
    gridColumns: GridColumn[];
    actions: Actions;
    onSelectionChange?: (id: number | null) => void;
    selectedId?: number | null;
    interactionUtils?: InteractionUtils | null;
    onPan?: () => void;
    statements: Statement[];
}

export const useFineSortDrag = ({
    responses,
    gridColumns,
    actions,
    onSelectionChange,
    selectedId,
    interactionUtils,
    onPan,
    statements,
}: UseFineSortDragProps) => {
    const [activeId, setActiveId] = useState<number | null>(null);
    const setActiveCard = useUIStore((state) => state.setActiveCard);

    const { handlePlacement, findClosestEmptyRow } = useGridPlacement({
        responses,
        gridColumns,
        actions,
    });

    const { initInteraction, updateInteraction, cleanupInteraction } = useDragAutoInteraction({
        interactionUtils,
        onPan,
    });

    useEffect(() => {
        const activeCard = activeId !== null ? statements.find((s) => s.id === activeId) : null;
        setActiveCard(activeCard || null);
    }, [activeId, statements, setActiveCard]);

    const handleDragStart = useCallback(
        (event: DragStartEvent) => {
            setActiveId(event.active.id as number);
            onSelectionChange?.(null);

            if (
                event.activatorEvent instanceof MouseEvent ||
                event.activatorEvent instanceof PointerEvent
            ) {
                initInteraction(event.activatorEvent.clientX, event.activatorEvent.clientY);
            }
        },
        [onSelectionChange, initInteraction]
    );

    const handleDragMove = useCallback(
        (event: DragMoveEvent) => {
            const activator = event.activatorEvent as MouseEvent | PointerEvent;
            const x = activator.clientX + event.delta.x;
            const y = activator.clientY + event.delta.y;
            updateInteraction(x, y);
        },
        [updateInteraction]
    );

    const handleDragEnd = useCallback(
        (event: DragEndEvent) => {
            const { active, over } = event;
            setActiveId(null);
            cleanupInteraction();

            if (!over) return;

            const cardId = active.id as number;
            let overIdString = String(over.id);

            // If dropped on another card, resolve to its slot
            if (!overIdString.startsWith('slot_')) {
                const cardIdAtOver = over.id as number;
                const placedCard = responses.qsort.find((c) => c.statementId === cardIdAtOver);
                if (placedCard) {
                    overIdString = `slot_${placedCard.col}_${placedCard.row}`;
                }
            }

            if (overIdString.startsWith('slot_')) {
                const parts = overIdString.split('_');
                if (parts.length === 3) {
                    const col = parseInt(parts[1]);
                    const row = parseInt(parts[2]);
                    handlePlacement(cardId, col, row);
                }
            }
        },
        [responses.qsort, handlePlacement, cleanupInteraction]
    );

    const handleCardClick = useCallback(
        (id: number) => {
            onSelectionChange?.(id === selectedId ? null : id);
        },
        [onSelectionChange, selectedId]
    );

    const handleSlotClick = useCallback(
        (col: number, row: number) => {
            if (selectedId === null || selectedId === undefined) return;
            handlePlacement(selectedId, col, row);
            onSelectionChange?.(null);
        },
        [selectedId, handlePlacement, onSelectionChange]
    );

    return {
        activeId,
        handleDragStart,
        handleDragMove,
        handleDragEnd,
        findClosestEmptyRow,
        handleCardClick,
        handleSlotClick,
    };
};
