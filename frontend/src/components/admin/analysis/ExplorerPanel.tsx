/*
 * Qualis - Open-source platform for conducting Q-methodology research
 * Copyright (C) 2025 Julien Vastenekels
 * Licensed under the GNU Affero General Public License v3.0 or later.
 */

import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Play, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Accordion,
    AccordionItem,
    AccordionTrigger,
    AccordionContent,
} from '@/components/ui/accordion';
import { ScreeWithDiagnostics } from './ScreeWithDiagnostics';
import { PreviewRangeTable } from './PreviewRangeTable';
import type { ExplorePhaseApi } from '@/hooks/admin/useExplorePhase';

interface Props {
    explore: ExplorePhaseApi;
    /**
     * Slot for the legacy advanced configuration controls
     * (extraction / rotation / flagging / bootstrap / manual flags / manual
     * rotations). Hosted by ExploreShell so this panel stays focused on the
     * new Phase 3 surfaces. Pass null/undefined and the accordion is hidden.
     */
    advancedContent?: React.ReactNode;
}

export function ExplorerPanel({ explore, advancedContent }: Props) {
    const { t } = useTranslation();

    // Auto-fetch a sensible preview range on mount (or when the gate flips
    // from disabled to enabled). Range covers k = 2 .. min(6, maxFactors).
    useEffect(() => {
        if (
            explore.canPreviewRange &&
            explore.previewRows === undefined &&
            !explore.isPreviewing &&
            explore.maxFactors >= 2
        ) {
            const length = Math.min(5, explore.maxFactors - 1);
            const range = Array.from({ length }, (_, i) => i + 2);
            void explore.handlePreviewRange(range);
        }
    }, [
        explore.canPreviewRange,
        explore.previewRows,
        explore.isPreviewing,
        explore.maxFactors,
        explore.handlePreviewRange,
    ]);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ScreeWithDiagnostics
                eigenvalues={explore.eigenvalues ?? []}
                kaiserN={explore.kaiserN ?? 1}
                parallelN={explore.parallelN ?? 1}
                mapN={explore.mapN ?? 1}
                selectedNFactors={explore.nFactors}
                onSelectNFactors={explore.setNFactors}
            />
            <PreviewRangeTable
                rows={explore.previewRows ?? []}
                onSelect={explore.setNFactors}
                disabled={!explore.canPreviewRange}
            />
            {advancedContent !== undefined && (
                <div className="lg:col-span-2">
                    <Accordion type="single" collapsible>
                        <AccordionItem value="advanced">
                            <AccordionTrigger>
                                {t(
                                    'admin.analysis.explore.advanced_title',
                                    'Advanced configuration'
                                )}
                            </AccordionTrigger>
                            <AccordionContent>{advancedContent}</AccordionContent>
                        </AccordionItem>
                    </Accordion>
                </div>
            )}
            <div className="lg:col-span-2">
                <Button
                    onClick={explore.handleRunAnalysis}
                    disabled={explore.isRunning || explore.isJudgmentalWithoutRotations}
                    size="lg"
                    className="w-full sm:w-auto"
                >
                    {explore.isRunning ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <Play className="mr-2 h-4 w-4" />
                    )}
                    {t('admin.analysis.explore.commit_cta', 'Commit and interpret')}
                </Button>
            </div>
        </div>
    );
}
