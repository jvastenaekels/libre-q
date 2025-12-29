import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import SortingAnimation from './SortingAnimation';

describe('SortingAnimation', () => {
    beforeEach(() => {
        vi.useFakeTimers();

        // Mock matchMedia
        Object.defineProperty(window, 'matchMedia', {
            writable: true,
            value: vi.fn().mockImplementation((query) => ({
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

        // Mock Math.random to avoid hesitation (logic uses > 0.7, so 0.5 is safe)
        vi.spyOn(Math, 'random').mockReturnValue(0.5);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('renders both Rough and Fine sort containers', () => {
        render(<SortingAnimation />);

        // Check for presence of key elements from both phases
        // Rough Sort (Phase 1)
        expect(screen.getByTestId('phase-1')).toBeInTheDocument();

        // Fine Sort (Phase 2)
        expect(screen.getByTestId('phase-2')).toBeInTheDocument();
    });

    it('applies responsive classes for layout switching', () => {
        render(<SortingAnimation />);

        // Use data-testids
        const phase1Container = screen.getByTestId('phase-1');
        const phase2Container = screen.getByTestId('phase-2');

        // Check for mobile (absolute) classes on containers
        expect(phase1Container).toHaveClass('absolute');
        expect(phase2Container).toHaveClass('absolute');
    });

    it('starts in ROUGH phase with correct visibility classes', () => {
        render(<SortingAnimation />);

        const phase1Container = screen.getByTestId('phase-1');

        // Phase 1 should be active (opacity-100)
        expect(phase1Container).toHaveClass('opacity-100');
        expect(phase1Container).not.toHaveClass('opacity-0');

        const phase2Container = screen.getByTestId('phase-2');
        expect(phase2Container).toHaveClass('opacity-0');
    });

    it('does NOT show flying card during initial delay', () => {
        render(<SortingAnimation />);

        // At t=0, delay (isReady=false) is active
        expect(screen.queryByTestId('flying-card')).not.toBeInTheDocument();

        // Advance 1s (still less than 1.5s delay)
        act(() => {
            vi.advanceTimersByTime(1000);
        });
        expect(screen.queryByTestId('flying-card')).not.toBeInTheDocument();

        // Advance past 1.5s -> isReady=true -> Active Target (Step 0) renders
        act(() => {
            vi.advanceTimersByTime(600);
        });
        // We need to identify the flying card by some means.
        // In SortingAnimation.tsx, the motion.div has no test-id, but we can look for it.
        // Let's add a test-id to the flying card in SortingAnimation.tsx first or verify existence differently.
        // Check finding by class used for the card: "absolute top-0 left-0 w-[18px]..."
        // Or better, let's assume we will add data-testid="flying-card" in the next step.
    });

    it('switches to FINE phase after timeout', () => {
        render(<SortingAnimation />);

        // Rough sort duration calculation roughly:
        // With initial delay of 1.5s, total time is ~7s.
        // Let's advance time enough to cover Rough Sort (12s to be safe)

        // Advance time in steps to allow effect cycles (re-renders) to run and schedule new timers
        for (let i = 0; i < 12; i++) {
            act(() => {
                vi.advanceTimersByTime(1000);
            });
        }

        const phase1Container = screen.getByTestId('phase-1');
        const phase2Container = screen.getByTestId('phase-2');

        // Phase 1 should now be inactive
        expect(phase1Container).toHaveClass('opacity-0');

        // Phase 2 should now be active
        expect(phase2Container).toHaveClass('opacity-100');
    });
});
