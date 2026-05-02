import { renderWithProviders, screen, waitFor } from '@/test-utils/test-utils';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { Routes, Route } from 'react-router-dom';
import { AppSidebar } from './AppSidebar';
import { SidebarProvider } from '@/components/ui/sidebar';

vi.mock('@/hooks/useAuth', () => ({
    useAuth: () => ({ user: { id: 1, email: 'r@x.io', full_name: 'Ada Lovelace' } }),
}));
vi.mock('@/api/generated', async () => {
    const actual = await vi.importActual<Record<string, unknown>>('@/api/generated');
    return {
        ...actual,
        useListStudiesApiAdminStudiesGet: () => ({ data: { items: [] } }),
    };
});

function ProbePage() {
    return <div data-testid="account-page">account</div>;
}

describe('AppSidebar NavUser → Account settings', () => {
    it('navigates to /app/<projectSlug>/account when Account settings is clicked', async () => {
        renderWithProviders(
            <SidebarProvider>
                <Routes>
                    <Route path="/app/:projectSlug/dashboard" element={<AppSidebar />} />
                    <Route path="/app/:projectSlug/account" element={<ProbePage />} />
                </Routes>
            </SidebarProvider>,
            { initialEntries: ['/app/demo/dashboard'] }
        );

        await userEvent.click(screen.getByRole('button', { name: /ada lovelace/i }));
        await userEvent.click(screen.getByRole('menuitem', { name: /account settings/i }));

        await waitFor(() => expect(screen.getByTestId('account-page')).toBeInTheDocument());
    });
});
