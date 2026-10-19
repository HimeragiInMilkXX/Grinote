import CharacterTrainingDisplay from '@/components/project/character/training/character-training-display';
import { getProject } from '@/lib/projects';
import { getProjectResources } from './serverActions';
import { updateTutorialProgress } from '../serverActions';

const ProjectPageCharacter = async ( { params }: { params: any }) => {

    const { projectId } = await params;

    const project: Project = await getProject( projectId );

    const projectResources: ProjectResource[] = await getProjectResources( projectId );

    await updateTutorialProgress(projectId, 4);

    return (
        <div className='flex gap-3 flex-col'>
            <CharacterTrainingDisplay project={project} projectResources={projectResources}/>
        </div>
    )
}

export default ProjectPageCharacter
