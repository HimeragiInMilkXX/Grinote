import { saveCharacterProgress } from "@/app/project/[projectId]/character/serverActions";
import { useCallback, useEffect, useRef, useState } from "react";

export const useCharacterLevel = ( project_id: string, initLevel: number, initTotalXp: number, growth_step: Record<number, number>, animate: ( from: number, to: number, isLvUp?: boolean ) => void ) => {

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
        if( overflowXp > getXPUntilNextLv( level ).totalRequired ) {
            const { level: lv, total_xp } = handleXpGain(0, true);
            saveCharacterProgress( project_id, lv, total_xp );
        }

    }, [])
    // -- END OF INITIALIZATION --

    const handleXpGain = useCallback( ( xp_gained: number, isForInit?: boolean ): { level: number, total_xp: number } => {

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
            return { level: lv, total_xp: getTotalXpUntilLv(lv) + xp_gained + overflowXp }

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

        return { level: lv, total_xp: getTotalXpUntilLv(lv) + xp_gained }

    }, [ overflowXp, level ] )

    // FOR DISPLAY PURPOSE
    const [ progress, setProgress ] = useState( ( overflowXp / getXPUntilNextLv( level ).totalRequired ) * 100 );
    const [ displayLv, setDisplayLv ] = useState(level);

    return { progress, setProgress, displayLv, setDisplayLv, handleXpGain, realData: { overflowXp, level } }

}

