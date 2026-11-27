"use server"

import { CALENDAR_TIMEZONE, CALENDAR_WEEKS_AROUND } from "@/lib/calendar/config";
import { buildCalendarWeeks, calendarRange, workedDaysByProject, type CalendarProject, type CalendarWeek } from "@/lib/calendar/week";
import { isProjectColor, PROJECT_COLORS, type ProjectColor } from "@/lib/projects/colors";
import { addDaysToKey, dateKeyInZone, startOfDayKey } from "@/lib/rewards/streaks";
import { createClient, requireUser } from "@/utils/supabase/server";
import { buildNextActionDays, type CalendarPlan, type NextActionDay } from "@/lib/calendar/next-actions";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlanKind } from "@/lib/next-action/config";

export type CalendarLegendItem = { id: string; name: string; color: ProjectColor };

export type CalendarData = {
    weeks: CalendarWeek[];
    todayKey: string;
    weeksAround: number;
    legend: CalendarLegendItem[];
    /** 今日 / 明日 next actions of every project */
    nextActionDays: NextActionDay[];
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

    const plans = await loadCalendarPlans( supabase, user.id );

    const workedDays = workedDaysByProject( recordRows ?? [], date => dateKeyInZone( date, CALENDAR_TIMEZONE ) );

    return {
        weeks: buildCalendarWeeks( { projects, workedDays, todayKey, weeksAround } ),
        todayKey,
        weeksAround,
        nextActionDays: buildNextActionDays( { projects, plans, todayKey } ),
        legend: projects.map( p => ( { id: p.id, name: p.name, color: isProjectColor( p.color ) ? p.color : PROJECT_COLORS[0].key } ) ),
    };

}
