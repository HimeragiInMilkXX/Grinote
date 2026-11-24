import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { buildLevelCurve, getGrowthStage, getLevelState, planXpGain } from "@/lib/character/level";
import { normalizeWorkDays } from "@/lib/projects/work-days";
import { getAiReviewScore } from "./ai-review";
import { buildRewardBreakdown, intervalToMinutes, msToMinutes } from "./breakdown";
import { PROJECT_STREAK_LOOKBACK_DAYS, REWARD_DAY_TIMEZONE, TASK_COMPLETION_RESOURCES } from "./config";
import { calculateTaskReward } from "./engine";
import { addDaysToKey, computeProjectStreak, computeTaskStreak, dateKeyInZone, startOfDayKey } from "./streaks";

const MAX_ATTEMPTS = 3;

export interface AwardTaskResult {
    recordId: number;
    alreadyCompleted: boolean;
    xp: number;
}

/**
 * Completes a record whose report was reviewed ('reviewing', journal analysed or failed) and awards
 * its XP in one DB transaction (`complete_task_with_reward`, which also confirms the journal).
 * Safe to retry: a record that is already completed awards nothing.
 * Every input is read from the DB (tracked duration saved by finishTask, node estimate, AI score,
 * project XP/streak data). Streak days use the moment 完成 was pressed (`ended_at`), not the
 * moment the report was confirmed.
 */
export async function awardTaskCompletion( supabase: SupabaseClient, args: { recordId: number; projectId: string; userId: string } ): Promise<AwardTaskResult> {

    const { recordId, projectId, userId } = args;

    const { data: record, error: recordError } = await supabase
        .from( "records" )
        .select( "id, status, node_id, xp_change, duration, ended_at, nodes ( time_limit )" )
        .eq( "id", recordId ).eq( "project_id", projectId ).eq( "user_id", userId )
        .single();

    if( recordError ) throw new Error( recordError.message );

    if( record.status === "completed" ) return { recordId, alreadyCompleted: true, xp: record.xp_change ?? 0 };
    if( record.status !== "reviewing" ) throw new Error( "This task is not waiting for its report" );

    const rawDuration = Number( record.duration );
    const durationMs = Math.max( 0, Math.round( Number.isFinite( rawDuration ) ? rawDuration : 0 ) );

    const node = record.nodes as unknown as { time_limit: string | null } | null;

    // the estimate snapshot taken at 完成 (a tree edit while the report is pending can't change the reward)
    const { data: journal, error: journalError } = await supabase.from( "task_journals" ).select( "estimated_minutes" ).eq( "record_id", recordId ).maybeSingle();
    if( journalError ) throw new Error( journalError.message );
    const snapshotMinutes = journal?.estimated_minutes != null ? Number( journal.estimated_minutes ) : NaN;
    const estimatedMinutes = Number.isFinite( snapshotMinutes ) && snapshotMinutes >= 0 ? snapshotMinutes : intervalToMinutes( node?.time_limit );

    // -- streak inputs (they don't depend on XP, so they're read once) --
    const now = new Date();
    const endedAt = record.ended_at ? new Date( record.ended_at ) : null;
    const dayRef = endedAt && Number.isFinite( endedAt.getTime() ) && endedAt <= now ? endedAt : now;
    const todayKey = dateKeyInZone( dayRef, REWARD_DAY_TIMEZONE );
    const todayStart = startOfDayKey( todayKey, REWARD_DAY_TIMEZONE ).toISOString();

    const { data: todayRows, error: todayError } = await supabase
        .from( "records" )
        .select( "status, completed_at, updated_at" )
        .eq( "project_id", projectId )
        .neq( "id", recordId )
        .or( `completed_at.gte.${todayStart},and(status.eq.abandoned,updated_at.gte.${todayStart})` );

    if( todayError ) throw new Error( todayError.message );

    const taskStreak = computeTaskStreak(
        ( todayRows ?? [] )
            .filter( r => r.status === "completed" || r.status === "abandoned" )
            .map( r => ( { status: r.status as "completed" | "abandoned", at: r.completed_at ?? r.updated_at } ) )
    );

    const aiReview = await getAiReviewScore( { supabase, projectId, recordId } );

    for( let attempt = 1; ; attempt++ ) {

        const { data: project, error: projectError } = await supabase
            .from( "projects" )
            .select( "character_xp, created_at, work_days, characters ( growth_step )" )
            .eq( "id", projectId ).eq( "user_id", userId )
            .single();

        if( projectError ) throw new Error( projectError.message );

        const createdKey = dateKeyInZone( new Date( project.created_at ), REWARD_DAY_TIMEZONE );
        const lookbackKey = addDaysToKey( todayKey, -PROJECT_STREAK_LOOKBACK_DAYS );
        const earliestDayKey = createdKey > lookbackKey ? createdKey : lookbackKey;

        const { data: doneRows, error: doneError } = await supabase
            .from( "records" )
            .select( "completed_at" )
            .eq( "project_id", projectId ).eq( "status", "completed" )
            .gte( "completed_at", startOfDayKey( earliestDayKey, REWARD_DAY_TIMEZONE ).toISOString() );

        if( doneError ) throw new Error( doneError.message );

        const projectStreak = computeProjectStreak( {
            completionDayKeys: ( doneRows ?? [] ).filter( r => r.completed_at ).map( r => dateKeyInZone( new Date( r.completed_at ), REWARD_DAY_TIMEZONE ) ),
            todayKey,
            workDays: normalizeWorkDays( project.work_days ),
            earliestDayKey,
            maxLookbackDays: PROJECT_STREAK_LOOKBACK_DAYS,
        } );

        // -- growth stage BEFORE this reward (spec rule 2) --
        const growthStep = ( project.characters as unknown as { growth_step: Record<string, number> } | null )?.growth_step;
        const curve = buildLevelCurve( growthStep );
        const prevXp = Number( project.character_xp ) || 0;
        const before = getLevelState( prevXp, curve );
        const stage = getGrowthStage( before.level, growthStep );

        const inputs = {
            estimatedMinutes,
            actualMinutes: msToMinutes( durationMs ),
            projectStreak,
            taskStreak,
            ai: aiReview,
            growthStage: stage.stage,
            maxStage: stage.maxStage,
        };

        const result = calculateTaskReward( {
            estimatedTime: inputs.estimatedMinutes,
            actualTime: inputs.actualMinutes,
            projectStreak,
            taskStreak,
            aiScore: aiReview.score,
            growthStage: stage.stage,
            maxStage: stage.maxStage,
        } );

        const plan = planXpGain( prevXp, result.awardedXp, curve );

        const breakdown = buildRewardBreakdown( {
            inputs, result, now,
            before: { totalXp: plan.before.totalXp, level: plan.before.level },
            after: { totalXp: plan.after.totalXp, level: plan.after.level },
        } );

        const { data: rpc, error: rpcError } = await supabase.rpc( "complete_task_with_reward", {
            p_record_id: recordId,
            p_duration: durationMs,
            p_xp: result.awardedXp,
            p_breakdown: breakdown,
            p_formula_version: result.formulaVersion,
            p_resources: TASK_COMPLETION_RESOURCES,
            p_expected_xp: prevXp,
            p_new_level: plan.after.level,
            p_new_streak: projectStreak,
        } );

        if( rpcError ) {
            // XP changed between read and write (e.g. feeding in another tab): recompute
            if( rpcError.message.includes( "xp_conflict" ) && attempt < MAX_ATTEMPTS ) continue;
            throw new Error( rpcError.message );
        }

        const out = rpc as { record_id: number; already_completed: boolean; xp_change: number | null };

        return { recordId: out.record_id, alreadyCompleted: out.already_completed, xp: out.xp_change ?? 0 };

    }

}

