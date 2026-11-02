import CharacterTrainingDisplay from '@/components/project/character/training/character-training-display';
import { getProject } from '@/lib/projects';

const ProjectPageCharacter = async ( { params }: { params: any }) => {

    const { projectId } = await params;

    const project: Project = await getProject( projectId );

    return (
        <div className='flex gap-3 flex-col'>
            <CharacterTrainingDisplay project={project}/>
        </div>
    )
}

export default ProjectPageCharacter
