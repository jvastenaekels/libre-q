import { renderWithProviders, screen } from '@/test-utils/test-utils';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { AdminDashboard } from './AdminDashboard';

// Hoisted mocks for generated API hooks
const {
    mockStudiesHook,
    mockConcoursesHook,
    mockConcourseDetailHook,
    mockTagsHook,
    mockMembersHook,
} = vi.hoisted(() => ({
    mockStudiesHook: vi.fn(),
    mockConcoursesHook: vi.fn(),
    mockConcourseDetailHook: vi.fn(),
    mockTagsHook: vi.fn(),
    mockMembersHook: vi.fn(),
}));

vi.mock('@/api/generated', () => ({
    useListStudiesApiAdminStudiesGet: mockStudiesHook,
    useListConcoursesApiAdminConcoursesGet: mockConcoursesHook,
    useGetConcourseApiAdminConcoursesConcourseIdGet: mockConcourseDetailHook,
    useListTagsApiAdminConcoursesTagsGet: mockTagsHook,
    useListProjectMembersApiAdminProjectsSlugMembersGet: mockMembersHook,
}));

// Mock stores
const mockCurrentProject = {
    id: 1,
    slug: 'test-project',
    title: 'Test Project',
    user_role: 'owner',
};

vi.mock('@/store/useAuthStore', () => ({
    useAuthStore: () => ({ currentProject: mockCurrentProject }),
}));

const mockSetActiveStudy = vi.fn();
vi.mock('@/store/useAdminStore', () => ({
    useAdminStore: () => ({ setActiveStudy: mockSetActiveStudy }),
}));

// Mock usePermission
vi.mock('@/hooks/usePermission', () => ({
    usePermission: () => ({ can: () => true }),
}));

// Mock child dialogs to avoid rendering complexity
vi.mock('@/components/admin/CreateStudyDialog', () => ({
    CreateStudyDialog: () => null,
}));
vi.mock('@/components/admin/ImportStudyDialog', () => ({
    ImportStudyDialog: () => null,
}));

// --- Helpers ---

const PROJECT_ID = 1;

function makeStudy(overrides: Record<string, unknown> = {}) {
    return {
        id: 1,
        slug: 'study-1',
        state: 'active',
        project_id: PROJECT_ID,
        participant_count: 12,
        created_at: '2025-12-01T00:00:00Z',
        translations: [{ language_code: 'en', title: 'My Study', pre_instruction: 'Welcome' }],
        statements: [{ id: 1, text: 'Statement 1' }],
        ...overrides,
    };
}

function setupDefaultHooks(
    overrides: {
        studies?: unknown[];
        studiesLoading?: boolean;
        concoursesLoading?: boolean;
        concourseItems?: unknown[];
        members?: unknown[];
        tags?: unknown[];
    } = {}
) {
    const {
        studies = [],
        studiesLoading = false,
        concoursesLoading = false,
        concourseItems = [],
        members = [],
        tags = [],
    } = overrides;

    mockStudiesHook.mockReturnValue({
        data: { items: studies },
        isLoading: studiesLoading,
    });
    mockConcoursesHook.mockReturnValue({
        data: { items: [{ id: 10, project_id: PROJECT_ID }] },
        isLoading: concoursesLoading,
    });
    mockConcourseDetailHook.mockReturnValue({
        data: { id: 10, items: concourseItems },
    });
    mockTagsHook.mockReturnValue({
        data: tags,
    });
    mockMembersHook.mockReturnValue({
        data: { items: members },
    });
}