/**
 * Adds XP outside task completion (feeding resources). The level is derived on the server
 * from the stored XP; returns the new totals.
 */
export async function addProjectXp( supabase: SupabaseClient, args: { projectId: string; userId: string; xp: number } ) {

    const xp = Math.round( args.xp );
    if( !Number.isFinite( xp ) || xp < 0 ) throw new Error( "XP must be a nonnegative number" );

    for( let attempt = 1; ; attempt++ ) {

        const { data: project, error } = await supabase
            .from( "projects" )
            .select( "character_xp, characters ( growth_step )" )
            .eq( "id", args.projectId ).eq( "user_id", args.userId )
            .single();

        if( error ) throw new Error( error.message );

        const growthStep = ( project.characters as unknown as { growth_step: Record<string, number> } | null )?.growth_step;
        const curve = buildLevelCurve( growthStep );
        const prevXp = Number( project.character_xp ) || 0;
        const plan = planXpGain( prevXp, xp, curve );

        const { error: rpcError } = await supabase.rpc( "add_character_xp", {
            p_project_id: args.projectId,
            p_xp: xp,
            p_expected_xp: prevXp,
            p_new_level: plan.after.level,
        } );

        if( rpcError ) {
            if( rpcError.message.includes( "xp_conflict" ) && attempt < MAX_ATTEMPTS ) continue;
            throw new Error( rpcError.message );
        }

        return { totalXp: plan.after.totalXp, level: plan.after.level };

    }

}
