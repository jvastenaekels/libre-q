import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ThumbsUp, ThumbsDown, Minus } from 'lucide-react';

// --- Configuration ---

// ROUGH SORT
// Targets relative from common center? No, let's keep relative to Deck.
// Deck is at (0,0).
// Targets (Up):
const ROUGH_TARGETS = [
    { x: -36, y: -60, pileId: 'disagree' },
    { x: 36, y: -60, pileId: 'agree' },
    { x: 0, y: -60, pileId: 'neutral' },
    { x: -36, y: -60, pileId: 'disagree' }
];

// FINE SORT
// 9 Steps.
const COL_W = 18; // Smaller width
const COL_GAP = 2; // Smaller gap
const COL_OFFSET = COL_W + COL_GAP;
const ROW_H = 26; // 24h + 2g for correct stacking

// Steps: { id, x, y, source }
// Source 0=Left, 1=Mid, 2=Right
// Grid Base (Row 0) Y position relative to Source Piles (Y=0).
// The grid container is h-32 (128px). Items are flex-end.
// Source piles are in a div below with pt-2 (8px).
// So distance from Source Top to Grid Bottom is roughly 8px gap + source border?
// Let's use a calibrated value.
const GRID_BASE_Y = -120; // Calibrated for smooth landing

const FINE_STEPS = [
    { id: 'L2_0', x: -2*COL_OFFSET, y: 0, source: 0 },
    { id: 'R2_0', x: 2*COL_OFFSET, y: 0, source: 2 },
    { id: 'L1_0', x: -1*COL_OFFSET, y: 0, source: 0 },
    { id: 'R1_0', x: 1*COL_OFFSET, y: 0, source: 2 },
    { id: 'C0_0', x: 0, y: 0, source: 1 },
    { id: 'L1_1', x: -1*COL_OFFSET, y: -ROW_H, source: 0 },
    { id: 'R1_1', x: 1*COL_OFFSET, y: -ROW_H, source: 2 },
    { id: 'C0_1', x: 0, y: -ROW_H, source: 1 },
    { id: 'C0_2', x: 0, y: -ROW_H*2, source: 1 },
];

