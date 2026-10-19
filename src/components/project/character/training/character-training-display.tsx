"use client"

import RiveCharacter, { RiveCharacterHandle } from '@/components/rive/rive-character';
import { useRef } from 'react'
import CharacterXPBar, { CharacterXPBarHandle } from '../character-xp-bar';
import CharacterGrowthStep from '../character-growth-step';
import ResourcesPanel from './resources/resources-panel';

const CharacterTrainingDisplay = ( { project, projectResources }: { project: Project, projectResources: ProjectResource[] }) => {

    const riveCharacterRef = useRef<RiveCharacterHandle>(null);
    const characterXPBarRef = useRef<CharacterXPBarHandle>(null);

    const onMouseDown = () => {

        if( !riveCharacterRef.current ) return;

        if( Math.round( Math.random() ) === 1 )
            riveCharacterRef.current.fireSuccess();
        else
            riveCharacterRef.current.fireFail();

    }

    return (
        <section className='flex flex-col gap-3 w-[25vw]'>
            <RiveCharacter growth_step={project.characters?.growth_step} ref={riveCharacterRef} character_id={project.characters?.id ?? 1} className="h-full"
                onMouseDown={onMouseDown}/>

            <h2 className='font-bold text-2xl text-center'> { project.character_given_name } - { project.characters?.name } </h2>

            <CharacterXPBar ref={characterXPBarRef} growth_step={project.characters!.growth_step} character_level={project.character_level} character_xp={project.character_xp}/>
            <CharacterGrowthStep growth_step={project.characters!.growth_step}/>
            <ResourcesPanel project_id={project.id} projectResources={projectResources} characterXP={characterXPBarRef}/>
        </section>
    )
    
}

export default CharacterTrainingDisplay
