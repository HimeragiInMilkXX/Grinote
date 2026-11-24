import ProjectSettingsPanel from '@/components/project/settings/project-settings-panel';
import ProjectDangerZone from '@/components/project/settings/project-danger-zone';
import { getProject } from '@/lib/projects';
import { getActiveTask } from '../onair/serverActions';

const ProjectPageSettings = async ( { params }: PageProps<"/project/[projectId]/settings"> ) => {

    const { projectId } = await params;

    const project: Project = await getProject( projectId );

    const hasActiveTask = ( await getActiveTask( projectId ) ) != null;

    return (
        // cards must not shrink inside the fixed-height scroll column
        <div className='w-full max-w-2xl h-[90vh] overflow-y-auto px-4 py-2 flex flex-col gap-6 *:shrink-0'>
            <ProjectSettingsPanel project={project} hasActiveTask={hasActiveTask}/>
            <ProjectDangerZone projectId={project.id} projectName={project.name} hasActiveTask={hasActiveTask}/>
        </div>
    )
}

export default ProjectPageSettings
