import "server-only";

/**
 * DB reads for the next action (RLS limits everything to the signed-in user).
 * Server actions are in actions.ts; this file has no "use server" so it can export plain helpers.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { computeJourneyStats, loadJourneyEntries, toHistorySummary } from "@/lib/journey/history";
import { normalizeWorkDays } from "@/lib/projects/work-days";
import { intervalToMinutes, msToMinutes } from "@/lib/rewards/breakdown";
import { addDaysToKey, dateKeyInZone, startOfDayKey } from "@/lib/rewards/streaks";
import { NEXT_ACTION_HISTORY_LIMIT, NEXT_ACTION_TIMEZONE } from "./config";
import { buildCandidates, outlineTree, PLAN_NODE_SELECT, type PlanCandidate, type PlanNodeRow } from "./candidates";
import type { NextActionPromptInput } from "./prompt";
import { matchCompletedNode, resolvePlan } from "./resolve";
import { isWorkDayKey, nextWorkDayKey, todayFocusMs, type ScheduleContext } from "./schedule";
import type { NextActionRow, NextActionView } from "./types";
import { sanitizeUserText } from "@/lib/journey/prompt";

const TZ = NEXT_ACTION_TIMEZONE;

export const PLAN_ROW_SELECT = "*";

export interface PlanProject {
    id: string;
    name: string;
    final_goal: string;
    description: string | null;
    daily_time_goal: string | null;
    work_days: number[];
    achieve_date_goal: string | null;
    created_at: string;
}

export async function loadPlanProject( supabase: SupabaseClient, projectId: string, userId: string ): Promise<PlanProject | null> {

    const { data, error } = await supabase
        .from( "projects" )
        .select( "id, name, final_goal, description, daily_time_goal, work_days, achieve_date_goal, created_at" )
        .eq( "id", projectId ).eq( "user_id", userId )
        .maybeSingle();

    if( error ) throw new Error( error.message );

    return data as PlanProject | null;

}

export async function loadPlanNodes( supabase: SupabaseClient, projectId: string ): Promise<PlanNodeRow[]> {

    const { data, error } = await supabase.from( "nodes" ).select( PLAN_NODE_SELECT ).eq( "project_id", projectId );

    if( error ) throw new Error( error.message );

    return ( data ?? [] ) as unknown as PlanNodeRow[];

}

/** The current plan: the latest saved row. */
export async function loadSavedRow( supabase: SupabaseClient, projectId: string ): Promise<NextActionRow | null> {

    const { data, error } = await supabase
        .from( "next_actions" )
        .select( PLAN_ROW_SELECT )
        .eq( "project_id", projectId ).eq( "status", "saved" )
        .order( "saved_at", { ascending: false } )
        .limit( 1 )
        .maybeSingle();

    if( error ) throw new Error( error.message );

    return data as NextActionRow | null;

}

export async function loadDraftRow( supabase: SupabaseClient, projectId: string ): Promise<NextActionRow | null> {

    const { data, error } = await supabase
        .from( "next_actions" )
        .select( PLAN_ROW_SELECT )
        .eq( "project_id", projectId ).eq( "status", "draft" )
        .maybeSingle();

    if( error ) throw new Error( error.message );

    return data as NextActionRow | null;

}

export const todayKeyNow = ( now: Date = new Date() ) => dateKeyInZone( now, TZ );

export function scheduleContextOf( project: Pick<PlanProject, "work_days" | "achieve_date_goal" | "daily_time_goal">, todayKey: string, focusMs: number ): ScheduleContext {

    const workDays = normalizeWorkDays( project.work_days );
    const goalKey = project.achieve_date_goal ? project.achieve_date_goal.slice( 0, 10 ) : null;
    const goalMinutes = intervalToMinutes( project.daily_time_goal );

    return {
        todayKey,
        todayIsWorkDay: isWorkDayKey( todayKey, workDays ),
        remainingMs: goalMinutes > 0 ? goalMinutes * 60_000 - focusMs : null,
        nextWorkDay: nextWorkDayKey( todayKey, workDays, goalKey ),
        goalKey,
    };

}

export interface PlanContext {
    project: PlanProject;
    rows: PlanNodeRow[];
    candidates: PlanCandidate[];
    schedule: ScheduleContext;
    promptBase: Omit<NextActionPromptInput, "origin" | "intent" | "revisions">;
}

