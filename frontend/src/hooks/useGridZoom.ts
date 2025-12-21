import { useRef, useCallback, useEffect } from 'react';
import type { ReactZoomPanPinchRef } from 'react-zoom-pan-pinch';

interface UseGridZoomProps {
    wrapperRef: React.RefObject<HTMLDivElement>;
    contentRef: React.RefObject<HTMLDivElement>;
    pyramidRef: React.RefObject<HTMLDivElement>;
    gridColumns: { score: number; capacity: number }[];
    activePile: 'agree' | 'disagree' | 'neutral';
    hasPerformedZonalFocus: boolean;
    setDimmingActive: (active: boolean) => void;
}

export const useGridZoom = ({
    wrapperRef,
    contentRef,
    pyramidRef,
    gridColumns,
    activePile,
    hasPerformedZonalFocus,
    setDimmingActive,
    onZoomChange
}: UseGridZoomProps & { onZoomChange?: (scale: number) => void }) => {
    const transformRef = useRef<ReactZoomPanPinchRef>(null);

    const onTransformed = useCallback((ref: ReactZoomPanPinchRef, state: { scale: number }) => {
        onZoomChange?.(state.scale);
    }, [onZoomChange]);

    const performAutoFit = useCallback(() => {
        if (!transformRef.current || !wrapperRef.current || !contentRef.current) return;
        const wrapper = wrapperRef.current;
        const content = contentRef.current;
        const wrapperW = wrapper.clientWidth;
        const wrapperH = wrapper.clientHeight;
        const contentW = content.offsetWidth;
        const contentH = content.offsetHeight;
        if (contentW === 0 || contentH === 0) return;

        const isMobile = window.innerWidth < 1024;
        
        let scale: number, x: number, y: number;

        if (isMobile) {
            const widthScale = (wrapperW * 0.98) / contentW;
            const heightScale = (wrapperH * 0.92) / contentH;
            scale = Math.min(widthScale, Math.max(heightScale, widthScale * 0.75));
            x = (wrapperW - (contentW * scale)) / 2;
            y = wrapperH - (contentH * scale) - 2;
        } else {
            const padding = 100;
            const availableW = wrapperW - padding;
            const availableH = wrapperH - padding;
            const scaleX = availableW / contentW;
            const scaleY = availableH / contentH;
            scale = Math.min(scaleX, scaleY, 1.1);
            
            x = (wrapperW - (contentW * scale)) / 2;
            y = (wrapperH - (contentH * scale)) / 2;

            if (pyramidRef.current) {
                const pyramid = pyramidRef.current;
                const pyramidOffsetLeft = pyramid.offsetLeft;
                // Center the pyramid specifically if possible/needed, but general centering usually works better
                // Using the original logic's refinement:
                 const pyramidW = pyramid.offsetWidth;
                 x = (wrapperW / 2) - ((pyramidOffsetLeft + (pyramidW / 2)) * scale);
            }
        }
        
        transformRef.current.setTransform(x, y, scale, 200);
    }, [wrapperRef, contentRef, pyramidRef]);

    const zoomIn = useCallback(() => {
        if (transformRef.current) {
            transformRef.current.zoomIn(0.2);
        }
    }, []);

    const zoomOut = useCallback(() => {
        if (transformRef.current) {
            transformRef.current.zoomOut(0.2);
        }
    }, []);

    // Zonal Focus Logic
    useEffect(() => {
        if (!hasPerformedZonalFocus || !transformRef.current) return;

        const timer = setTimeout(() => {
             if (!transformRef.current || !wrapperRef.current || !contentRef.current || !pyramidRef.current) return;
             
             const isMobile = window.innerWidth < 1024;
             if (!isMobile) return; // Disable zonal focus on desktop as it annoys users usually, keeping it mobile or strictly optional

             // Simplified Zonal Logic to avoid jumping if user already interacted?
             // For now, we keep the original logic but guarded by mobile check/preference
             
             let targetId = '';
             const baseScores = gridColumns.map(c => c.score).sort((a,b) => a - b);
             const minScore = baseScores[0];
             const maxScore = baseScores[baseScores.length - 1];

             if (activePile === 'disagree') {
                 targetId = `column-${Math.min(minScore + 1, -1)}`; 
             } else if (activePile === 'agree') {
                 targetId = `column-${Math.max(maxScore - 1, 1)}`;
             } else {
                 return; // No zonal focus for neutral
             }
             
             // Fallbacks
             if (!document.getElementById(targetId)) targetId = 'column-0'; 

             const targetNode = document.getElementById(targetId);
             if (targetNode) {
                 const state = transformRef.current.instance.transformState;
                 // Don't zoom if user has already zoomed in significantly?
                 if (state.scale > 1.2) return;

                 const targetScale = state.scale * 1.5;
                 const wrapperW = wrapperRef.current.clientWidth;
                 const wrapperH = wrapperRef.current.clientHeight;
                 const pyramid = pyramidRef.current;
                 const pyramidOffsetLeft = pyramid.offsetLeft;
                 const targetColumnCenter = targetNode.offsetLeft + (targetNode.offsetWidth / 2);
                 const targetX = (wrapperW / 2) - ((pyramidOffsetLeft + targetColumnCenter) * targetScale);
                 const contentH = contentRef.current.offsetHeight;
                 const targetY = wrapperH - (contentH * targetScale) - 20;

                 transformRef.current.setTransform(targetX, targetY, targetScale, 400, 'easeOut');
                 setDimmingActive(true);
                 setTimeout(() => setDimmingActive(false), 2000);
             }

        }, 500);

        return () => clearTimeout(timer);
    }, [activePile, hasPerformedZonalFocus, gridColumns, performAutoFit, setDimmingActive, wrapperRef, contentRef, pyramidRef]);

    return {
        transformRef,
        performAutoFit,
        zoomIn,
        zoomOut,
        onTransformed
    };
};
