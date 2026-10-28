import ProjectDashboardProgressPanel from '@/components/project/dashboard/project-dashboard-progress-panel';
import ProjectDashboardTaskRecordDialog from '@/components/project/dashboard/project-dashboard-task-record-dialog';
import { getProject } from '@/lib/projects';
import { OnAirRecord } from '@/types/records';
import { getRecords } from './serverActions';
import ProjectDashboardCharacter from '@/components/project/character/project-dashboard-character';
import { getActiveTask } from '../onair/serverActions';
import ProjectTutorialPanel from '@/components/tutorial/project/project-tutorial-panel';

const ProjectPageDashboard = async ( { params }: { params: any }) => {

    const { projectId } = await params;

    const project: Project = await getProject( projectId );
    const records: OnAirRecord[] = await getRecords( projectId );

    let activeTask: OnAirRecord | null = await getActiveTask( projectId );

    let isTutorialCompleted = true;

    for( const step of project.tutorial_progress ) {

        if( !step ) {

            isTutorialCompleted = false;
            break;

        }

    }

    return (
        <div className='flex gap-3'>
            <ProjectDashboardCharacter activeTask={activeTask} project={project}/>
            <div className="flex flex-col gap-3">
                <ProjectDashboardProgressPanel project={project}/>
                <ProjectDashboardTaskRecordDialog records={records}/>
            </div>
        </div>
    )
}

export default ProjectPageDashboard
