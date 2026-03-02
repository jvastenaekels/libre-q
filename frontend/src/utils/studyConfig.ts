import type { StudyConfig } from '../schemas/study';

export const isPresortEnabled = (config: StudyConfig | null): boolean => {
    if (!config?.presort_config) return true;
    if ('enabled' in config.presort_config) {
        return config.presort_config.enabled !== false;
    }
    return true;
};
