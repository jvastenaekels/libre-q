import { useLoaderData } from 'react-router-dom';
import InteractiveDataView from '@/components/admin/dashboard/InteractiveDataView';

export default function DataExportsPage() {
    // biome-ignore lint/suspicious/noExplicitAny: loader data type
    const { participants, slug } = useLoaderData() as any;
    return (
        <div className="space-y-8">
            <InteractiveDataView slug={slug} participants={participants} />
        </div>
    );
}
