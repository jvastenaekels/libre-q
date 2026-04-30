import { toast } from 'sonner';
import { ApiError, reportBug } from './client';
import { useAuthStore } from '../store/useAuthStore';
import { useSessionStore } from '../store/useSessionStore';
import { useResponseStore } from '../store/useResponseStore';

// Re-using the logic from client.ts but adaptable for Orval's signature
const getBaseUrl = () => {
    try {
        return import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || '';
    } catch {
        return '';
    }
};
export const BASE_URL = getBaseUrl();

interface ParsedErrorBody {
    message: string;
    code?: string;
    details?: unknown;
}

/** Parse the body of an error response. Falls back to the raw text if not JSON. */
function parseErrorBody(errorText: string): ParsedErrorBody {
    try {
        const parsed = JSON.parse(errorText);
        let message = errorText;
        if (parsed.message) {
            message = parsed.message;
        } else if (parsed.detail) {
            message =
                typeof parsed.detail === 'string' ? parsed.detail : JSON.stringify(parsed.detail);
        }
        return {
            message,
            code: parsed.code,
            details: parsed.details,
        };
    } catch {
        return { message: errorText };
    }
}

function buildRequestHeaders(
    data: unknown,
    token: string | null | undefined,
    projectId: string | undefined,
    headers: HeadersInit | undefined
): Record<string, string> {
    const isFormData = data instanceof URLSearchParams || data instanceof FormData;
    const requestHeaders: Record<string, string> = {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(projectId ? { 'X-Project-ID': projectId } : {}),
        ...(headers as Record<string, string>),
    };

    // FormData: let the browser set Content-Type (with boundary). A manual
    // multipart/form-data header would kill the boundary and break parsing.
    if (isFormData) {
        if (requestHeaders['Content-Type']?.includes('multipart/form-data')) {
            delete requestHeaders['Content-Type'];
        }
    } else if (!requestHeaders['Content-Type']) {
        requestHeaders['Content-Type'] = 'application/json';
    }
    return requestHeaders;
}

/** Side effects (toasts, redirect, bug-report) for error responses. */
function handleErrorStatus(
    status: number,
    url: string,
    errorText: string,
    parsedMessage: string
): void {
    if (status === 401 && !url.includes('/api/token') && !url.includes('/api/study/')) {
        // biome-ignore lint/suspicious/noExplicitAny: window hack to suppress unsaved-changes dialog
        (window as any).__isAutoLogout = true;

        // Distinguish "had a token, lost it" (session_expired) from
        // "never authenticated" (auth_required) — the latter occurs
        // when a cold visitor opens /admin and is bounced through 401.
        const hadToken = useAuthStore.getState().token !== null;
        useAuthStore.getState().logout();
        useSessionStore.getState().resetSession();
        useResponseStore.getState().resetResponses();
        if (!window.location.pathname.includes('/login')) {
            const reason = hadToken ? 'session_expired' : 'auth_required';
            window.location.href = `/login?reason=${reason}`;
        }
    }

    if (status === 403) {
        console.warn('Access Forbidden:', url);
        toast.error('Access Denied', {
            description: 'You do not have permission to perform this action.',
        });
    }
    if (status === 429) {
        toast.error('Too Many Requests', {
            description: 'Please wait a moment before trying again.',
        });
    }
    if (status === 409) {
        toast.error('Conflict', {
            description: parsedMessage || 'The resource has been modified or already exists.',
        });
    }
    if (status >= 500) {
        reportBug(`Server Error ${status} at ${url}: ${errorText}`, {
            endpoint: url,
            status,
        });
    }
}

function buildRequestBody(data: unknown, isFormData: boolean): BodyInit | undefined {
    if (!data) return undefined;
    return isFormData ? (data as BodyInit) : JSON.stringify(data);
}

async function processResponse<T>(response: Response, url: string): Promise<T> {
    if (!response.ok) {
        const errorText = await response.text();
        const { message, code, details } = parseErrorBody(errorText);
        handleErrorStatus(response.status, url, errorText, message);
        throw new ApiError(response.status, message, code, details);
    }
    if (response.status === 204) {
        return {} as T;
    }
    return response.json();
}

export const customInstance = async <T>({
    url,
    method,
    params,
    data,
    headers,
    signal,
}: {
    url: string;
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    params?: Record<string, string | number | boolean | undefined | null>;
    data?: unknown;
    headers?: HeadersInit;
    signal?: AbortSignal;
}): Promise<T> => {
    const cleanParams = Object.fromEntries(
        Object.entries(params || {}).filter(([_, v]) => v !== undefined && v !== null)
    ) as Record<string, string>;
    const query = new URLSearchParams(cleanParams).toString();
    const fullUrl = `${BASE_URL}${url}${query ? `?${query}` : ''}`;

    const adminToken = useAuthStore.getState().token;
    const sessionToken = useSessionStore.getState().token;
    const token = adminToken || sessionToken;

    const currentProject = useAuthStore.getState().currentProject;
    const projectId = currentProject?.id ? String(currentProject.id) : undefined;

    const timeout = 30000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    if (signal) {
        signal.addEventListener('abort', () => controller.abort());
    }

    try {
        const isFormData = data instanceof URLSearchParams || data instanceof FormData;
        const requestHeaders = buildRequestHeaders(data, token, projectId, headers);

        const response = await fetch(fullUrl, {
            method,
            headers: requestHeaders,
            body: buildRequestBody(data, isFormData),
            signal: controller.signal,
        });

        clearTimeout(timeoutId);
        return await processResponse<T>(response, url);
    } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
            // External-signal abort vs our own timeout
            if (signal?.aborted) throw error;
            throw new ApiError(408, 'Request timed out', 'timeout');
        }
        throw error;
    } finally {
        clearTimeout(timeoutId);
    }
};
