import ProjectDashboardProgressPanel from '@/components/project/dashboard/project-dashboard-progress-panel';
import ProjectDashboardJourneyLink from '@/components/project/dashboard/project-dashboard-journey-link';
import { getProject } from '@/lib/projects';
import { OnAirRecord } from '@/types/records';
import ProjectDashboardCharacter from '@/components/project/character/project-dashboard-character';
import { getActiveTask, getPendingReport } from '../onair/serverActions';

const ProjectPageDashboard = async ( { params }: PageProps<"/project/[projectId]/dashboard"> ) => {

    const { projectId } = await params;

    const project: Project = await getProject( projectId );

    const [ activeTask, pendingReport ]: [ OnAirRecord | null, { id: number } | null ] = await Promise.all( [ getActiveTask( projectId ), getPendingReport( projectId ) ] );

    return (
        <div className='flex gap-3'>
            <ProjectDashboardCharacter activeTask={activeTask} project={project}/>
            <div className="flex flex-col gap-3">
                <ProjectDashboardProgressPanel project={project}/>
                <ProjectDashboardJourneyLink projectId={projectId} pendingReportId={pendingReport?.id ?? null}/>
            </div>
        </div>
    )
}

export default ProjectPageDashboard
