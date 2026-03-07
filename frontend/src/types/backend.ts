import type { ProjectRead } from '@/api/model/projectRead';

export interface ProjectWithRole extends ProjectRead {
    user_role: 'owner' | 'admin' | 'researcher' | 'viewer';
}