describe('AdminDashboard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('shows loading skeleton when data is loading', () => {
        setupDefaultHooks({ studiesLoading: true });

        const { container } = renderWithProviders(<AdminDashboard />);

        // The loading branch renders Skeleton components (pulse placeholders)
        const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
        // If data-slot is not used, fall back to checking for animate-pulse class
        if (skeletons.length === 0) {
            const pulseElements = container.querySelectorAll('[class*="animate-pulse"]');
            expect(pulseElements.length).toBeGreaterThan(0);
        } else {
            expect(skeletons.length).toBeGreaterThan(0);
        }
    });

    it('shows onboarding when project is empty (no studies, no items)', () => {
        setupDefaultHooks({ studies: [], concourseItems: [] });

        renderWithProviders(<AdminDashboard />);

        expect(screen.getByText('First steps')).toBeInTheDocument();
        expect(screen.getByText('Create your project')).toBeInTheDocument();
        expect(screen.getByText('Collect statements in the concourse')).toBeInTheDocument();
    });

    it('marks concourse step as done when items exist', () => {
        setupDefaultHooks({
            studies: [],
            concourseItems: [{ id: 1, text: 'Item 1', status: 'proposed' }],
        });

        renderWithProviders(<AdminDashboard />);

        // Onboarding is shown (not all steps done)
        expect(screen.getByText('First steps')).toBeInTheDocument();
        // Step 2 (concourse) text should have line-through style when done
        const concourseStepText = screen.getByText('Collect statements in the concourse');
        expect(concourseStepText.className).toContain('line-through');
    });

    it('marks Q-set step as done when accepted items exist', () => {
        setupDefaultHooks({
            studies: [],
            concourseItems: [
                { id: 1, text: 'Accepted item', status: 'accepted' },
                { id: 2, text: 'Proposed item', status: 'proposed' },
            ],
        });

        renderWithProviders(<AdminDashboard />);

        expect(screen.getByText('First steps')).toBeInTheDocument();
        const qsetStepText = screen.getByText('Select the Q-set');
        expect(qsetStepText.className).toContain('line-through');
    });

    it('shows full dashboard when all onboarding steps are complete', () => {
        const study = makeStudy({
            state: 'active',
            participant_count: 5,
            end_date: '2027-06-01T00:00:00Z',
        });

        setupDefaultHooks({
            studies: [study],
            concourseItems: [{ id: 1, text: 'Item', status: 'accepted' }],
            members: [
                {
                    user_id: 1,
                    role: 'owner',
                    user: { full_name: 'Alice', email: 'alice@example.com' },
                },
            ],
        });

        renderWithProviders(<AdminDashboard />);

        // Full dashboard shows project title and stats, not onboarding
        expect(screen.queryByText('First steps')).not.toBeInTheDocument();
        expect(screen.getByText('Test Project')).toBeInTheDocument();
        // Concourse card present
        expect(screen.getByText('Concourse')).toBeInTheDocument();
        // Team card present
        expect(screen.getByText('Team')).toBeInTheDocument();
    });

    it('shows SingleStudyCard layout when exactly 1 study exists', () => {
        const study = makeStudy({
            state: 'active',
            participant_count: 5,
            end_date: '2027-06-01T00:00:00Z',
        });

        setupDefaultHooks({
            studies: [study],
            concourseItems: [{ id: 1, text: 'Item', status: 'accepted' }],
        });

        renderWithProviders(<AdminDashboard />);

        // SingleStudyCard shows study title and tools (Design, Access, Data, Analysis)
        expect(screen.getByText('My Study')).toBeInTheDocument();
        expect(screen.getByText('Design')).toBeInTheDocument();
        expect(screen.getByText('Analysis')).toBeInTheDocument();
    });

    it('shows StudyGroups when multiple studies exist', () => {
        const study1 = makeStudy({
            id: 1,
            slug: 'study-1',
            state: 'active',
            participant_count: 5,
            end_date: '2027-06-01T00:00:00Z',
        });
        const study2 = makeStudy({
            id: 2,
            slug: 'study-2',
            state: 'draft',
            participant_count: 0,
            translations: [{ language_code: 'en', title: 'Second Study', pre_instruction: 'Hi' }],
        });

        setupDefaultHooks({
            studies: [study1, study2],
            concourseItems: [{ id: 1, text: 'Item', status: 'accepted' }],
        });

        renderWithProviders(<AdminDashboard />);

        // StudyGroups renders a "Studies" heading (not SingleStudyCard's "Add study" button context)
        expect(screen.getByText('Studies')).toBeInTheDocument();
        expect(screen.getByText('My Study')).toBeInTheDocument();
        expect(screen.getByText('Second Study')).toBeInTheDocument();
    });

    it('shows alert when active study is near deadline', () => {
        const now = new Date();
        const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

        const study = makeStudy({
            state: 'active',
            participant_count: 2,
            end_date: threeDaysFromNow.toISOString(),
        });

        setupDefaultHooks({
            studies: [study],
            concourseItems: [{ id: 1, text: 'Item', status: 'accepted' }],
        });

        renderWithProviders(<AdminDashboard />);

        expect(screen.getByText('Needs attention')).toBeInTheDocument();
        // Alert message includes study name and days
        expect(screen.getByText(/My Study.*closing in 3 days/)).toBeInTheDocument();
    });

    it('shows concourse item counts in the concourse card', () => {
        const study = makeStudy({
            state: 'active',
            participant_count: 5,
            end_date: '2027-06-01T00:00:00Z',
        });

        setupDefaultHooks({
            studies: [study],
            concourseItems: [
                { id: 1, text: 'A', status: 'accepted' },
                { id: 2, text: 'B', status: 'accepted' },
                { id: 3, text: 'C', status: 'proposed' },
            ],
        });

        renderWithProviders(<AdminDashboard />);

        // Total items count
        expect(screen.getByText('3')).toBeInTheDocument();
        // Status breakdown
        expect(screen.getByText(/2.*Accepted/)).toBeInTheDocument();
        expect(screen.getByText(/1.*Proposed/)).toBeInTheDocument();
    });

    it('shows team members in the team card', () => {
        const study = makeStudy({
            state: 'active',
            participant_count: 5,
            end_date: '2027-06-01T00:00:00Z',
        });

        setupDefaultHooks({
            studies: [study],
            concourseItems: [{ id: 1, text: 'Item', status: 'accepted' }],
            members: [
                {
                    user_id: 1,
                    role: 'owner',
                    user: { full_name: 'Alice Smith', email: 'alice@example.com' },
                },
                {
                    user_id: 2,
                    role: 'editor',
                    user: { full_name: 'Bob Jones', email: 'bob@example.com' },
                },
            ],
        });

        renderWithProviders(<AdminDashboard />);

        expect(screen.getByText('Alice Smith')).toBeInTheDocument();
        expect(screen.getByText('Bob Jones')).toBeInTheDocument();
    });
});
