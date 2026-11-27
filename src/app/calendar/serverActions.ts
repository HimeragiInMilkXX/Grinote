"use server"

import { CALENDAR_TIMEZONE, CALENDAR_WEEKS_AROUND } from "@/lib/calendar/config";
import { buildCalendarWeeks, calendarRange, workedDaysByProject, type CalendarProject, type CalendarWeek } from "@/lib/calendar/week";
import { isProjectColor, PROJECT_COLORS, type ProjectColor } from "@/lib/projects/colors";
import { addDaysToKey, dateKeyInZone, startOfDayKey } from "@/lib/rewards/streaks";
import { createClient, requireUser } from "@/utils/supabase/server";
import type { CalendarPlan, CalendarScheduleEntry, DayPanelProjectInput } from "@/lib/calendar/day-panel";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlanKind } from "@/lib/next-action/config";
import { PLAN_NODE_SELECT, type PlanNodeRow } from "@/lib/next-action/candidates";
import { buildEntries, buildScheduleNodes } from "@/lib/schedule/rules";
import { SCHEDULE_ITEM_SELECT, type ScheduleItemRow } from "@/lib/schedule/types";

export type CalendarLegendItem = { id: string; name: string; color: ProjectColor };

export type CalendarData = {
    weeks: CalendarWeek[];
    todayKey: string;
    weeksAround: number;
    legend: CalendarLegendItem[];
    /** for the focused-day panel (src/lib/calendar/day-panel.ts) */
    panelProjects: DayPanelProjectInput[];
    plans: CalendarPlan[];
    scheduleEntries: CalendarScheduleEntry[];
};

type SavedPlanRow = {
    project_id: string;
    kind: PlanKind;
    scheduled_for: string;
    saved_at: string;
    progress_node_id: string | null;
    practice_node_id: string | null;
    progress_task_name: string | null;
    practice_task_name: string | null;
    progress_done_at: string | null;
    practice_done_at: string | null;
};

/** The current (latest saved) next action of each project, with current task names. Never throws. */
async function loadCalendarPlans( supabase: SupabaseClient, userId: string ): Promise<CalendarPlan[]> {

    try {

        const { data, error } = await supabase
            .from( "next_actions" )
            .select( "project_id, kind, scheduled_for, saved_at, progress_node_id, practice_node_id, progress_task_name, practice_task_name, progress_done_at, practice_done_at" )
            .eq( "user_id", userId ).eq( "status", "saved" )
            .order( "saved_at", { ascending: false } );

        if( error ) throw new Error( error.message );

        const latest = new Map<string, SavedPlanRow>();
        for( const row of ( data ?? [] ) as SavedPlanRow[] ) if( !latest.has( row.project_id ) ) latest.set( row.project_id, row );

        const nodeIds = [ ...latest.values() ].flatMap( r => [ r.progress_node_id, r.practice_node_id ] ).filter( ( id ): id is string => !!id );
        const names = new Map<string, string>();

        if( nodeIds.length ) {
            const { data: nodes, error: nodeError } = await supabase.from( "nodes" ).select( "id, task_name" ).in( "id", nodeIds );
            if( nodeError ) throw new Error( nodeError.message );
            for( const n of nodes ?? [] ) names.set( n.id, n.task_name );
        }

        const nameOf = ( id: string | null, snapshot: string | null ) => ( id && names.get( id ) ) || snapshot || "（削除されたタスク）";

        return [ ...latest.values() ].map( r => ( {
            projectId: r.project_id,
            kind: r.kind,
            scheduledFor: r.scheduled_for,
            items: [
                ...( r.kind === "practice_progress" ? [ { role: "practice" as const, name: nameOf( r.practice_node_id, r.practice_task_name ), done: !!r.practice_done_at } ] : [] ),
                { role: "progress" as const, name: nameOf( r.progress_node_id, r.progress_task_name ), done: !!r.progress_done_at },
            ],
        } ) );

    } catch( e ) {

        console.error( "[calendar] next actions", e instanceof Error ? e.message : e );
        return [];

    }

}

/**
 * Schedule entries of every project: all unfinished ones (they may carry over or lie far ahead)
 * plus the done ones from `firstKey` on. Names and tree order come from each project's tree.
 * Never throws (the calendar still works without the schedule, e.g. before the migration).
 */
