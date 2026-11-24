/**
 * Character level / growth logic. Single source of truth for the server (awarding XP) and the
 * client (XP bar, Rive stage). Total XP is authoritative; the level is derived from it.
 *
 * `growth_step` (characters.growth_step) maps a starting level to the XP needed for each level-up
 * from that level on, e.g. { 1: 50, 5: 100 } = Lv1-4 need 50 XP per level, Lv5+ need 100.
 * Its keys are also the growth stages (Rive files public/character/rive/<id>/<key>.riv).
 */

import { LEVEL_XP_REQUIREMENT_SCALE } from "@/lib/rewards/config";

export type GrowthStep = Record<number | string, number>;

export interface LevelCurveStep { fromLevel: number; xpPerLevel: number; }
export type LevelCurve = readonly LevelCurveStep[];

export const DEFAULT_GROWTH_STEP: GrowthStep = { 1: 50, 5: 100, 10: 150, 25: 200, 45: 400, 50: 500 };

function sortedSteps( growth_step: GrowthStep | null | undefined ): LevelCurveStep[] {

    const entries = Object.entries( growth_step && Object.keys( growth_step ).length ? growth_step : DEFAULT_GROWTH_STEP )
        .map( ( [ lv, xp ] ) => ( { fromLevel: Number( lv ), xpPerLevel: Number( xp ) } ) )
        .filter( s => Number.isFinite( s.fromLevel ) && Number.isFinite( s.xpPerLevel ) && s.xpPerLevel > 0 )
        .sort( ( a, b ) => a.fromLevel - b.fromLevel );

    return entries.length ? entries : sortedSteps( DEFAULT_GROWTH_STEP );

}

/** Level curve from a character's growth_step, scaled by LEVEL_XP_REQUIREMENT_SCALE. */
export function buildLevelCurve( growth_step: GrowthStep | null | undefined, scale: number = LEVEL_XP_REQUIREMENT_SCALE ): LevelCurve {

    return sortedSteps( growth_step ).map( s => ( { ...s, xpPerLevel: Math.max( 1, Math.round( s.xpPerLevel * scale ) ) } ) );

}

/** XP needed to go from `level` to `level + 1`. */
export function xpToNextLevel( level: number, curve: LevelCurve ): number {

    let need = curve[0].xpPerLevel;

    for( const step of curve ) {
        if( step.fromLevel <= level ) need = step.xpPerLevel;
        else break;
    }

    return need;

}

/** Total XP at the start of `level` (Lv1 = 0). */
export function totalXpAtLevel( level: number, curve: LevelCurve ): number {

    let total = 0;
    for( let lv = 1; lv < level; lv++ ) total += xpToNextLevel( lv, curve );
    return total;

}

export interface LevelState {
    totalXp: number;
    level: number;
    /** XP earned inside the current level. */
    xpIntoLevel: number;
    /** XP the current level needs in total. */
    xpForNextLevel: number;
    /** 0..1 progress inside the current level. */
    progress: number;
}

export function getLevelState( totalXp: number, curve: LevelCurve ): LevelState {

    const total = Math.max( 0, Number.isFinite( totalXp ) ? totalXp : 0 );

    let level = 1;
    let remaining = total;
    let need = xpToNextLevel( level, curve );

    while( remaining >= need ) {
        remaining -= need;
        level++;
        need = xpToNextLevel( level, curve );
    }

    return { totalXp: total, level, xpIntoLevel: remaining, xpForNextLevel: need, progress: remaining / need };

}

export interface GrowthStage {
    /** 0-based stage index (input `growthStage` of the reward formula). */
    stage: number;
    /** Highest stage index (input `maxStage`), at least 1. */
    maxStage: number;
    /** growth_step key of this stage = Rive file name. */
    stageLevel: number;
    /** growth_step key of the next stage, null at the last stage. */
    nextStageLevel: number | null;
}

export function getGrowthStage( level: number, growth_step: GrowthStep | null | undefined ): GrowthStage {

    const steps = sortedSteps( growth_step );

    let stage = 0;
    steps.forEach( ( s, i ) => { if( level >= s.fromLevel ) stage = i; } );

    return {
        stage,
        maxStage: Math.max( 1, steps.length - 1 ),
        stageLevel: steps[stage].fromLevel,
        nextStageLevel: steps[stage + 1]?.fromLevel ?? null,
    };

}

/** One animation segment of the XP bar inside a single level. */
export interface XpGainSegment {
    level: number;
    /** 0..1 */
    from: number;
    /** 0..1 */
    to: number;
    /** True when this segment fills the bar and the level goes up afterwards. */
    levelUp: boolean;
}

export interface XpGainPlan {
    before: LevelState;
    after: LevelState;
    segments: XpGainSegment[];
    levelsGained: number;
}

/** Describes an XP gain as bar segments, so animations (and later evolutions) can replay it. */
export function planXpGain( prevTotalXp: number, gained: number, curve: LevelCurve ): XpGainPlan {

    const before = getLevelState( prevTotalXp, curve );
    const after = getLevelState( before.totalXp + Math.max( 0, gained ), curve );

    const segments: XpGainSegment[] = [];
    let from = before.progress;

    for( let lv = before.level; lv < after.level; lv++ ) {
        segments.push( { level: lv, from, to: 1, levelUp: true } );
        from = 0;
    }

    segments.push( { level: after.level, from, to: after.progress, levelUp: false } );

    return { before, after, segments, levelsGained: after.level - before.level };

}
