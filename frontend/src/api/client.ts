/*
 * Qualis - Open-source platform for conducting Q-methodology research
 * Copyright (C) 2025 Julien Vastenekels
 * Licensed under the GNU Affero General Public License v3.0 or later.
 */

/**
 * API Client
 *
 * Wrapper for fetch API to handle standard HTTP methods, error parsing, and automated bug reporting.
 */

import { toast } from 'sonner';

export class ApiError extends Error {
    status: number;
    code?: string;
    details?: unknown;

    constructor(status: number, message: string, code?: string, details?: unknown) {
        super(message);
        this.status = status;
        this.code = code;
        this.details = details;
        this.name = 'ApiError';
    }
}

const getBaseUrl = () => {
    try {
        return import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || '';
    } catch {
        return '';
    }
};
const BASE_URL = getBaseUrl();

// --- Error Reporting ---

interface ErrorContext {
    url?: string;
    userAgent?: string;
    [key: string]: unknown;
}

/**
 * Report an error to the backend logs.
 * Silently fails if reporting fails to avoid infinite loops.
 */
export async function reportBug(error: Error | string, context?: ErrorContext) {
    // Prevent recursive reporting (if the report endpoint itself fails)
    if (typeof error === 'string' && error.includes('/api/logs')) return;
    if (error instanceof Error && error.message.includes('/api/logs')) return;

    try {
        const message = error instanceof Error ? error.message : String(error);
        const stack = error instanceof Error ? error.stack : undefined;

        await fetch(`${BASE_URL}/api/logs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                level: 'error',
                message,
                stack,
                url: window.location.href,
                userAgent: navigator.userAgent,
                context,
            }),
            keepalive: true, // Ensure request is sent even if page unloads
        });
    } catch (e) {
        console.warn('Failed to report bug to /api/logs:', e);
    }
}

import { useAuthStore } from '../store/useAuthStore';
import { useSessionStore } from '../store/useSessionStore';

// Default export for axios-like usage in some older components
// Note: This is a shim to allow the project to build while we transition to Orval
export default {
    get: async (
        url: string,
        options?: RequestInit & {
            headers?: Record<string, string>;
            responseType?: string;
        }
    ) => request(url, { ...options, method: 'GET' }),

    post: async (
        url: string,
        data?: unknown,
        options?: RequestInit & { headers?: Record<string, string> }
    ) => request(url, { ...options, method: 'POST', body: JSON.stringify(data) }),

    patch: async (
        url: string,
        data?: unknown,
        options?: RequestInit & { headers?: Record<string, string> }
    ) => request(url, { ...options, method: 'PATCH', body: JSON.stringify(data) }),

    delete: async (url: string, options?: RequestInit & { headers?: Record<string, string> }) =>
        request(url, { ...options, method: 'DELETE' }),
};

interface ParsedErrorBody {
    message: string;
    code?: string;
    details?: unknown;
}

/**
 * Parse the body of an error response as JSON if possible, falling back to
 * status-specific shims for non-JSON gateway errors (502/504 HTML pages).
 */
function parseErrorBody(errorText: string, status: number): ParsedErrorBody {
    try {
        const parsed = JSON.parse(errorText);
        let message = errorText;
        if (parsed.message) {
            message = parsed.message;
        } else if (parsed.detail) {
            message =
                typeof parsed.detail === 'string' ? parsed.detail : JSON.stringify(parsed.detail);
        }
        return { message, code: parsed.code, details: parsed.details };
    } catch {
        if (status === 502) {
            return { message: 'Service unavailable (Bad Gateway)', code: 'bad_gateway' };
        }
        if (status === 504) {
            return { message: 'Gateway Timeout', code: 'gateway_timeout' };
        }
        return { message: errorText };
    }
}

/** Side effects (toasts, redirect) for error responses. */
function handleErrorStatus(status: number, url: string, message: string): void {
    if (status === 401 && !url.includes('/api/token')) {
        // Distinguish 'had a token, lost it' (session_expired) from 'never
        // authenticated' (auth_required).
        const hadToken = useAuthStore.getState().token !== null;
        useAuthStore.getState().logout();
        if (!window.location.pathname.includes('/login')) {
            const reason = hadToken ? 'session_expired' : 'auth_required';
            window.location.href = `/login?reason=${reason}`;
        }
    }
    if (status === 429) {
        toast.error('Too Many Requests', {
            description: 'Please wait a moment before trying again.',
        });
    }
    if (status === 409) {
        toast.error('Conflict', {
            description: message || 'The resource has been modified or already exists.',
        });
    }
}

async function processResponse(response: Response, url: string, responseType: string | undefined) {
    if (!response.ok) {
        const errorText = await response.text();
        const { message, code, details } = parseErrorBody(errorText, response.status);
        handleErrorStatus(response.status, url, message);
        throw new ApiError(response.status, message, code, details);
    }
    return {
        data: await (responseType === 'blob' ? response.blob() : response.json()),
    };
}

async function request(
    url: string,
    options: RequestInit & {
        headers?: Record<string, string>;
        responseType?: string;
    }
) {
    const fullUrl =
        url.startsWith('http') || url.startsWith('/api')
            ? `${BASE_URL}${url}`
            : `${BASE_URL}/api${url}`;

    const adminToken = useAuthStore.getState().token;
    const sessionToken = useSessionStore.getState().token;
    const token = adminToken || sessionToken;

    const currentProject = useAuthStore.getState().currentProject;
    const projectId = currentProject?.id ? String(currentProject.id) : undefined;

    const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(projectId ? { 'X-Project-ID': projectId } : {}),
        ...options?.headers,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    let response: Response;
    try {
        response = await fetch(fullUrl, {
            ...options,
            headers,
            signal: controller.signal,
        });
    } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
            throw new ApiError(408, 'Request timed out', 'timeout');
        }
        throw error;
    } finally {
        clearTimeout(timeoutId);
    }

    return processResponse(response, url, options?.responseType);
}