const SortingAnimation: React.FC = () => {
    const [phase, setPhase] = useState<'ROUGH' | 'FINE'>('ROUGH');
    const [step, setStep] = useState(0);

    const ROUGH_DURATION = 0.6;
    const FINE_DURATION = 0.6;
    const PAUSE = 1000;

    useEffect(() => {
        let timer: ReturnType<typeof setTimeout>;
        if (phase === 'ROUGH') {
            if (step < ROUGH_TARGETS.length) {
                timer = setTimeout(() => setStep(s => s + 1), ROUGH_DURATION * 1000 + 200);
            } else {
                timer = setTimeout(() => { setPhase('FINE'); setStep(0); }, PAUSE);
            }
        } else {
            if (step < FINE_STEPS.length) {
                timer = setTimeout(() => setStep(s => s + 1), FINE_DURATION * 1000 + 100);
            } else {
                timer = setTimeout(() => { setPhase('ROUGH'); setStep(0); }, PAUSE);
            }
        }
        return () => clearTimeout(timer);
    }, [phase, step]);

    // --- Derived Counts for ROUGH ---
    // Deck: Total - Step (But clamps at 0)
    const roughDeckCount = Math.max(0, ROUGH_TARGETS.length - step);
    
    // Piles: Count how many of each type have been *completed* (step > targetIndex)
    const roughPileCounts = useMemo(() => {
        const counts = { disagree: 0, neutral: 0, agree: 0 };
        // We only count cards that have finished flying? Or start flying?
        // Let's say they land when step increments. So if step=1, card 0 has landed.
        for (let i = 0; i < step; i++) {
            if (i < ROUGH_TARGETS.length) {
                const pid = ROUGH_TARGETS[i].pileId as keyof typeof counts;
                counts[pid]++;
            }
        }
        return counts;
    }, [step]);

    // --- Derived Counts for FINE ---
    const fineSourceCounts = useMemo(() => {
        // Initial totals based on usage in FINE_STEPS
        const totals = [0, 0, 0];
        FINE_STEPS.forEach(s => totals[s.source]++);
        
        // Subtract used
        for (let i = 0; i < step; i++) {
             if (i < FINE_STEPS.length) totals[FINE_STEPS[i].source]--;
        }
        return totals;
    }, [step]);

    const fineFilledIds = useMemo(() => {
        const filled = new Set<string>();
        if (phase === 'FINE') {
            for (let i = 0; i < step; i++) filled.add(FINE_STEPS[i].id);
        }
        return filled;
    }, [phase, step]);

    // Active Targets
    const activeRoughTarget = phase === 'ROUGH' && step < ROUGH_TARGETS.length ? ROUGH_TARGETS[step] : null;
    const activeFineStep = phase === 'FINE' && step < FINE_STEPS.length ? FINE_STEPS[step] : null;

    // Fine card flying positions
    const fineSourceX = activeFineStep ? (activeFineStep.source === 0 ? -36 : activeFineStep.source === 2 ? 36 : 0) : 0;
    const fineTargetX = activeFineStep ? activeFineStep.x : 0;
    const fineTargetY = activeFineStep ? (GRID_BASE_Y + activeFineStep.y) : 0;

    return (
        <div className="w-full flex justify-center items-end gap-16 sm:gap-24 py-6 select-none pointer-events-none" aria-hidden="true">
            
            {/* --- ROUGH SORT (Compact) --- */}
            <div className={`relative flex flex-col items-center gap-8 transition-opacity duration-1000 z-10 ${phase === 'ROUGH' ? 'opacity-100' : 'opacity-40 blur-[1px]'}`}>
                {/* Background Number */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[120px] font-bold text-slate-100/80 -z-10 leading-none">1</div>
                
                {/* Piles */}
                <div className="flex gap-3">
                    <DynamicStack count={roughPileCounts.disagree} icon={ThumbsDown} type="pile" />
                    <DynamicStack count={roughPileCounts.neutral} icon={Minus} type="pile" />
                    <DynamicStack count={roughPileCounts.agree} icon={ThumbsUp} type="pile" />
                </div>
                {/* Deck */}
                <div className="relative">
                    <DynamicStack count={roughDeckCount} type="deck" />
                    <AnimatePresence>
                        {activeRoughTarget && (
                            <motion.div
                                key={`rough-fly-${step}`}
                                initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                                animate={{ x: activeRoughTarget.x, y: activeRoughTarget.y, scale: 0.9 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: ROUGH_DURATION, ease: "easeInOut" }}
                                className="absolute top-0 left-0 w-8 h-11 bg-slate-100 border border-slate-400 rounded-sm shadow-md z-50 pointer-events-none"
                            />
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* --- FINE SORT (Compact) --- */}
            <div className={`relative flex flex-col items-center gap-2 transition-opacity duration-1000 z-10 ${phase === 'FINE' ? 'opacity-100' : 'opacity-40 blur-[1px]'}`}>
                {/* Background Number */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[120px] font-bold text-slate-100/80 -z-10 leading-none">2</div>

                 {/* Grid */}
                 <div className="flex items-end gap-[2px] mb-4">

                    <div className="flex flex-col gap-[2px]"><MiniSlot filled={fineFilledIds.has('L2_0')} /></div>
                    <div className="flex flex-col gap-[2px]"><MiniSlot filled={fineFilledIds.has('L1_1')} /><MiniSlot filled={fineFilledIds.has('L1_0')} /></div>
                    <div className="flex flex-col gap-[2px]"><MiniSlot filled={fineFilledIds.has('C0_2')} /><MiniSlot filled={fineFilledIds.has('C0_1')} /><MiniSlot filled={fineFilledIds.has('C0_0')} /></div>
                    <div className="flex flex-col gap-[2px]"><MiniSlot filled={fineFilledIds.has('R1_1')} /><MiniSlot filled={fineFilledIds.has('R1_0')} /></div>
                    <div className="flex flex-col gap-[2px]"><MiniSlot filled={fineFilledIds.has('R2_0')} /></div>
                 </div>

                 {/* Source Piles */}
                 <div className="relative flex gap-6 pt-2">
                     <DynamicStack count={fineSourceCounts[0]} icon={ThumbsDown} type="source" />
                     <DynamicStack count={fineSourceCounts[1]} icon={Minus} type="source" />
                     <DynamicStack count={fineSourceCounts[2]} icon={ThumbsUp} type="source" />

                     {/* Flying Card Overlay */}
                     <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0 h-0">
                        <AnimatePresence>
                            {activeFineStep && (
                                <motion.div
                                    key={`fine-fly-${step}`}
                                    initial={{ x: fineSourceX, y: 0, opacity: 1 }}
                                    animate={{ x: fineTargetX, y: fineTargetY }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: FINE_DURATION, ease: "easeInOut" }}
                                    className="absolute top-0 left-[-9px] w-[18px] h-[24px] bg-slate-200 border border-slate-400 rounded-[2px] shadow-sm z-50 pointer-events-none"
                                />
                            )}
                        </AnimatePresence>
                     </div>
                 </div>
            </div>

        </div>
    );
};

// --- Sub-Components ---

const MiniSlot = ({ filled }: { filled: boolean }) => (
    <div className={`w-[18px] h-[24px] rounded-[2px] border ${filled ? 'bg-slate-300 border-slate-400' : 'bg-white border-slate-200'} transition-colors duration-300 shadow-sm`} /> 
);

interface StackProps {
    count: number;
    icon?: React.ElementType;
    type: 'deck' | 'pile' | 'source';
}

const DynamicStack: React.FC<StackProps> = ({ count, icon: Icon, type }) => {
    // Determine visual style based on type
    const isSource = type === 'source';
    
    // Base dimensions
    // Consistency: Rough Sort uses "Big Cards". Fine Sort uses "Small Cards".
    
    const isSmall = isSource; // Fine sort uses small cards
    const width = isSmall ? 'w-[18px]' : 'w-8';
    const height = isSmall ? 'h-[24px]' : 'h-11';
    
    return (
        <div className={`relative ${width} ${height} flex-shrink-0 transition-opacity duration-300 ${count === 0 ? 'opacity-50' : 'opacity-100'}`}>
            {/* Placeholder / Empty Slot border */}
            <div className={`absolute inset-0 border-2 border-dashed border-slate-300 rounded-[3px] ${count === 0 ? 'block' : 'hidden'}`} />
            
            {/* Stack Layers */}
            {count > 2 && (
                <div className={`absolute top-0 left-0 ${width} ${height} bg-white border border-slate-300 rounded-[3px] shadow-sm translate-x-[3px] -translate-y-[3px] z-0`} />
            )}
            {count > 1 && (
                <div className={`absolute top-0 left-0 ${width} ${height} bg-white border border-slate-300 rounded-[3px] shadow-sm translate-x-[1.5px] -translate-y-[1.5px] z-10`} />
            )}
            {/* Top Card */}
            {count > 0 && (
                <div className={`absolute top-0 left-0 ${width} ${height} bg-white border border-slate-400 rounded-[3px] shadow-sm z-20 flex items-center justify-center`}>
                    {Icon && <Icon size={isSmall ? 10 : 14} className="text-slate-400" />}
                    {!Icon && !isSmall && <div className="w-5 h-8 border border-slate-100 rounded-[2px]" />}
                </div>
            )}
        </div>
    );
};

export default SortingAnimation;
