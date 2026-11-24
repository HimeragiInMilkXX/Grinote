"use client"

import { Progress, ProgressLabel } from "@/components/ui/progress"
import gsap from "gsap"
import { RefObject, useEffect, useImperativeHandle, useRef, useState } from "react";
import { atom, useSetAtom } from "jotai";
import { useCharacterLevel } from "@/hooks/useCharacterLevel";
import { getLevelState, type GrowthStep, type XpGainPlan, type XpGainSegment } from "@/lib/character/level";

type CharacterXPBarProps = {

    ref: RefObject<CharacterXPBarHandle | null>;
    /** Total XP to start from (the level is derived from it). */
    initTotalXp: number;
    growth_step: GrowthStep;
    /** Called once per level-up during the animation (hook for future level-up / evolution effects). */
    onLevelUp?: ( newLevel: number ) => void;

}

export interface CharacterXPBarHandle {

    /** Adds XP locally, animates the bar segment by segment, returns the plan. Saves nothing. */
    playXpGain: ( xp_gained: number ) => XpGainPlan;
    /** Snaps the bar to a total XP without animation. */
    setTotalXp: ( total_xp: number ) => void;

}

// FOR GROWTHSTEP DISPLAY
export const lvAtom = atom(0);

/** Seconds a full bar takes to fill. */
const FULL_BAR_SECONDS = 1;

const CharacterXPBar = ( { ref, initTotalXp, growth_step, onLevelUp }: CharacterXPBarProps ) => {

    const { curve, gainXp, setTotalXp, state } = useCharacterLevel( initTotalXp, growth_step );

    // What's on screen (lags behind the real state while animating)
    const [ progress, setProgress ] = useState( state.progress * 100 );
    const [ displayLv, setDisplayLv ] = useState( state.level );
    const [ displayXp, setDisplayXp ] = useState( { into: state.xpIntoLevel, need: state.xpForNextLevel } );

    // UPDATE GLOBAL LEVEL PRESENTATION
    const setLvAtom = useSetAtom( lvAtom );
    useEffect( () => setLvAtom( displayLv ), [ displayLv ] );


    // -- START OF ANIMATION --
    const valueRef = useRef( { progress: state.progress } )
    const timelineRef = useRef<gsap.core.Timeline | null>(null);

    function queueSegment( segment: XpGainSegment ) {

        if( !timelineRef.current )
            timelineRef.current = gsap.timeline({ onComplete: () => { timelineRef.current = null } } );

        timelineRef.current.fromTo( valueRef.current, { progress: segment.from }, { progress: segment.to,
            duration: Math.max( 0.15, ( segment.to - segment.from ) * FULL_BAR_SECONDS ),
            ease: 'none',
            onStart: () => setDisplayLv( segment.level ),
            onUpdate: () => { setProgress( valueRef.current.progress * 100 ); },
            onComplete: () => {
                if( !segment.levelUp ) return;
                setProgress( 0 );
                setDisplayLv( segment.level + 1 );
                onLevelUp?.( segment.level + 1 );
            }
        })

    }

    function playXpGain( xp_gained: number ) {

        const plan = gainXp( xp_gained );

        plan.segments.forEach( queueSegment );
        timelineRef.current?.call( () => setDisplayXp( { into: plan.after.xpIntoLevel, need: plan.after.xpForNextLevel } ) );

        return plan;

    }

    function snapTo( total_xp: number ) {

        timelineRef.current?.kill();
        timelineRef.current = null;

        setTotalXp( total_xp );

        const next = getLevelState( total_xp, curve );
        valueRef.current.progress = next.progress;
        setProgress( next.progress * 100 );
        setDisplayLv( next.level );
        setDisplayXp( { into: next.xpIntoLevel, need: next.xpForNextLevel } );

    }
    // -- END OF ANIMATION --

    // No timeline kill on unmount: Strict Mode's simulated unmount would cancel the reward
    // animation that the parent already started (and only starts once).

    // EXPOSED FUNCTIONS
    useImperativeHandle( ref, () => ( { playXpGain, setTotalXp: snapTo } ) )

    return (
        <Progress value={progress} className="w-full [&>div>div]:transition-none!">
            <ProgressLabel>Lv.{displayLv}</ProgressLabel>
            <span className="ml-auto text-sm text-muted-foreground tabular-nums">{ Math.floor( displayXp.into ) } / { displayXp.need } XP</span>
        </Progress>
    )

}

export default CharacterXPBar
