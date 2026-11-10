"use client"

import RiveCharacter, { RiveCharacterHandle } from '@/components/rive/rive-character';
import { useEffect, useRef, useState } from 'react'
import CharacterXPBar, { CharacterXPBarHandle } from '../character-xp-bar';
import CharacterGrowthStep from '../character-growth-step';
import ResourcesPanel from './resources/resources-panel';
import { updateTutorialProgress } from '@/app/project/[projectId]/serverActions';
import { toast } from 'sonner';
import { getProjectResources } from '@/app/project/[projectId]/character/serverActions';
import { useSetAtom } from 'jotai';
import { isLoadingAtom } from '@/components/miscellaneous/loading-overlay';
import { currentStepAtom } from '@/components/tutorial/project/project-tutorial-panel';

const CharacterTrainingDisplay = ( { project }: { project: Project }) => {

    // For onboarding
    const setCurrentStepAtom = useSetAtom(currentStepAtom);


    const riveCharacterRef = useRef<RiveCharacterHandle>(null);
    const characterXPBarRef = useRef<CharacterXPBarHandle>(null);

    const setIsLoading = useSetAtom(isLoadingAtom)

    // Do this in client inside of server so we can refresh instantly after onboarding done
    const [ projectResources, setProjectResources ] = useState<ProjectResource[]>();

    useEffect( () => { getProjectResources( project.id ).then( res => setProjectResources(res) ) }, [])

    const oneTimeRef = useRef(0);

    useEffect( () => {

        if( oneTimeRef.current != 0 ) return;

        setIsLoading( true )

        updateTutorialProgress(project.id, 4).then( ( res ) => {
            if( res ) {
                toast.success("「進捗を確認する」達成！", { position: "top-left" })
                toast.success("オンボーディング完了！リソース報酬どーぞ", { position: "top-left" })
                setCurrentStepAtom( prev => prev + 1 )
            }
        } ).then( () => {

            getProjectResources( project.id ).then( res => {setProjectResources( res ); setIsLoading(false);})

        }).catch( () => setIsLoading( false ) );

        oneTimeRef.current = 1;

    }, [project.id])


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

            <CharacterXPBar project_id={project.id} ref={characterXPBarRef} growth_step={project.characters!.growth_step} initLevel={project.character_level} initTotalXp={project.character_xp}/>
            <CharacterGrowthStep growth_step={project.characters!.growth_step}/>
            <ResourcesPanel project_id={project.id} projectResources={projectResources ?? []} characterXP={characterXPBarRef}/>
        </section>
    )
    
}

export default CharacterTrainingDisplay
