"use client"

import {
    Progress,
    ProgressLabel,
    ProgressValue,
} from "@/components/ui/progress"
import gsap from "gsap"
import { useLevel } from "@/hooks/useLevel";
import { RefObject, useEffect, useImperativeHandle, useRef, useState } from "react";
import { clamp } from "@/utils/utils";
import { atom, useAtom } from "jotai";

type Props = {

    ref: RefObject<CharacterXPBarHandle | null>;
    onInitialized?: () => void;
    character_level: number;
    character_xp: number;
    growth_step: Record<number, number>

}

export interface CharacterXPBarHandle {

    onXPGained: ( newXP: number ) => { lv: number, xp: number };

}

// FOR GROWTHSTEP DISPLAY
export const lvAtom = atom(0);

const CharacterXPBar = ( { ref, onInitialized = () => {}, character_level, character_xp, growth_step }: Props ) => {

    const { isInitialized, onXPGained, display } = useLevel(
        ( lv: number, progress: number ) => {

            setLV( lv );
            setProgress( progress );

        },
        triggerXpIncreaseAnimation, character_level, character_xp, growth_step )

    const [ progress, setProgress ] = useState( display.progress );

    const [ lv, setLV ] = useAtom( lvAtom );

    const valueRef = useRef( { progress: progress })
    const timelineRef = useRef<gsap.core.Timeline | null>(null);

    useEffect(() => {
        if (isInitialized) onInitialized();
        setLV( display.level );
    }, [isInitialized, onInitialized]);

    useImperativeHandle( ref, () => {

        return {

            onXPGained: ( newXP: number ) => {
                return onXPGained( newXP )
            }

        }

    }, [ onXPGained ])

    function triggerXpIncreaseAnimation( isLvUp: boolean, previous: number, current: number, duration: number = 2 ) {

        if( !timelineRef.current ) {

            timelineRef.current = gsap.timeline({ onComplete: () => timelineRef.current = null } );

        }

        if( !valueRef.current ) return

        timelineRef.current.fromTo( valueRef.current, { progress: previous }, { progress: clamp( current, 0, 100 ),
            duration: duration,
            ease: 'none',
            onUpdate: () => { setProgress( valueRef.current.progress ); },
            onStart: () => { if( isLvUp ) setLV( (lv) => lv + 1 ) }
        },)

    }

    return (
        <Progress value={progress} className="w-full [&>div>div]:transition-none!">
            <ProgressLabel> LV. {lv} </ProgressLabel>
            <ProgressValue />
            {/* <div> {level}/{remainingXP}/{ nextLevelRequiredXP }/{display.progress}/{xp} </div> */}
        </Progress>
)
}

export default CharacterXPBar
