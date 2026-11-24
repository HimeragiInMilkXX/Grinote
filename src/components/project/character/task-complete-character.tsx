"use client";

import RiveCharacter, { RiveCharacterHandle } from "@/components/rive/rive-character";
import { useCallback, useEffect, useRef } from "react";
import CharacterXPBar, { CharacterXPBarHandle } from "./character-xp-bar";
import { markRewardShown } from "@/app/project/[projectId]/task_complete/serverActions";
import { OnAirRecord } from "@/types/records";
import { useTutorialStep } from "@/hooks/useTutorialStep";

type TaskCompleteCharacterProps = {

    record: OnAirRecord;
    project: Project;
    /** Total XP the bar starts at. */
    initTotalXp: number;
    /** XP to animate on top of it (0 = show the final state, e.g. on a revisit). */
    xpGained: number;

}

/**
 * Plays the reward animation. The XP was already saved at completion, so nothing here writes XP;
 * it only marks the animation as shown.
 */
const TaskCompleteCharacter = ( { record, project, initTotalXp, xpGained }: TaskCompleteCharacterProps ) => {

    // For onboarding
    const completeTutorialStep = useTutorialStep( project.id );

    const riveCharacterRef = useRef<RiveCharacterHandle>(null);

    const characterXPBarRef = useRef<CharacterXPBarHandle>(null);

    useEffect( () => {

        completeTutorialStep( 3 )

    }, [])

    const onRiveReady = useCallback( () => {

        riveCharacterRef.current?.fireSuccess();

    }, [])

    const played = useRef<boolean>(false);

    useEffect( () => {

        if( played.current ) return;
        played.current = true;

        if( xpGained > 0 ) characterXPBarRef.current?.playXpGain( xpGained );

        if( !record.reward_redeemed ) markRewardShown( record.id, project.id ).catch( () => {} );

    }, [])

    return (
        <div>
            <RiveCharacter growth_step={project.characters?.growth_step} ref={riveCharacterRef} character_id={project.characters?.id ?? 1} className="h-full" onRiveReady={onRiveReady}/>
            <CharacterXPBar ref={characterXPBarRef} initTotalXp={initTotalXp} growth_step={project.characters!.growth_step}
                onLevelUp={() => riveCharacterRef.current?.fireSuccess()}/>
        </div>
    )
}

export default TaskCompleteCharacter
