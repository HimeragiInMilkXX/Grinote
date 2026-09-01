import ProjectDashboardProgressPanel from '@/components/project/independent/dashboard/project-dashboard-progress-panel';
import ProjectDashboardTaskRecordDialog from '@/components/project/independent/dashboard/project-dashboard-task-record-dialog';
import { getProject } from '@/lib/projects';
import { OnAirRecord } from '@/types/records';
import { getRecords } from './serverActions';

const ProjectPageDashboard = async ( { params }: { params: any }) => {

    const { projectId } = await params;

    const project: Project = await getProject( projectId );
    const records: OnAirRecord[] = await getRecords( projectId );

    return (
        <div className="flex flex-col gap-3">
            <ProjectDashboardProgressPanel project={project}/>
            <ProjectDashboardTaskRecordDialog records={records}/>
        </div>
    )
}

export default ProjectPageDashboard
