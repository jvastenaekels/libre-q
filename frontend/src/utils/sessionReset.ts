import { useSessionStore } from '../store/useSessionStore';
import { useConfigStore } from '../store/useConfigStore';
import { useResponseStore } from '../store/useResponseStore';
import { queryClient } from '../lib/queryClient';

interface ResetOptions {
    skipConfig?: boolean;
}

export const resetAllStores = (options: ResetOptions = {}) => {
    useSessionStore.getState().resetSession();
    if (!options.skipConfig) {
        useConfigStore.getState().resetConfig();
    }
    useResponseStore.getState().resetResponses();
    queryClient.clear();
};
