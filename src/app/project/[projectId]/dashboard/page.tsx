import ProjectDashboardProgressPanel from '@/components/project/dashboard/project-dashboard-progress-panel';
import ProjectDashboardJourneyLink from '@/components/project/dashboard/project-dashboard-journey-link';
import ProjectDashboardNextAction from '@/components/project/dashboard/project-dashboard-next-action';
import { getProject } from '@/lib/projects';
import { loadNextActionSummary } from '@/lib/next-action/data';
import { OnAirRecord } from '@/types/records';
import ProjectDashboardCharacter from '@/components/project/character/project-dashboard-character';
import { createClient } from '@/utils/supabase/server';
import { getActiveTask, getPendingReport } from '../onair/serverActions';

const ProjectPageDashboard = async ( { params }: PageProps<"/project/[projectId]/dashboard"> ) => {

    const { projectId } = await params;

    const project: Project = await getProject( projectId );

    const [ activeTask, pendingReport, nextAction ]: [ OnAirRecord | null, { id: number } | null, Awaited<ReturnType<typeof loadNextActionSummary>> ] = await Promise.all( [
        getActiveTask( projectId ),
        getPendingReport( projectId ),
        createClient().then( supabase => loadNextActionSummary( supabase, projectId ) ),
    ] );

    return (
        <div className='flex gap-3'>
            <ProjectDashboardCharacter activeTask={activeTask} project={project}/>
            <div className="flex flex-col gap-3">
                <ProjectDashboardNextAction
                    projectId={projectId}
                    saved={nextAction.saved}
                    hasDraft={nextAction.hasDraft}
                    candidateCount={nextAction.candidateCount}
                    todayKey={nextAction.todayKey}
                    hasActiveTask={!!activeTask}
                    hasPendingReport={!!pendingReport}/>
                <ProjectDashboardProgressPanel project={project}/>
                <ProjectDashboardJourneyLink projectId={projectId} pendingReportId={pendingReport?.id ?? null}/>
            </div>
        </div>
    )
}

export default ProjectPageDashboard
