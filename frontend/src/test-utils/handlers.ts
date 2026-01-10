import {
    getGetStudyApiAdminStudiesSlugGetMockHandler,
    getGetStudyApiStudySlugGetMockHandler,
    getOpenQAPIMock,
} from '../api/generated';
import type { StudyRead } from '../api/model';

const demoStudy: StudyRead = {
    id: 1,
    slug: 'demo-study',
    title: 'Demo Study',
    description: 'A study for testing',
    state: 'draft',
    created_at: new Date().toISOString(),
    workspace_id: 1,
    default_language: 'en',
    translations: [
        {
            language_code: 'en',
            title: 'Demo Study',
            description: 'A study for testing',
            instructions: 'Please sort the cards',
            ui_labels: {},
        },
    ],
    statements: [
        {
            id: 1,
            code: 's1',
            study_id: 1,
            translations: [{ language_code: 'en', text: 'Statement 1' }],
        },
        {
            id: 2,
            code: 's2',
            study_id: 1,
            translations: [{ language_code: 'en', text: 'Statement 2' }],
        },
        {
            id: 3,
            code: 's3',
            study_id: 1,
            translations: [{ language_code: 'en', text: 'Statement 3' }],
        },
    ],
    grid_config: [
        { score: -1, capacity: 1 },
        { score: 0, capacity: 1 },
        { score: 1, capacity: 1 },
    ],
    presort_config: {},
    postsort_config: {},
};

export const handlers = [
    // Specific overrides
    getGetStudyApiAdminStudiesSlugGetMockHandler(demoStudy),
    getGetStudyApiStudySlugGetMockHandler(demoStudy),

    // Fallback to auto-generated mocks for everything else
    ...getOpenQAPIMock(),
];
