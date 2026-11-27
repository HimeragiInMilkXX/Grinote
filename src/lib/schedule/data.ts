import "server-only";

/**
 * DB reads for the schedule (RLS limits everything to the signed-in user).
 * Server actions are in actions.ts.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { PLAN_NODE_SELECT, type PlanNodeRow } from "@/lib/next-action/candidates";
import { nextWorkDayKey, todayFocusMs } from "@/lib/next-action/schedule";
import { normalizeWorkDays } from "@/lib/projects/work-days";
import { intervalToMinutes } from "@/lib/rewards/breakdown";
import { addDaysToKey, dateKeyInZone, startOfDayKey } from "@/lib/rewards/streaks";
import { SCHEDULE_TIMEZONE } from "./config";
import { entriesForDay, pendingCount, scheduleWeeks, todayHighlights } from "./days";
import { OPEN_GATE, scheduleGate, type ScheduleGate } from "./gate";
import { buildEntries, buildScheduleNodes } from "./rules";
import { SCHEDULE_ITEM_SELECT, type ScheduleEntry, type ScheduleHighlight, type ScheduleItemRow, type ScheduleNode } from "./types";

const TZ = SCHEDULE_TIMEZONE;

export const scheduleTodayKey = ( now: Date = new Date() ) => dateKeyInZone( now, TZ );

export interface ScheduleProject {
    id: string;
    name: string;
    color: string;
    work_days: number[];
    achieve_date_goal: string | null;
    daily_time_goal: string | null;
    created_at: string;
}

const PROJECT_SELECT = "id, name, color, work_days, achieve_date_goal, daily_time_goal, created_at";

/** Everything the schedule page, its server actions and the assistant tools work with (serializable). */
export interface ScheduleView {
    projectId: string;
    projectColor: string;
    todayKey: string;
    goalKey: string | null;
    createdKey: string;
    workDays: number[];
    /** daily_time_goal in minutes, null when there is none */
    goalMinutes: number | null;
    nodes: ScheduleNode[];
    items: ScheduleItemRow[];
    entries: ScheduleEntry[];
}

export async function loadScheduleProject( supabase: SupabaseClient, projectId: string ): Promise<ScheduleProject | null> {

    const { data, error } = await supabase.from( "projects" ).select( PROJECT_SELECT ).eq( "id", projectId ).maybeSingle();

    if( error ) throw new Error( error.message );

    return data as ScheduleProject | null;

}

async function loadPlanNodes( supabase: SupabaseClient, projectId: string ): Promise<PlanNodeRow[]> {

    const { data, error } = await supabase.from( "nodes" ).select( PLAN_NODE_SELECT ).eq( "project_id", projectId );

    if( error ) throw new Error( error.message );

    return ( data ?? [] ) as unknown as PlanNodeRow[];

}

export async function loadScheduleItems( supabase: SupabaseClient, projectId: string ): Promise<ScheduleItemRow[]> {

    const { data, error } = await supabase
        .from( "schedule_items" )
        .select( SCHEDULE_ITEM_SELECT )
        .eq( "project_id", projectId )
        .order( "scheduled_for" ).order( "created_at" );

    if( error ) throw new Error( error.message );

    return ( data ?? [] ) as ScheduleItemRow[];

}

export function buildScheduleView( project: ScheduleProject, rows: readonly PlanNodeRow[], items: ScheduleItemRow[], todayKey: string ): ScheduleView {

    const goalMinutes = Math.round( intervalToMinutes( project.daily_time_goal ) );
    const nodes = buildScheduleNodes( rows );

    return {
        projectId: project.id,
        projectColor: project.color,
        todayKey,
        goalKey: project.achieve_date_goal ? project.achieve_date_goal.slice( 0, 10 ) : null,
        createdKey: dateKeyInZone( new Date( project.created_at ), TZ ),
        workDays: normalizeWorkDays( project.work_days ),
        goalMinutes: goalMinutes > 0 ? goalMinutes : null,
        nodes,
        items,
        entries: buildEntries( items, nodes, todayKey ),
    };

}

/** The whole schedule of a project (throws on DB errors, null when the project isn't the user's). */
export async function loadScheduleView( supabase: SupabaseClient, projectId: string, now: Date = new Date() ): Promise<ScheduleView | null> {

    const [ project, rows, items ] = await Promise.all( [
        loadScheduleProject( supabase, projectId ),
        loadPlanNodes( supabase, projectId ),
        loadScheduleItems( supabase, projectId ),
    ] );

    if( !project ) return null;

    return buildScheduleView( project, rows, items, scheduleTodayKey( now ) );

}

