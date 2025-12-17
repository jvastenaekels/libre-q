import { ApiError } from './client';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export async function get<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        },
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new ApiError(response.status, errorText || 'Request failed');
    }

    return response.json();
} 
