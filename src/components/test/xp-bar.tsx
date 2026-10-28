"use client"

import { RefObject, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Progress, ProgressLabel, ProgressValue } from "../ui/progress"
import { Button } from "../ui/button";
import gsap from 'gsap';

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

    const entries = Object.entries( growth_step );

    // FIND XP REQUIRED UNTIL REACHING NEXT LEVEL; RETURN 0-100 REQUIRED AND OVERFLOW-100 REQUIRED
    const getXPUntilNextLv = ( currentLv: number, overflowXp: number = 0 ) => {

        let requiredXp: number = entries[0][1];

        entries.forEach( ( [ lv, xp ], _ ) => {

            if( currentLv + 1 > Number(lv) )
                requiredXp = xp
            else
                return { totalRequired: requiredXp, remaining: requiredXp - overflowXp};

        })

        return { totalRequired: requiredXp, remaining: requiredXp - overflowXp};

    }

    // FIND TOTAL XP REQUIRED FOR CURRENT LEVEL
    const getTotalXpUntilLv = ( lv: number ) => {

        let stepIndex = 0;
        let totalXp = 0;

        // PUSH ONE STEP IF NEXT LEVEL IS MORE THAN CURRENT STEP
        for( let i = 1; i < lv; i++ ) {

            if( i >= Number((entries[stepIndex + 1] ?? entries[entries.length-1])[0]) )
                ++stepIndex;

            const addXp = (entries[stepIndex] ?? entries[entries.length-1])[1];

            totalXp += addXp;

        }

        return totalXp;

    }

    const [ level, setLevel ] = useState(initLevel);

    // CURRENT OVERFLOWXP = TOTALXP - LEVEL_REQUIRED_TOTAL_XP
    const [ overflowXp, setOverflowXp ] = useState(initTotalXp - getTotalXpUntilLv(initLevel))

    // -- START OF INITIALIZATION --
    const oneTimeRef = useRef(0);

    useEffect( () => {

        if( oneTimeRef.current != 0 ) return;

        oneTimeRef.current = 1;

        // WHEN OVERFLOWXP HAS MORE THAN REQUIRED FOR NEXT LEVEL, TRIGGER LEVEL UP OPERATIONS
        if( overflowXp > getXPUntilNextLv( level ).totalRequired )
            handleXpGain(0, true);

    }, [])
    // -- END OF INITIALIZATION --


    const handleXpGain = useCallback( ( xp_gained: number, isForInit?: boolean ) => {

        let lv = level;

        let xpRequired = getXPUntilNextLv( lv, overflowXp );

        // HARD FIX FOR WHEN INITIALIZATION OVERFLOW LEVEL - 1
        if( isForInit ) setDisplayLv( dl => dl + 1 )

        // No level up
        if( xp_gained < xpRequired.remaining ) {

            // ANIMATE
            animate( overflowXp / xpRequired.totalRequired, (overflowXp + xp_gained) / xpRequired.totalRequired )

            // UPDATE STATES
            setOverflowXp( overflowXp + xp_gained );
            setLevel( lv );
            return;

        }

        // When there is at least one level up
        while( xp_gained >= xpRequired.remaining ) {

            xp_gained -= xpRequired.remaining;

            const startFrom: number = ( xpRequired.totalRequired - xpRequired.remaining ) / xpRequired.totalRequired;

            animate( startFrom, 1, true );

            lv++;

            xpRequired = getXPUntilNextLv( lv );

        }

        animate( 0, xp_gained / xpRequired.totalRequired );

        // UPDATE STATES
        setOverflowXp( xp_gained );
        setLevel( lv );

    }, [ overflowXp, level ] )


    // FOR DISPLAY PURPOSE
    const [ progress, setProgress ] = useState( ( overflowXp / getXPUntilNextLv( level ).totalRequired ) * 100 );
    const [ displayLv, setDisplayLv ] = useState(level);


    // -- START OF ANIMATION --
    const valueRef = useRef( { progress: 0 })
    const timelineRef = useRef<gsap.core.Timeline | null>(null);

    const animate = ( from: number, to: number, isLvUp: boolean = false ) => {

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
        <div className="m-6 flex flex-col gap-3 items-start">
            <Progress value={progress} className="w-full max-w-sm [&>div>div]:transition-none!">
                <ProgressLabel>{displayLv} / {level} / {overflowXp} </ProgressLabel>
                <ProgressValue />
            </Progress>
            <Button onClick={() => handleXpGain(5)}> ADD 5 </Button>
            <Button onClick={() => handleXpGain(10)}> ADD 10 </Button>
            <Button onClick={() => handleXpGain(200)}> ADD 200 </Button>
        </div>
    )
}

export default TestXPBar