export const scheduleWeeksOf = ( view: Pick<ScheduleView, "createdKey" | "goalKey" | "todayKey" | "entries"> ) => {

    // the latest entry that can still be moved or removed keeps its week reachable
    const lastEntryKey = view.entries.reduce<string | null>( ( max, e ) => e.state !== "done" && ( !max || e.dayKey > max ) ? e.dayKey : max, null );

    return scheduleWeeks( view.createdKey, view.goalKey, view.todayKey, lastEntryKey );

};

/** Focus ms of today's records (same rule as the next action: started or ended today, not abandoned). */
export async function loadTodayFocusMs( supabase: SupabaseClient, projectId: string, todayKey: string ): Promise<number> {

    const todayStart = startOfDayKey( todayKey, TZ ).toISOString();
    const todayEnd = startOfDayKey( addDaysToKey( todayKey, 1 ), TZ ).toISOString();

    const { data, error } = await supabase
        .from( "records" )
        .select( "started_at, ended_at, duration, status" )
        .eq( "project_id", projectId )
        .neq( "status", "abandoned" )
        .lt( "started_at", todayEnd )
        .or( `started_at.gte.${todayStart},ended_at.gte.${todayStart}` );

    if( error ) throw new Error( error.message );

    return todayFocusMs( data ?? [], todayKey, TZ );

}

/** Pure part of the gate, from a loaded view and today's focus. */
export function gateOfView( view: ScheduleView, focusMs: number ): ScheduleGate {

    const todayPending = pendingCount( entriesForDay( view.entries, view.todayKey, view.todayKey ) );
    const nextKey = nextWorkDayKey( view.todayKey, view.workDays, view.goalKey );
    const nextPending = nextKey ? pendingCount( entriesForDay( view.entries, nextKey, view.todayKey ) ) : 0;

    return scheduleGate( {
        todayKey: view.todayKey,
        todayPending,
        goalReached: view.goalMinutes !== null && focusMs >= view.goalMinutes * 60_000,
        nextWorkDayKey: nextKey,
        nextWorkDayPending: nextPending,
    } );

}

/**
 * May the next action pop up by itself? Never throws: when the schedule can't be read
 * (e.g. the migration isn't applied yet) the gate stays open, like before the schedule existed.
 */
export async function loadScheduleGate( supabase: SupabaseClient, projectId: string, rows?: PlanNodeRow[] ): Promise<ScheduleGate> {

    const todayKey = scheduleTodayKey();

    try {

        const [ project, nodeRows, items, focusMs ] = await Promise.all( [
            loadScheduleProject( supabase, projectId ),
            rows ? Promise.resolve( rows ) : loadPlanNodes( supabase, projectId ),
            loadScheduleItems( supabase, projectId ),
            loadTodayFocusMs( supabase, projectId, todayKey ),
        ] );

        if( !project ) return OPEN_GATE( todayKey );

        return gateOfView( buildScheduleView( project, nodeRows, items, todayKey ), focusMs );

    } catch( e ) {

        console.error( "[schedule] loadScheduleGate", e instanceof Error ? e.message : e );
        return OPEN_GATE( todayKey );

    }

}

/**
 * Tree highlight: nodes with pending entries today. Never throws: when the schedule can't be
 * read the tree simply shows no schedule highlight.
 */
export async function loadTodayScheduleHighlights( supabase: SupabaseClient, projectId: string ): Promise<Record<string, ScheduleHighlight>> {

    try {

        const view = await loadScheduleView( supabase, projectId );
        return view ? todayHighlights( view.entries, view.todayKey ) : {};

    } catch( e ) {

        console.error( "[schedule] loadTodayScheduleHighlights", e instanceof Error ? e.message : e );
        return {};

    }

}

/** Pending entries per day key (today includes carried ones) and done counts, for the dashboard. */
export interface ScheduleDayCounts { pending: number; done: number }

export function dayCountsOf( view: ScheduleView ): Record<string, ScheduleDayCounts> {

    const out: Record<string, ScheduleDayCounts> = {};
    const keys = new Set( view.entries.map( e => e.dayKey ) );
    keys.add( view.todayKey );

    for( const key of keys ) {
        const day = entriesForDay( view.entries, key, view.todayKey );
        // a past day's open entries carry over to today, so they only count there
        const counts = { pending: key < view.todayKey ? 0 : pendingCount( day ), done: day.filter( e => e.state === "done" ).length };
        if( counts.pending || counts.done ) out[ key ] = counts;
    }

    return out;

}
