"use client"

import {
    Progress,
    ProgressLabel,
    ProgressValue,
} from "@/components/ui/progress"
import gsap from "gsap"
import { RefObject, useEffect, useImperativeHandle, useRef, useState } from "react";
import { atom, useAtom, useSetAtom } from "jotai";
import { useCharacterLevel } from "@/hooks/useCharacterLevel";

type CharacterXPBarProps = {

    project_id: string;
    ref: RefObject<CharacterXPBarHandle>;
    initLevel: number;
    initTotalXp: number;
    growth_step: Record<number, number>;

}

export interface CharacterXPBarHandle {

    handleXpGain: ( xp_gained: number ) => { level: number, total_xp: number };

}

// FOR GROWTHSTEP DISPLAY
export const lvAtom = atom(0);

const CharacterXPBar = ( { project_id, ref, initLevel, initTotalXp, growth_step }: CharacterXPBarProps ) => {

    const { progress, setProgress, displayLv, setDisplayLv, handleXpGain } = useCharacterLevel( project_id, initLevel, initTotalXp, growth_step, animate );

    // UPDATE GLOBAL LEVEL PRESENTATION
    const setLvAtom = useSetAtom( lvAtom );
    useEffect( () => setLvAtom( displayLv ), [ displayLv ] );


    // -- START OF ANIMATION --
    const valueRef = useRef( { progress: 0 })
    const timelineRef = useRef<gsap.core.Timeline | null>(null);

    function animate( from: number, to: number, isLvUp: boolean = false ) {

        // CREATE NEW TIMELINE IF NULL
        if( !timelineRef.current ) {

            timelineRef.current = gsap.timeline({ onComplete: () => timelineRef.current = null } );

        }

        if( !valueRef.current ) return

        // QUEUE ANIMATION
        timelineRef.current.fromTo( valueRef.current, { progress: from }, { progress: to,
            duration: to - from,
            ease: 'none',
            onUpdate: () => { setProgress( valueRef.current.progress * 100 ); },
            onComplete: () => { if(isLvUp) { setProgress(0); setDisplayLv((lv) => lv + 1) } }
        },)

    }
    // -- END OF ANIMATION --


    // EXPOSED FUNCTIONS
    useImperativeHandle( ref, () => {

        return {

            handleXpGain: ( xp_gained: number ) => handleXpGain( xp_gained )

        }

    })
    return (
        <Progress value={progress} className="w-full [&>div>div]:transition-none!">
            <ProgressLabel>{displayLv} </ProgressLabel>
            <ProgressValue />
        </Progress>
    )

}

export default CharacterXPBar
