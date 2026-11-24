import { buildLevelCurve, getLevelState, planXpGain, type GrowthStep, type XpGainPlan } from "@/lib/character/level";
import { useCallback, useMemo, useRef, useState } from "react";

/**
 * Client-side character level state. Total XP is the only source of truth; the level and
 * progress come from src/lib/character/level.ts (the same code the server uses).
 * This hook never saves anything: XP is written by server actions.
 */
export const useCharacterLevel = ( initTotalXp: number, growth_step: GrowthStep | null | undefined ) => {

    const curve = useMemo( () => buildLevelCurve( growth_step ), [ growth_step ] );

    const totalRef = useRef( Math.max( 0, Number( initTotalXp ) || 0 ) );
    const [ totalXp, setTotal ] = useState( totalRef.current );

    const state = useMemo( () => getLevelState( totalXp, curve ), [ totalXp, curve ] );

    /** Adds XP locally and returns the plan (segments) to animate. */
    const gainXp = useCallback( ( xp: number ): XpGainPlan => {

        const plan = planXpGain( totalRef.current, xp, curve );
        totalRef.current = plan.after.totalXp;
        setTotal( totalRef.current );
        return plan;

    }, [ curve ] );

    /** Snaps to a total from the server (e.g. after a concurrent change). */
    const setTotalXp = useCallback( ( total: number ) => {

        totalRef.current = Math.max( 0, Number( total ) || 0 );
        setTotal( totalRef.current );

    }, [] );

    return { curve, totalXp, state, gainXp, setTotalXp };

}
