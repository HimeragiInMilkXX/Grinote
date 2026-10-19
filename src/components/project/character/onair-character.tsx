"use client";

import RiveCharacter, { RiveCharacterHandle } from "@/components/rive/rive-character";
import { useRef } from "react";

const OnAirCharacter = ( { project }: { project: Project } ) => {

    const riveCharacterRef = useRef<RiveCharacterHandle>(null);

    const onMouseDown = () => {

        if( !riveCharacterRef.current ) return;

        if( Math.round( Math.random() ) === 1 )
            riveCharacterRef.current.fireSuccess();
        else
            riveCharacterRef.current.fireFail();

    }

    return (
        <div>
            <RiveCharacter ref={riveCharacterRef} character_id={project.characters?.id ?? 1} className="h-full"
                onMouseDown={onMouseDown} growth_step={project.characters?.growth_step}/>
        </div>
    )
}

export default OnAirCharacter
