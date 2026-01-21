import { useRef, useState } from 'react';
import { Upload, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useStudyDesigner } from '@/store/useStudyDesigner';
import { cn } from '@/lib/utils';

interface ImportConfigButtonProps {
    variant?: 'default' | 'outline' | 'ghost' | 'secondary' | 'destructive' | 'link';
    className?: string;
    showText?: boolean;
    disabled?: boolean;
}

/**
 * Button component to import study configuration from a JSON file
 */
export function ImportConfigButton({
    variant = 'outline',
    className,
    showText = true,
    disabled = false,
}: ImportConfigButtonProps) {
    const { t } = useTranslation();
    const [isImporting, setIsImporting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const importConfig = useStudyDesigner((state) => state.importConfig);

    const handleButtonClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        // Reset input so the same file can be uploaded again if needed
        event.target.value = '';

        if (file.type !== 'application/json' && !file.name.endsWith('.json')) {
            toast.error(
                t('admin.import.invalid_type', 'Invalid file type. Please upload a JSON file.')
            );
            return;
        }

        try {
            setIsImporting(true);
            const content = await file.text();
            const config = JSON.parse(content);

            // Basic validation: must have some study-related fields
            const studyData = config.study || config;
            if (!studyData.translations && !studyData.statements && !studyData.grid_config) {
                throw new Error('Invalid study configuration format');
            }

            importConfig(config);
            toast.success(t('admin.import.success', 'Configuration imported successfully'));
        } catch (error: unknown) {
            console.error('Import failed:', error);
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            toast.error(t('admin.import.error', 'Failed to import configuration'), {
                description: errorMsg,
            });
        } finally {
            setIsImporting(false);
        }
    };

    return (
        <>
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".json,application/json"
                className="hidden"
            />
            <Button
                variant={variant}
                className={className}
                onClick={handleButtonClick}
                disabled={isImporting || disabled}
                title={!showText ? t('admin.import.config', 'Import Configuration') : undefined}
            >
                {isImporting ? (
                    <>
                        <Loader2 className={cn('h-4 w-4 animate-spin', showText && 'mr-2')} />
                        {showText && t('admin.import.importing', 'Importing...')}
                    </>
                ) : (
                    <>
                        <Upload className={cn('h-4 w-4', showText && 'mr-2')} />
                        {showText && t('admin.import.config', 'Import Configuration')}
                    </>
                )}
            </Button>
        </>
    );
}