/** Everything the model reads: tree, today's work, schedule, journey. */
export async function loadPlanContext( supabase: SupabaseClient, project: PlanProject, now: Date = new Date() ): Promise<PlanContext> {

    const todayKey = todayKeyNow( now );
    const todayStart = startOfDayKey( todayKey, TZ ).toISOString();
    const todayEnd = startOfDayKey( addDaysToKey( todayKey, 1 ), TZ ).toISOString();

    const [ rows, todayRes, statsRes, entries ] = await Promise.all( [
        loadPlanNodes( supabase, project.id ),
        supabase
            .from( "records" )
            .select( "started_at, ended_at, duration, status, nodes ( task_name )" )
            .eq( "project_id", project.id )
            .neq( "status", "abandoned" )
            .lt( "started_at", todayEnd )
            .or( `started_at.gte.${todayStart},ended_at.gte.${todayStart}` ),
        supabase
            .from( "records" )
            .select( "duration, completed_at" )
            .eq( "project_id", project.id ).eq( "status", "completed" ),
        loadJourneyEntries( supabase, project.id, { limit: NEXT_ACTION_HISTORY_LIMIT } ),
    ] );

    if( todayRes.error ) throw new Error( todayRes.error.message );
    if( statsRes.error ) throw new Error( statsRes.error.message );

    type TodayRow = { started_at: string; ended_at: string | null; duration: number | string | null; status: string; nodes: { task_name: string } | { task_name: string }[] | null };
    const todayRows = ( todayRes.data ?? [] ) as unknown as TodayRow[];

    const focusMs = todayFocusMs( todayRows, todayKey, TZ );
    const schedule = scheduleContextOf( project, todayKey, focusMs );
    const candidates = buildCandidates( rows );

    const stats = computeJourneyStats(
        ( statsRes.data ?? [] ).filter( r => r.completed_at ).map( r => ( { durationMs: Number( r.duration ) || 0, completedAt: r.completed_at as string } ) ),
        { created_at: project.created_at, work_days: normalizeWorkDays( project.work_days ) },
        now,
    );

    const goalMinutes = intervalToMinutes( project.daily_time_goal );

    const completedToday = todayRows
        .filter( r => r.status === "completed" )
        .map( r => ( Array.isArray( r.nodes ) ? r.nodes[0] : r.nodes )?.task_name )
        .filter( ( n ): n is string => !!n );

    return {
        project,
        rows,
        candidates,
        schedule,
        promptBase: {
            project: { name: project.name, finalGoal: project.final_goal, description: project.description },
            outline: outlineTree( rows, candidates, sanitizeUserText ),
            candidates,
            today: {
                key: todayKey,
                isWorkDay: schedule.todayIsWorkDay,
                focusMinutes: msToMinutes( focusMs ),
                dailyGoalMinutes: goalMinutes > 0 ? goalMinutes : null,
                completedToday,
                nextWorkDay: schedule.nextWorkDay,
                goalKey: schedule.goalKey,
            },
            journey: {
                completedTasks: stats.completedTasks,
                totalWorkMinutes: msToMinutes( stats.totalWorkMs ),
                currentStreak: stats.currentStreak,
                history: entries.map( toHistorySummary ).filter( ( h ): h is NonNullable<typeof h> => !!h ),
            },
        },
    };

}

/** The saved plan of a project resolved against the current tree (server components). */
export async function loadSavedPlanView( supabase: SupabaseClient, projectId: string, rows?: PlanNodeRow[] ): Promise<NextActionView | null> {

    const saved = await loadSavedRow( supabase, projectId );
    if( !saved ) return null;

    return resolvePlan( saved, rows ?? await loadPlanNodes( supabase, projectId ), todayKeyNow() );

}

/**
 * Called after a task completion is confirmed: ticks the plan item the completed node belongs to.
 * Best-effort: a failure is logged and never blocks the reward.
 */
export async function markNextActionProgress( supabase: SupabaseClient, projectId: string, nodeId: string ): Promise<void> {

    try {

        const saved = await loadSavedRow( supabase, projectId );
        if( !saved ) return;

        const role = matchCompletedNode( saved, nodeId );
        if( !role ) return;

        const column = role === "progress" ? "progress_done_at" : "practice_done_at";

        const { error } = await supabase
            .from( "next_actions" )
            .update( { [ column ]: new Date().toISOString() } )
            .eq( "id", saved.id ).is( column, null );

        if( error ) throw new Error( error.message );

    } catch( e ) {

        console.error( "[next-action] markNextActionProgress", e instanceof Error ? e.message : e );

    }

}

export interface NextActionSummary {
    saved: NextActionView | null;
    hasDraft: boolean;
    candidateCount: number;
    todayKey: string;
}

/**
 * For server components (task complete, dashboard, tree). Never throws: a failure (e.g. the
 * migration isn't applied yet) is logged and shows as "no plan".
 */
export async function loadNextActionSummary( supabase: SupabaseClient, projectId: string ): Promise<NextActionSummary> {

    const todayKey = todayKeyNow();

    try {

        const rows = await loadPlanNodes( supabase, projectId );
        const [ savedRow, draftRow ] = await Promise.all( [ loadSavedRow( supabase, projectId ), loadDraftRow( supabase, projectId ) ] );

        return {
            saved: savedRow ? resolvePlan( savedRow, rows, todayKey ) : null,
            hasDraft: !!draftRow,
            candidateCount: buildCandidates( rows ).length,
            todayKey,
        };

    } catch( e ) {

        console.error( "[next-action] loadNextActionSummary", e instanceof Error ? e.message : e );
        return { saved: null, hasDraft: false, candidateCount: 0, todayKey };

    }

}
