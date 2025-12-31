/*
 * Open-Q - Open-source platform for conducting Q-methodology research
 * Copyright (C) 2025 Julien Vastenekels
 * Licensed under the GNU Affero General Public License v3.0 or later.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

interface GridColumn {
    score: number;
    capacity: number;
}

interface UseGridCalculationsProps {
    gridColumns: GridColumn[];
    selectedCardId?: number | null;
    onDimensionsChange?: (dimensions: { width: number; height: number }) => void;
}

export const useGridCalculations = ({
    gridColumns,
    selectedCardId,
    onDimensionsChange,
}: UseGridCalculationsProps) => {
    const wrapperRef = useRef<HTMLDivElement>(null);
    const [cardDimensions, setCardDimensions] = useState({ width: 160, height: 96 });

    const calculateOptimalSize = useCallback(() => {
        if (!wrapperRef.current) return;

        // Grid Anchoring: Do not resize cards when in Mobile Focus Mode (Deck Collapsed)
        // This prevents "Layout Thrashing" / Chaos.
        if (selectedCardId && window.innerWidth < 1024) return;

        const wrapper = wrapperRef.current;
        const W = wrapper.clientWidth;
        const H = wrapper.clientHeight;
        if (W === 0 || H === 0) return;

        const numCols = gridColumns.length;
        if (numCols === 0) return;

        const maxRows = Math.max(...gridColumns.map((c) => c.capacity || 0));
        if (maxRows === 0) return;

        const screenRatio = W / H;
        const gridStructureRatio = maxRows / numCols;
        const rawGridRatio = screenRatio * gridStructureRatio;
        const goldenRatio = 1.6;

        let targetCardRatio = (rawGridRatio + goldenRatio) / 2;
        targetCardRatio = Math.max(1.0, Math.min(targetCardRatio, 2.2));

        const targetArea = 160 * 96;
        const newWidth = Math.sqrt(targetArea * targetCardRatio);
        const newHeight = targetArea / newWidth;

        setCardDimensions((prev) => {
            if (Math.abs(prev.width - newWidth) < 1.5 && Math.abs(prev.height - newHeight) < 1.5)
                return prev;
            const next = { width: newWidth, height: newHeight };
            onDimensionsChange?.(next);
            return next;
        });
    }, [gridColumns, onDimensionsChange, selectedCardId]);

    // Initial Calculation and responsive trigger
    useEffect(() => {
        // Only calculate if NOT in focus mode (anchoring)
        if (!selectedCardId || window.innerWidth >= 1024) {
            calculateOptimalSize();
        }
    }, [selectedCardId, calculateOptimalSize]);

    // Resize Observer
    useEffect(() => {
        const wrapper = wrapperRef.current;
        if (!wrapper) return;

        let rafId: number;
        const observer = new ResizeObserver(() => {
            cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(() => {
                calculateOptimalSize();
            });
        });

        observer.observe(wrapper);
        return () => {
            observer.disconnect();
            cancelAnimationFrame(rafId);
        };
    }, [calculateOptimalSize]);

    return {
        wrapperRef,
        cardDimensions,
        calculateOptimalSize,
    };
};
