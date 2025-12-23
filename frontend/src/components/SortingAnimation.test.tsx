import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import SortingAnimation from './SortingAnimation';

describe('SortingAnimation', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        
        // Mock matchMedia
        Object.defineProperty(window, 'matchMedia', {
            writable: true,
            value: vi.fn().mockImplementation(query => ({
                matches: false,
                media: query,
                onchange: null,
                addListener: vi.fn(), // deprecated
                removeListener: vi.fn(), // deprecated
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
                dispatchEvent: vi.fn(),
            })),
        });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('renders both Rough and Fine sort containers', () => {
        render(<SortingAnimation />);
        
        // Check for presence of key elements from both phases
        // Rough Sort (Phase 1)
        expect(screen.getByText('1')).toBeInTheDocument();
        
        // Fine Sort (Phase 2)
        expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('applies responsive classes for layout switching', () => {
        render(<SortingAnimation />);
        
        // Use a more specific query based on the structure we know
        const phase1Container = screen.getByText('1').closest('div')?.parentElement;
        const phase2Container = screen.getByText('2').closest('div')?.parentElement;

        // Check for mobile (absolute) and desktop (relative) classes on containers
        expect(phase1Container).toHaveClass('absolute', 'md:relative');
        expect(phase2Container).toHaveClass('absolute', 'md:relative');
    });

    it('starts in ROUGH phase with correct visibility classes', () => {
        render(<SortingAnimation />);

        const phase1Num = screen.getByText('1');
        const phase1Container = phase1Num.closest('div')?.parentElement;

        // Phase 1 should be active (opacity-100)
        expect(phase1Container).toHaveClass('opacity-100');
        expect(phase1Container).not.toHaveClass('opacity-0');

        const phase2Num = screen.getByText('2');
        const phase2Container = phase2Num.closest('div')?.parentElement;

        // Phase 2 should be inactive (hidden/dimmed) on mobile initially 
        // Note: Logic is 'opacity-0 scale-90' for inactive on mobile
        expect(phase2Container).toHaveClass('opacity-0');
    });

    it('switches to FINE phase after timeout', () => {
        render(<SortingAnimation />);

        // Rough sort duration calculation roughly:
        // 5 cards * (0.6s + 0.2s gap) + 1.2s pause = ~5.2s
        // Let's advance time enough to cover Rough Sort
        
        // Advance time in steps to allow effect cycles (re-renders) to run and schedule new timers
        // We need enough steps to cover the 5 items + pause.
        // 5 * 800ms + 1200ms = 5200ms.
        // Advancing 8 times by 1000ms should cover it safely.
        for (let i = 0; i < 8; i++) {
            act(() => {
                vi.advanceTimersByTime(1000);
            });
        }

        const phase1Container = screen.getByText('1').closest('div')?.parentElement;
        const phase2Container = screen.getByText('2').closest('div')?.parentElement;

        // Phase 1 should now be inactive
        expect(phase1Container).toHaveClass('opacity-0');
        
        // Phase 2 should now be active
        expect(phase2Container).toHaveClass('opacity-100');
    });
});
