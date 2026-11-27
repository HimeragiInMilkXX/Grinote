import ProjectDashboardProgressPanel from '@/components/project/dashboard/project-dashboard-progress-panel';
import ProjectDashboardJourneyLink from '@/components/project/dashboard/project-dashboard-journey-link';
import ProjectDashboardNextAction from '@/components/project/dashboard/project-dashboard-next-action';
import ProjectDashboardSchedule, { type DashboardScheduleDay } from '@/components/project/dashboard/project-dashboard-schedule';
import { dayCountsOf, loadScheduleView, type ScheduleView } from '@/lib/schedule/data';
import { entriesForDay } from '@/lib/schedule/days';
import { isPending } from '@/lib/schedule/rules';
import { getProject } from '@/lib/projects';
import { loadNextActionSummary } from '@/lib/next-action/data';
import { OnAirRecord } from '@/types/records';
import ProjectDashboardCharacter from '@/components/project/character/project-dashboard-character';
import { createClient } from '@/utils/supabase/server';
import { getActiveTask, getPendingReport } from '../onair/serverActions';

/** How many later days with unfinished entries the dashboard card lists. */
const UPCOMING_DAYS = 2;

function upcomingDays( view: ScheduleView ): DashboardScheduleDay[] {

    const keys = [ ...new Set( view.entries.filter( e => e.state === "open" && e.dayKey > view.todayKey ).map( e => e.dayKey ) ) ].sort().slice( 0, UPCOMING_DAYS );

    return keys.map( key => ( { key, entries: entriesForDay( view.entries, key, view.todayKey ).filter( isPending ) } ) );

}

const ProjectPageDashboard = async ( { params }: PageProps<"/project/[projectId]/dashboard"> ) => {

    const { projectId } = await params;

    const project: Project = await getProject( projectId );

    const supabase = await createClient();

    const [ activeTask, pendingReport, nextAction, schedule ]: [ OnAirRecord | null, { id: number } | null, Awaited<ReturnType<typeof loadNextActionSummary>>, ScheduleView | null ] = await Promise.all( [
        getActiveTask( projectId ),
        getPendingReport( projectId ),
        loadNextActionSummary( supabase, projectId ),
        // the dashboard still works when the schedule can't be read (e.g. migration not applied)
        loadScheduleView( supabase, projectId ).catch( e => { console.error( "[schedule] dashboard", e instanceof Error ? e.message : e ); return null; } ),
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
                    hasPendingReport={!!pendingReport}
                    scheduleGate={nextAction.scheduleGate}/>
                { schedule && (
                    <ProjectDashboardSchedule
                        projectId={projectId}
                        todayKey={schedule.todayKey}
                        today={ entriesForDay( schedule.entries, schedule.todayKey, schedule.todayKey ).filter( isPending ) }
                        upcoming={ upcomingDays( schedule ) }
                        hasActiveTask={!!activeTask}
                        hasPendingReport={!!pendingReport}/>
                ) }
                <ProjectDashboardProgressPanel project={project} scheduleCounts={ schedule ? dayCountsOf( schedule ) : {} }/>
                <ProjectDashboardJourneyLink projectId={projectId} pendingReportId={pendingReport?.id ?? null}/>
            </div>
        </div>
    )
}

export default ProjectPageDashboard
