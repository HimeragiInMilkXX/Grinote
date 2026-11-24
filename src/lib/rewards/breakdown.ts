/**
 * Durable reward snapshot stored in `records.reward_breakdown` (spec rule 3).
 * The task_complete page and later the journey timeline display this; it is never recomputed.
 */

import type { AiReviewResult } from "./ai-review";
import { LEVEL_XP_REQUIREMENT_SCALE, REWARD_CONFIG, REWARD_DAY_TIMEZONE, type RewardConfig } from "./config";
import type { RewardResult } from "./engine";
import { PROJECT_STREAK_RULE, TASK_STREAK_RULE } from "./streaks";

export interface TaskRewardBreakdown {
    formulaVersion: string;
    /** Config values the reward was computed with. */
    config: RewardConfig;
    inputs: {
        /** Planned time in minutes (node time_limit). 0 = no estimate. */
        estimatedMinutes: number;
        /** Tracked time in minutes. */
        actualMinutes: number;
        projectStreak: number;
        taskStreak: number;
        ai: AiReviewResult;
        /** Growth stage before this reward. */
        growthStage: number;
        maxStage: number;
    };
    factors: RewardResult[ "factors" ];
    rawXp: number;
    awardedXp: number;
    /** Character XP / level right before and after this reward. */
    before: { totalXp: number; level: number };
    after: { totalXp: number; level: number };
    levelXpScale: number;
    rules: { projectStreak: string; taskStreak: string; timeZone: string };
    computedAt: string;
}

export function buildRewardBreakdown( args: {
    inputs: TaskRewardBreakdown[ "inputs" ];
    result: RewardResult;
    before: { totalXp: number; level: number };
    after: { totalXp: number; level: number };
    now?: Date;
    config?: RewardConfig;
} ): TaskRewardBreakdown {

    return {
        formulaVersion: args.result.formulaVersion,
        config: { ...( args.config ?? REWARD_CONFIG ) },
        inputs: args.inputs,
        factors: args.result.factors,
        rawXp: args.result.rawXp,
        awardedXp: args.result.awardedXp,
        before: args.before,
        after: args.after,
        levelXpScale: LEVEL_XP_REQUIREMENT_SCALE,
        rules: { projectStreak: PROJECT_STREAK_RULE, taskStreak: TASK_STREAK_RULE, timeZone: REWARD_DAY_TIMEZONE },
        computedAt: ( args.now ?? new Date() ).toISOString(),
    };

}

/**
 * Minutes of a Postgres interval as returned by PostgREST ("00:30:00", "1 day 02:00:00", "2 days").
 * Anything unparseable counts as 0 (no estimate, so no time bonus).
 */
export function intervalToMinutes( interval: string | null | undefined ): number {

    if( !interval ) return 0;

    let minutes = 0;

    const days = interval.match( /(-?\d+)\s+days?/ );
    if( days ) minutes += Number( days[1] ) * 24 * 60;

    const time = interval.match( /(-?\d+):(\d{1,2}):(\d{1,2}(?:\.\d+)?)/ );
    if( time ) minutes += Number( time[1] ) * 60 + Number( time[2] ) + Number( time[3] ) / 60;

    return Number.isFinite( minutes ) && minutes > 0 ? minutes : 0;

}

export const msToMinutes = ( ms: number ) => Number.isFinite( ms ) && ms > 0 ? ms / 60000 : 0;

/** Narrow an unknown jsonb value to a breakdown (old records have none). */
export function asRewardBreakdown( value: unknown ): TaskRewardBreakdown | null {

    if( !value || typeof value !== "object" ) return null;

    const v = value as Partial<TaskRewardBreakdown>;

    return typeof v.awardedXp === "number" && v.factors && v.inputs && v.before && v.after ? v as TaskRewardBreakdown : null;

}
