export const isPilot = (): boolean => {
    try {
        const params = new URLSearchParams(window.location.search);
        if (params.get('mode') === 'test') {
            sessionStorage.setItem('libre-q-pilot-mode', 'true');
            return true;
        }
        return sessionStorage.getItem('libre-q-pilot-mode') === 'true';
    } catch {
        return false;
    }
};

export const clearPilotFlag = (): void => {
    try {
        sessionStorage.removeItem('libre-q-pilot-mode');
    } catch {
        /* ignore */
    }
};