async function loadCalendarSchedule( supabase: SupabaseClient, userId: string, projectIds: string[], firstKey: string, todayKey: string ): Promise<CalendarScheduleEntry[]> {

    if( projectIds.length === 0 ) return [];

    try {

        const [ itemsRes, nodesRes ] = await Promise.all( [
            supabase.from( "schedule_items" ).select( SCHEDULE_ITEM_SELECT )
                .eq( "user_id", userId )
                .or( `done_at.is.null,scheduled_for.gte.${firstKey}` ),
            supabase.from( "nodes" ).select( `project_id, ${PLAN_NODE_SELECT}` ).in( "project_id", projectIds ),
        ] );

        if( itemsRes.error ) throw new Error( itemsRes.error.message );
        if( nodesRes.error ) throw new Error( nodesRes.error.message );

        const items = ( itemsRes.data ?? [] ) as ScheduleItemRow[];
        const nodesOf = new Map<string, PlanNodeRow[]>();
        for( const row of ( nodesRes.data ?? [] ) as unknown as ( PlanNodeRow & { project_id: string } )[] ) {
            const list = nodesOf.get( row.project_id ) ?? [];
            list.push( row );
            nodesOf.set( row.project_id, list );
        }

        return projectIds.flatMap( projectId => {
            const own = items.filter( i => i.project_id === projectId );
            if( own.length === 0 ) return [];
            return buildEntries( own, buildScheduleNodes( nodesOf.get( projectId ) ?? [] ), todayKey ).map( e => ( {
                id: e.id,
                projectId,
                nodeId: e.nodeId,
                name: e.name,
                dayKey: e.dayKey,
                state: e.state,
                isLoop: e.isLoop,
                order: e.order,
            } ) );
        } );

    } catch( e ) {

        console.error( "[calendar] schedule", e instanceof Error ? e.message : e );
        return [];

    }

}

/** All of the user's projects laid out on the weeks around today (CALENDAR_WEEKS_AROUND on each side). */
export async function getCalendarData(): Promise<CalendarData> {

    const supabase = await createClient();
    const user = await requireUser( supabase );

    const now = new Date();
    const todayKey = dateKeyInZone( now, CALENDAR_TIMEZONE );
    const weeksAround = CALENDAR_WEEKS_AROUND;
    const { firstKey, lastKey } = calendarRange( todayKey, weeksAround );

    const { data: projectRows, error: projectError } = await supabase
        .from( "projects" )
        .select( "id, name, color, work_days, created_at, achieve_date_goal" )
        .eq( "user_id", user.id )
        .order( "created_at" );

    if( projectError ) throw new Error( projectError.message );

    const rangeStart = startOfDayKey( firstKey, CALENDAR_TIMEZONE ).toISOString();
    const rangeEnd = startOfDayKey( addDaysToKey( lastKey, 1 ), CALENDAR_TIMEZONE ).toISOString();

    // records that started or ended inside the visible range (abandoned attempts don't count as work)
    const { data: recordRows, error: recordError } = await supabase
        .from( "records" )
        .select( "project_id, started_at, ended_at" )
        .eq( "user_id", user.id )
        .neq( "status", "abandoned" )
        .lt( "started_at", rangeEnd )
        .or( `started_at.gte.${rangeStart},ended_at.gte.${rangeStart}` );

    if( recordError ) throw new Error( recordError.message );

    const projects: CalendarProject[] = ( projectRows ?? [] ).map( p => ( {
        id: p.id,
        name: p.name,
        color: p.color,
        work_days: p.work_days,
        createdKey: dateKeyInZone( new Date( p.created_at ), CALENDAR_TIMEZONE ),
        achieve_date_goal: p.achieve_date_goal,
    } ) );

    const [ plans, scheduleEntries ] = await Promise.all( [
        loadCalendarPlans( supabase, user.id ),
        loadCalendarSchedule( supabase, user.id, projects.map( p => p.id ), firstKey, todayKey ),
    ] );

    const workedDays = workedDaysByProject( recordRows ?? [], date => dateKeyInZone( date, CALENDAR_TIMEZONE ) );

    return {
        weeks: buildCalendarWeeks( { projects, workedDays, todayKey, weeksAround } ),
        todayKey,
        weeksAround,
        panelProjects: projects.map( p => ( { id: p.id, name: p.name, color: p.color, work_days: p.work_days, achieve_date_goal: p.achieve_date_goal } ) ),
        plans,
        scheduleEntries,
        legend: projects.map( p => ( { id: p.id, name: p.name, color: isProjectColor( p.color ) ? p.color : PROJECT_COLORS[0].key } ) ),
    };

}
