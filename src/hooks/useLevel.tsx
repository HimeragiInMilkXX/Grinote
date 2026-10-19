"use client"

import { isBetween } from "@/utils/utils";
import { useCallback, useEffect, useMemo, useState } from "react";

export function useLevel( initializeDisplay: ( lv: number, progress: number ) => void, anim: ( isLvUp: boolean, previous: number, current: number, duration?: number ) => void, character_level: number, character_xp: number, growth_step: Record<number, number> ) {

    const [ lv, setLV ] = useState(character_level);
    const [ xp, setXP ] = useState( character_xp );
    const [ remainingXP, setRemainingXP ] = useState( 0 );
    const [ requiredXP, setRequiredXP ] = useState( 1 );

    const displayLv = useMemo( () => lv, [lv] );
    const displayProgress = useMemo( () => remainingXP/requiredXP * 100, [ remainingXP, requiredXP ])

    // INITIALIZATION
    const [isInitialized, setIsInitialized] = useState(false);

    useEffect( () => {

        if( isInitialized ) return;

        const { level, remainingXP, nextLevelRequiredXP } = findLevelFromTotalXP( false, character_level, character_xp );

        setLV( level );
        setRemainingXP( remainingXP );
        setRequiredXP( nextLevelRequiredXP );

        initializeDisplay( level, remainingXP/nextLevelRequiredXP * 100 );

        setIsInitialized(true);

    }, [isInitialized])

    const onXPGained = useCallback( (newXP: number) => {

        const { level, remainingXP, nextLevelRequiredXP } = findLevelFromTotalXP( true, lv, xp + newXP );

        setXP( xp + newXP );

        setLV( level );
        setRemainingXP( remainingXP );
        setRequiredXP( nextLevelRequiredXP );

        return { lv: level, xp: xp + newXP }

    }, [ displayProgress, xp, lv, remainingXP, requiredXP ])

    // KEEP SUBTRACTING XP REQUIRED FOR THE NEXT LEVEL UNTIL IT CANT
    const findLevelFromTotalXP = useCallback(( animated: boolean, currentLevel: number, currentXP: number ) => {

        let currentLevelCount = currentLevel;

        let nextLevelRequiredXP = findNextLevelRequiredXP( currentLevelCount, growth_step );

        let currentXPCount =
            currentXP - findTotalXPForLevel( currentLevelCount, growth_step );

        if( currentXPCount < 0 ) throw new Error( "unexpected input" );

        if( nextLevelRequiredXP > currentXPCount && isInitialized )
            anim( false, displayProgress, ( currentXPCount / nextLevelRequiredXP ) * 100 )

        let i = 0;

        while( currentXPCount >= nextLevelRequiredXP ) {

            if( i < 1 && animated ) anim( false, displayProgress, 100, 0.5 );

            currentXPCount -= nextLevelRequiredXP;
            ++currentLevelCount
            nextLevelRequiredXP = findNextLevelRequiredXP( currentLevelCount, growth_step );

            if( animated ) anim( true, 0, ( currentXPCount / nextLevelRequiredXP ) * 100 )

            i++;

        }

        return { level: currentLevelCount, remainingXP: currentXPCount, nextLevelRequiredXP };

    }, [ displayProgress, isInitialized ])

    function findTotalXPForLevel( currentLevel: number, growth_step: Record<number, number> ) {

        let totalXP = 0;

        const growthStepEntries = Object.entries( growth_step );

        for( let i = 1; i < currentLevel; i++ ) {

            growthStepEntries.some( ( [ step, value ], index ) =>{

                const stepNum = parseInt( step );
                const nextStepNum = parseInt(growthStepEntries[index + 1][0] ?? 500)

                if( isBetween( i, stepNum, nextStepNum ) ) {
                    totalXP += value;
                    return true;
                }

                return false;

            } )

        }

        return totalXP;

    }

    function findNextLevelRequiredXP( currentLevel: number, growth_step: Record<number, number> ) {

        let required_xp = 100;

        Object.entries( growth_step ).forEach( ( [ step, xp ] ) => {

            if( currentLevel + 1 > parseInt( step ) ) required_xp = xp;

        })

        return required_xp;

    }

    return { isInitialized, onXPGained, level: lv, xp, remainingXP, nextLevelRequiredXP: requiredXP, display: { level: displayLv, progress: displayProgress } }

}
