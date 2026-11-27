/**
 * Day logic for the next action (pure, unit-tested). Days are "YYYY-MM-DD" keys in
 * NEXT_ACTION_TIMEZONE (Tokyo), like streaks and the calendar.
 */

import { addDaysToKey, dateKeyInZone, isoWeekdayOfKey } from "@/lib/rewards/streaks";
import type { PlanIntent } from "./config";

/** Empty work days = every day is a work day (same as the streak rules). */
export function isWorkDayKey( key: string, workDays: readonly number[] | null | undefined ): boolean {

    if( !workDays || workDays.length === 0 ) return true;

    return workDays.includes( isoWeekdayOfKey( key ) );

}

/** The first work day strictly after `todayKey`, or null when there is none up to `goalKey`. */
export function nextWorkDayKey( todayKey: string, workDays: readonly number[] | null | undefined, goalKey?: string | null ): string | null {

    // a goal date already in the past doesn't limit anything (the project is simply overdue)
    const limit = goalKey && goalKey >= todayKey ? goalKey : null;

    for( let i = 1; i <= 7; i++ ) {
        const key = addDaysToKey( todayKey, i );
        if( limit && key > limit ) return null;
        if( isWorkDayKey( key, workDays ) ) return key;
    }

    return null;

}

export interface DayRecord {
    started_at: string;
    ended_at: string | null;
    /** focus ms */
    duration: number | string | null;
    status: string;
}

/** Focus ms of the records that started or ended today (abandoned ones don't count). */
export function todayFocusMs( records: readonly DayRecord[], todayKey: string, timeZone: string ): number {

    let total = 0;

    for( const r of records ) {
        if( r.status === "abandoned" ) continue;
        const startedToday = dateKeyInZone( new Date( r.started_at ), timeZone ) === todayKey;
        const endedToday = !!r.ended_at && dateKeyInZone( new Date( r.ended_at ), timeZone ) === todayKey;
        if( !startedToday && !endedToday ) continue;
        const ms = Number( r.duration );
        if( Number.isFinite( ms ) && ms > 0 ) total += ms;
    }

    return total;

}

export interface ScheduleContext {
    todayKey: string;
    todayIsWorkDay: boolean;
    /** daily goal minus today's focus; null when the project has no daily goal */
    remainingMs: number | null;
    nextWorkDay: string | null;
    goalKey: string | null;
}

export type PlanWhen = "today" | "next_work_day";

/** What the app would pick by itself: today while there is time left on a work day, else the next work day. */
export function defaultWhen( ctx: ScheduleContext ): PlanWhen {

    if( !ctx.nextWorkDay ) return "today";
    if( ctx.todayIsWorkDay && ( ctx.remainingMs === null || ctx.remainingMs > 0 ) ) return "today";

    return "next_work_day";

}

/**
 * The scheduled day. The user's choice wins (next work day / now); otherwise ("unsure", or no
 * choice after a tree save) the model's `when` is used, falling back to `defaultWhen`.
 */
export function resolveScheduledFor( intent: PlanIntent | null, modelWhen: string | null | undefined, ctx: ScheduleContext ): { when: PlanWhen; key: string } {

    let when: PlanWhen;

    if( intent === "continue_now" ) when = "today";
    else if( intent === "next_work_day" ) when = "next_work_day";
    else if( modelWhen === "today" || modelWhen === "next_work_day" ) when = modelWhen;
    else when = defaultWhen( ctx );

    // no work day left before the goal date: today is the only day we can offer
    if( when === "next_work_day" && !ctx.nextWorkDay ) when = "today";

    return { when, key: when === "today" ? ctx.todayKey : ctx.nextWorkDay! };

}

/** A date the user may pick by hand: today up to the goal date (inclusive). */
export function isPickableDay( key: string, todayKey: string, goalKey: string | null ): boolean {

    if( !/^\d{4}-\d{2}-\d{2}$/.test( key ) ) return false;
    if( key < todayKey ) return false;
    if( goalKey && goalKey >= todayKey && key > goalKey ) return false;

    return true;

}
