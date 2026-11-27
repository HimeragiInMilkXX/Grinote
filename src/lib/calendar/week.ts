/**
 * Weekly calendar model (pure, unit-tested). Days are "YYYY-MM-DD" keys in CALENDAR_TIMEZONE,
 * weeks start on Monday.
 *
 * A project is "scheduled" on a day when the day's weekday is one of its work_days and the day
 * lies within its lifespan (the day it was created .. achieve_date_goal). Work recorded on a day
 * that wasn't scheduled shows as an "extra" entry. The goal day is flagged even if it isn't a work day.
 */

import { isProjectColor, PROJECT_COLORS, type ProjectColor } from "@/lib/projects/colors";
import { normalizeWorkDays } from "@/lib/projects/work-days";
import { addDaysToKey, isoWeekdayOfKey } from "@/lib/rewards/streaks";

export type CalendarProject = {
    id: string;
    name: string;
    color: string | null;
    work_days: number[] | null;
    /** day key the project was created (in the calendar time zone) */
    createdKey: string;
    /** yyyy-MM-dd (may carry a time part, only the date is used) */
    achieve_date_goal: string | null;
};

export type CalendarEntry = {
    projectId: string;
    name: string;
    color: ProjectColor;
    /** scheduled = planned work day, extra = worked on a day that wasn't planned, goal = only the goal-day marker */
    kind: "scheduled" | "extra" | "goal";
    /** a task record was started or finished that day */
    worked: boolean;
    isGoalDay: boolean;
};

export type CalendarDay = {
    key: string;
    /** 1 = Mon ... 7 = Sun */
    weekday: number;
    isToday: boolean;
    isPast: boolean;
    entries: CalendarEntry[];
};

export type CalendarWeek = {
    /** weeks from the current week (-n .. +n) */
    offset: number;
    startKey: string;
    endKey: string;
    days: CalendarDay[];
};

/** Monday of the week that contains `dayKey`. */
export function weekStartKey( dayKey: string ): string {

    return addDaysToKey( dayKey, 1 - isoWeekdayOfKey( dayKey ) );

}

/** First (Monday, n weeks back) and last (Sunday, n weeks ahead) day keys the calendar covers. */
export function calendarRange( todayKey: string, weeksAround: number ) {

    const monday = weekStartKey( todayKey );

    return {
        firstKey: addDaysToKey( monday, -7 * weeksAround ),
        lastKey: addDaysToKey( monday, 7 * weeksAround + 6 ),
    };

}

type BuildInput = {
    projects: readonly CalendarProject[];
    /** projectId -> day keys with recorded work */
    workedDays: ReadonlyMap<string, ReadonlySet<string>>;
    todayKey: string;
    weeksAround: number;
};

const NO_DAYS: ReadonlySet<string> = new Set();

export function buildCalendarWeeks( { projects, workedDays, todayKey, weeksAround }: BuildInput ): CalendarWeek[] {

    const n = Math.max( 0, Math.floor( weeksAround ) );
    const monday = weekStartKey( todayKey );

    const prepared = [ ...projects ]
        .sort( ( a, b ) => a.name.localeCompare( b.name, "ja" ) || a.id.localeCompare( b.id ) )
        .map( p => ( {
            id: p.id,
            name: p.name,
            color: isProjectColor( p.color ) ? p.color : PROJECT_COLORS[0].key,
            workDays: new Set<number>( normalizeWorkDays( p.work_days ) ),
            startKey: p.createdKey,
            goalKey: p.achieve_date_goal ? p.achieve_date_goal.slice( 0, 10 ) : null,
            worked: workedDays.get( p.id ) ?? NO_DAYS,
        } ) );

    const weeks: CalendarWeek[] = [];

    for( let offset = -n; offset <= n; offset++ ) {

        const startKey = addDaysToKey( monday, offset * 7 );
        const days: CalendarDay[] = [];

        for( let i = 0; i < 7; i++ ) {

            const key = addDaysToKey( startKey, i );
            const weekday = i + 1;
            const entries: CalendarEntry[] = [];

            for( const p of prepared ) {

                const inLifespan = key >= p.startKey && ( p.goalKey == null || key <= p.goalKey );
                const scheduled = inLifespan && p.workDays.has( weekday );
                const worked = p.worked.has( key );
                const isGoalDay = p.goalKey === key;

                if( !scheduled && !worked && !isGoalDay ) continue;

                entries.push( {
                    projectId: p.id,
                    name: p.name,
                    color: p.color,
                    kind: scheduled ? "scheduled" : worked ? "extra" : "goal",
                    worked,
                    isGoalDay,
                } );

            }

            days.push( { key, weekday, isToday: key === todayKey, isPast: key < todayKey, entries } );

        }

        weeks.push( { offset, startKey, endKey: addDaysToKey( startKey, 6 ), days } );

    }

    return weeks;

}

/** Groups work records into day keys per project. A record counts on the day it started and the day it was finished. */
export function workedDaysByProject(
    records: readonly { project_id: string; started_at: string | null; ended_at: string | null }[],
    toKey: ( date: Date ) => string,
): Map<string, Set<string>> {

    const map = new Map<string, Set<string>>();

    for( const r of records ) {

        let set = map.get( r.project_id );
        if( !set ) map.set( r.project_id, set = new Set() );

        for( const stamp of [ r.started_at, r.ended_at ] ) {

            if( !stamp ) continue;
            const date = new Date( stamp );
            if( !Number.isNaN( date.getTime() ) ) set.add( toKey( date ) );

        }

    }

    return map;

}
