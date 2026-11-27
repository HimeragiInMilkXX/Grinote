"use client";

import RiveCharacter, { RiveCharacterHandle } from "@/components/rive/rive-character";
import { OnAirRecord } from "@/types/records";
import { useCallback, useRef } from "react";

const ProjectDashboardCharacter = ( { activeTask, project }: { activeTask: OnAirRecord | null, project: Project } ) => {

    const riveCharacterRef = useRef<RiveCharacterHandle>(null);

    const onRiveReady = useCallback( () => {

        if( !riveCharacterRef.current  ) return;

        riveCharacterRef.current?.setHandsUp( !!activeTask )

    }, [activeTask])

    return (
        // capped so a taller side column (e.g. the next action card) can't push the page sideways
        <div className="max-h-[80vh] shrink-0">
            <RiveCharacter growth_step={project.characters?.growth_step} ref={riveCharacterRef} character_id={project.characters?.id ?? 1} className="h-full" onRiveReady={onRiveReady}/>
        </div>
    )
}

export default ProjectDashboardCharacter
