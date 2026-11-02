"use client"

import { RefObject, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Progress, ProgressLabel, ProgressValue } from "../ui/progress"
import { Button } from "../ui/button";
import gsap from 'gsap';
import { useCharacterLevel } from "@/hooks/useCharacterLevel";

type XpBarProps = {

    ref: RefObject<XpBarHandle>;
    initLevel: number;
    initTotalXp: number;
    growth_step: Record<number, number>;

}

export interface XpBarHandle {

    handleXpGain: ( xp_gained: number ) => void;

}

const TestXPBar = ( { ref, initLevel, initTotalXp, growth_step }: XpBarProps ) => {

    const { progress, setProgress, displayLv, setDisplayLv, handleXpGain } = useCharacterLevel( initLevel, initTotalXp, growth_step, animate );


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
        <Progress value={progress} className="w-full max-w-sm [&>div>div]:transition-none!">
            <ProgressLabel>{displayLv} </ProgressLabel>
            <ProgressValue />
        </Progress>
    )
}

export default TestXPBar
