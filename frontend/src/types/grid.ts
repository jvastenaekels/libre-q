import type { ReactZoomPanPinchRef } from 'react-zoom-pan-pinch';
import React from 'react';

export interface DragCard {
    statementId: number;
    col: number;
    row: number;
}

export interface InteractionUtils {
    zoomIn: (step?: number) => void;
    zoomOut: (step?: number) => void;
    performAutoFit: () => void;
    transformRef: React.RefObject<ReactZoomPanPinchRef>;
    wrapperRef: React.RefObject<HTMLDivElement>;
    contentRef: React.RefObject<HTMLDivElement>;
}
