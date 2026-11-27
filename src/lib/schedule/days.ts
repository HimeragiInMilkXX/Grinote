/** Day and week helpers for the schedule (pure, unit-tested). */

import { addDaysToKey } from "@/lib/rewards/streaks";
import { weekStartKey } from "@/lib/calendar/week";
import { SCHEDULE_MAX_WEEKS, SCHEDULE_MIN_WEEKS_AHEAD } from "./config";
import { compareEntries, isPending } from "./rules";
import type { DayTotal, ScheduleEntry, ScheduleHighlight } from "./types";

/**
 * The entries shown on a day: the ones scheduled for it, plus (on today) the open entries of
 * earlier days that carry over.
 */
export function entriesForDay( entries: readonly ScheduleEntry[], key: string, todayKey: string ): ScheduleEntry[] {

    return entries
        .filter( e => e.dayKey === key || ( key === todayKey && e.state === "carried" ) )
        .sort( ( a, b ) => {
            // carried entries first (oldest day first), then the day's own entries in tree order
            const ca = a.dayKey === key ? 1 : 0, cb = b.dayKey === key ? 1 : 0;
            if( ca !== cb ) return ca - cb;
            return compareEntries( a, b );
        } );

}

/** Planned minutes of a day's entries (stale ones don't count) against the daily goal. */
export function dayTotal( key: string, dayEntries: readonly ScheduleEntry[], goalMinutes: number | null ): DayTotal {

    const minutes = dayEntries.filter( e => e.state !== "stale" ).reduce( ( sum, e ) => sum + e.estimateMinutes, 0 );
    const goal = goalMinutes && goalMinutes > 0 ? goalMinutes : null;

    return { key, minutes, goalMinutes: goal, over: goal !== null && minutes > goal };

}

export const pendingCount = ( dayEntries: readonly ScheduleEntry[] ) => dayEntries.filter( isPending ).length;

/** Nodes with pending entries on today (its own open ones and carried ones), for the tree highlight. */
export function todayHighlights( entries: readonly ScheduleEntry[], todayKey: string ): Record<string, ScheduleHighlight> {

    const out: Record<string, ScheduleHighlight> = {};

    for( const e of entriesForDay( entries, todayKey, todayKey ) ) {
        if( !isPending( e ) ) continue;
        const h = out[ e.nodeId ] ??= { count: 0, carried: false, startable: e.startable };
        h.count++;
        if( e.state === "carried" ) h.carried = true;
    }

    return out;

}

/** The 7 day keys (Mon..Sun) of the week starting at `startKey`. */
export const weekDayKeys = ( startKey: string ) => Array.from( { length: 7 }, ( _, i ) => addDaysToKey( startKey, i ) );

/**
 * Monday keys the schedule page pages through, at most SCHEDULE_MAX_WEEKS weeks, starting at the
 * project's first week. With a goal date of today or later they end at the goal week (days after
 * the goal can't be planned). Without one, or when the goal is already past (overdue, no limit),
 * they reach SCHEDULE_MIN_WEEKS_AHEAD weeks past the current one. `lastEntryKey` (the latest open
 * entry) extends the range so an entry left after the goal stays reachable.
 * Returns the weeks and the index of the current week.
 */
export function scheduleWeeks( createdKey: string, goalKey: string | null, todayKey: string, lastEntryKey?: string | null ): { weeks: string[]; currentIndex: number } {

    const current = weekStartKey( todayKey );
    let first = weekStartKey( createdKey < todayKey ? createdKey : todayKey );
    let last = goalKey && goalKey >= todayKey
        ? weekStartKey( goalKey )
        : addDaysToKey( current, 7 * SCHEDULE_MIN_WEEKS_AHEAD );
    if( lastEntryKey && lastEntryKey >= todayKey && weekStartKey( lastEntryKey ) > last ) last = weekStartKey( lastEntryKey );

    // keep the window bounded: drop the oldest weeks first, then the farthest ones
    const weeksBetween = ( a: string, b: string ) => Math.round( ( Date.parse( b ) - Date.parse( a ) ) / ( 7 * 86_400_000 ) );
    if( weeksBetween( first, last ) + 1 > SCHEDULE_MAX_WEEKS ) {
        const before = Math.min( weeksBetween( first, current ), Math.floor( SCHEDULE_MAX_WEEKS / 4 ) );
        first = addDaysToKey( current, -7 * before );
    }

    const weeks: string[] = [];
    for( let key = first; key <= last && weeks.length < SCHEDULE_MAX_WEEKS; key = addDaysToKey( key, 7 ) ) weeks.push( key );

    return { weeks, currentIndex: Math.max( 0, weeks.indexOf( current ) ) };

}
