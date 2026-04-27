import { renderWithProviders, screen, waitFor } from '@/test-utils/test-utils';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ProjectSettingsPage from './ProjectSettingsPage';
import { useAuthStore } from '@/store/useAuthStore';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// react-hook-form v7.68.0 + React 19 + happy-dom triggers a useLayoutEffect
// infinite loop when real useForm / FormProvider / Controller are used.
// Stub the form layer to DOM-only stubs so the test can render.
vi.mock('@/components/ui/form', () => ({
    Form: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    FormControl: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    FormDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
    FormField: ({
        render,
    }: {
        render: (p: {
            field: {
                value: string;
                onChange: () => void;
                onBlur: () => void;
                ref: () => void;
                name: string;
            };
        }) => React.ReactNode;
    }) => (
        <div>
            {render({
                field: {
                    value: '',
                    onChange: vi.fn(),
                    onBlur: vi.fn(),
                    ref: vi.fn(),
                    name: 'field',
                },
            })}
        </div>
    ),
    FormItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    // biome-ignore lint/a11y/noLabelWithoutControl: test stub only
    FormLabel: ({ children }: { children: React.ReactNode }) => <label>{children}</label>,
    FormMessage: () => null,
}));

vi.mock('react-hook-form', () => ({
    useForm: vi.fn(() => ({
        register: vi.fn(() => ({
            name: 'f',
            ref: vi.fn(),
            onChange: vi.fn(),
            onBlur: vi.fn(),
        })),
        handleSubmit: vi.fn(() => vi.fn()),
        reset: vi.fn(),
        control: {},
        formState: { errors: {}, isSubmitting: false },
    })),
    Controller: ({
        render,
    }: {
        render: (p: { field: { value: string; onChange: () => void } }) => React.ReactNode;
    }) => <div>{render({ field: { value: '', onChange: vi.fn() } })}</div>,
    FormProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@hookform/resolvers/zod', () => ({ zodResolver: vi.fn(() => vi.fn()) }));

// Radix Select triggers the same compose-refs loop — stub it too
vi.mock('@/components/ui/select', () => ({
    Select: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    SelectTrigger: ({ children }: { children: React.ReactNode }) => (
        <button type="button">{children}</button>
    ),
    SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => (
        <div data-value={value}>{children}</div>
    ),
    SelectValue: () => null,
}));

const { removeMember, refetchMembers } = vi.hoisted(() => ({
    removeMember: vi.fn().mockResolvedValue({}),
    refetchMembers: vi.fn(),
}));

vi.mock('@/api/generated', () => ({
    useGetProjectApiAdminProjectsSlugGet: () => ({
        data: { id: 1, slug: 'demo', title: 'Demo Project' },
        isLoading: false,
    }),
    useListProjectMembersApiAdminProjectsSlugMembersGet: () => ({
        data: {
            items: [
                {
                    user_id: 11,
                    role: 'researcher',
                    joined_at: '2024-01-01T00:00:00Z',
                    user: { full_name: 'Ada Lovelace', email: 'ada@x.io' },
                },
                {
                    user_id: 12,
                    role: 'owner',
                    joined_at: '2024-01-01T00:00:00Z',
                    user: { full_name: 'Grace Hopper', email: 'grace@x.io' },
                },
            ],
        },
        isLoading: false,
        refetch: refetchMembers,
    }),
    useRemoveProjectMemberApiAdminProjectsSlugMembersUserIdDelete: () => ({
        mutateAsync: removeMember,
        isPending: false,
    }),
    useUpdateProjectApiAdminProjectsSlugPatch: () => ({
        mutateAsync: vi.fn(),
        isPending: false,
    }),
    useUpdateProjectMemberApiAdminProjectsSlugMembersUserIdPatch: () => ({
        mutateAsync: vi.fn(),
        isPending: false,
    }),
    useCreateInvitationApiAdminProjectsSlugInvitationsPost: () => ({
        mutateAsync: vi.fn(),
        isPending: false,
    }),
    getListProjectsApiAdminProjectsGetQueryKey: () => ['projects'],
}));

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
    return {
        ...actual,
        useLoaderData: () => ({ slug: 'demo' }),
        useNavigate: () => vi.fn(),
    };
});

describe('ProjectSettingsPage remove-member dialog', () => {
    beforeEach(() => {
        removeMember.mockReset().mockResolvedValue({});
        useAuthStore.setState({
            user: { id: 12, email: 'grace@x.io', is_superuser: false },
            isAuthenticated: true,
        });
    });

    it('opens an AlertDialog showing the member name and confirms removal', async () => {
        const user = userEvent.setup();
        renderWithProviders(<ProjectSettingsPage />);

        const removeBtn = await screen.findByRole('button', { name: /remove ada lovelace/i });
        await user.click(removeBtn);

        const dialog = await screen.findByRole('alertdialog');
        expect(dialog).toHaveTextContent(/ada lovelace/i);
        expect(removeMember).not.toHaveBeenCalled();

        await user.click(screen.getByRole('button', { name: /^remove$/i }));
        await waitFor(() =>
            expect(removeMember).toHaveBeenCalledWith({ slug: 'demo', userId: 11 })
        );
    });
});
