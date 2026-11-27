"use server"

import { CALENDAR_TIMEZONE, CALENDAR_WEEKS_AROUND } from "@/lib/calendar/config";
import { buildCalendarWeeks, calendarRange, workedDaysByProject, type CalendarProject, type CalendarWeek } from "@/lib/calendar/week";
import { isProjectColor, PROJECT_COLORS, type ProjectColor } from "@/lib/projects/colors";
import { addDaysToKey, dateKeyInZone, startOfDayKey } from "@/lib/rewards/streaks";
import { createClient, requireUser } from "@/utils/supabase/server";

export type CalendarLegendItem = { id: string; name: string; color: ProjectColor };

export type CalendarData = {
    weeks: CalendarWeek[];
    todayKey: string;
    weeksAround: number;
    legend: CalendarLegendItem[];
};

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

    const workedDays = workedDaysByProject( recordRows ?? [], date => dateKeyInZone( date, CALENDAR_TIMEZONE ) );

    return {
        weeks: buildCalendarWeeks( { projects, workedDays, todayKey, weeksAround } ),
        todayKey,
        weeksAround,
        legend: projects.map( p => ( { id: p.id, name: p.name, color: isProjectColor( p.color ) ? p.color : PROJECT_COLORS[0].key } ) ),
    };

}
