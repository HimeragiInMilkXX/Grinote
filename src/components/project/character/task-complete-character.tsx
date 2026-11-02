"use client";

import RiveCharacter, { RiveCharacterHandle } from "@/components/rive/rive-character";
import { useCallback, useEffect, useRef } from "react";
import CharacterXPBar, { CharacterXPBarHandle } from "./character-xp-bar";
import { saveCharacterProgress } from "@/app/project/[projectId]/character/serverActions";
import { redeemReward } from "@/app/project/[projectId]/task_complete/serverActions";
import { OnAirRecord } from "@/types/records";
import { updateTutorialProgress } from "@/app/project/[projectId]/serverActions";
import { toast } from "sonner";

const TaskCompleteCharacter = ( { record, project, characterLevelChanges }: { record: OnAirRecord, project: Project, characterLevelChanges: CharacterLevelChanges }) => {

    const riveCharacterRef = useRef<RiveCharacterHandle>(null);

    const characterXPBarRef = useRef<CharacterXPBarHandle>(null);

    const rewardDisplayed = useRef<boolean>(false);

    useEffect( () => {

        updateTutorialProgress(project.id, 3).then( ( res ) => {if( res ) toast.success("「タスクを完了する」達成！次はキャラを確認しよう！", { position: "top-left" })} )

    }, [])

    const onRiveReady = useCallback( () => {

        if( !riveCharacterRef.current  ) return;

        riveCharacterRef.current.fireSuccess();

    }, [])

    const processReward = useCallback( async () => {

        if( rewardDisplayed.current || !characterXPBarRef.current ) return

        rewardDisplayed.current = true;
        const { level, total_xp } = characterXPBarRef.current?.handleXpGain(characterLevelChanges.xp_gained)

        await saveCharacterProgress( project.id, level, characterLevelChanges.prev_xp + characterLevelChanges.xp_gained )

    }, [])

    const hasRedeemed = useRef<boolean>(false);

    useEffect( () => {

        if( hasRedeemed.current ) return;

        redeemReward( record.id, project.id, record.projects.character_xp )

        hasRedeemed.current = true;

    }, [])

    useEffect( () => {

        if( !characterXPBarRef.current ) return;

        processReward()
        
    }, [])

    return (
        <div>
            <RiveCharacter growth_step={project.characters?.growth_step} ref={riveCharacterRef} character_id={project.characters?.id ?? 1} className="h-full" onRiveReady={onRiveReady}/>
            <CharacterXPBar project_id={project.id} ref={characterXPBarRef} initLevel={characterLevelChanges.prev_lv} initTotalXp={characterLevelChanges.prev_xp} growth_step={characterLevelChanges.growth_step}/>
        </div>
    )
}

export default TaskCompleteCharacter
