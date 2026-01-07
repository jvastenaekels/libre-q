import TeamSettings from '@/components/admin/team/TeamSettings';
import { StudyPageHeader } from '@/components/admin/layout/StudyPageHeader';
import { useTranslation } from 'react-i18next';

interface LoaderData {
    study: StudyRead;
    slug: string;
}

const TeamManagementPage = () => {
    const _loaderData = useLoaderData() as LoaderData;
    const { t } = useTranslation();

    return (
        <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6 pt-2">
            <StudyPageHeader
                title={t('admin.team.title', 'Research Team')}
                description={t(
                    'admin.team.description',
                    'Manage collaborators and study-level access control.'
                )}
                icon={Users}
            />

            <TeamSettings />
        </div>
    );
};

export default TeamManagementPage;
