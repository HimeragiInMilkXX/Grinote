/**
 * Streak rules for the reward formula (provisional product rules, see docs/reward-engine.md).
 * Day boundaries use a fixed time zone (REWARD_DAY_TIMEZONE). Days are "YYYY-MM-DD" keys.
 */

/** Rule ids stored in the reward snapshot so history can tell which rule produced a streak. */
export const PROJECT_STREAK_RULE = "workday-aware-v1";
export const TASK_STREAK_RULE = "today-earlier-completions-abandon-resets-v1";

const dateKeyFormatters = new Map<string, Intl.DateTimeFormat>();

/** "YYYY-MM-DD" of `date` in `timeZone`. */
export function dateKeyInZone( date: Date, timeZone: string ): string {

    let fmt = dateKeyFormatters.get( timeZone );

    if( !fmt ) {
        fmt = new Intl.DateTimeFormat( "en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" } );
        dateKeyFormatters.set( timeZone, fmt );
    }

    return fmt.format( date );

}

function parseKey( key: string ) {

    const [ y, m, d ] = key.split( "-" ).map( Number );
    return { y, m, d };

}

/** Shift a "YYYY-MM-DD" key by whole days. */
export function addDaysToKey( key: string, days: number ): string {

    const { y, m, d } = parseKey( key );
    return new Date( Date.UTC( y, m - 1, d + days ) ).toISOString().slice( 0, 10 );

}

/** ISO weekday of a day key (1 = Mon ... 7 = Sun). */
export function isoWeekdayOfKey( key: string ): number {

    const { y, m, d } = parseKey( key );
    return new Date( Date.UTC( y, m - 1, d ) ).getUTCDay() || 7;

}

function zoneOffsetMs( instant: Date, timeZone: string ): number {

    const parts = new Intl.DateTimeFormat( "en-US", {
        timeZone, hourCycle: "h23",
        year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
    } ).formatToParts( instant );

    const get = ( type: string ) => Number( parts.find( p => p.type === type )?.value );

    const asUtc = Date.UTC( get( "year" ), get( "month" ) - 1, get( "day" ), get( "hour" ), get( "minute" ), get( "second" ) );

    return asUtc - Math.floor( instant.getTime() / 1000 ) * 1000;

}

/** The instant a day key starts in `timeZone` (for DB range queries). */
export function startOfDayKey( key: string, timeZone: string ): Date {

    const { y, m, d } = parseKey( key );
    const guess = new Date( Date.UTC( y, m - 1, d ) );

    return new Date( guess.getTime() - zoneOffsetMs( guess, timeZone ) );

}

export interface ProjectStreakInput {
    /** Day keys that already have at least one completed task (today may or may not be included). */
    completionDayKeys: Iterable<string>;
    /** Today's key. Today always counts: the completion being rewarded happens today. */
    todayKey: string;
    /** ISO weekdays the user plans to work. Empty = every day is a work day. */
    workDays: readonly number[];
    /** Don't walk back past this day (the project's creation day). */
    earliestDayKey?: string;
    maxLookbackDays?: number;
}

/**
 * Consecutive project days, counting today.
 * Walking back from yesterday: a day with a completion adds 1; a work day without one ends the
 * streak; a non-work day without one is skipped (it neither adds nor breaks).
 */
export function computeProjectStreak( { completionDayKeys, todayKey, workDays, earliestDayKey, maxLookbackDays = 400 }: ProjectStreakInput ): number {

    const done = new Set( completionDayKeys );
    const isWorkDay = ( key: string ) => workDays.length === 0 || workDays.includes( isoWeekdayOfKey( key ) );

    let streak = 1;
    let cursor = addDaysToKey( todayKey, -1 );

    for( let i = 0; i < maxLookbackDays; i++, cursor = addDaysToKey( cursor, -1 ) ) {

        if( earliestDayKey && cursor < earliestDayKey ) break;

        if( done.has( cursor ) ) streak++;
        else if( isWorkDay( cursor ) ) break;

    }

    return streak;

}

export interface TaskStreakEvent {
    status: "completed" | "abandoned";
    /** When it happened (completed_at, or updated_at for abandoned records). */
    at: string | Date;
}

/**
 * Consecutive completed tasks earlier today (the one being rewarded is not included).
 * Counts back from the most recent event and stops at the first abandoned task.
 */
export function computeTaskStreak( todayEvents: readonly TaskStreakEvent[] ): number {

    const sorted = [ ...todayEvents ].sort( ( a, b ) => new Date( b.at ).getTime() - new Date( a.at ).getTime() );

    let streak = 0;

    for( const event of sorted ) {

        if( event.status === "abandoned" ) break;
        streak++;

    }

    return streak;

}

export interface StreakHistoryInput {
    /** Day keys with at least one completed task. */
    completionDayKeys: Iterable<string>;
    todayKey: string;
    /** ISO weekdays the user plans to work. Empty = every day is a work day. */
    workDays: readonly number[];
    maxLookbackDays?: number;
}

const isWorkDayKey = ( workDays: readonly number[], key: string ) => workDays.length === 0 || workDays.includes( isoWeekdayOfKey( key ) );

/**
 * The streak that is alive right now (journey page), with the same work-day rule as
 * computeProjectStreak. Today counts if it has a completion; a work day still in progress
 * (today without a completion yet) does not break the streak.
 */
export function computeCurrentStreak( { completionDayKeys, todayKey, workDays, maxLookbackDays = 400 }: StreakHistoryInput ): number {

    const done = new Set( completionDayKeys );

    let streak = done.has( todayKey ) ? 1 : 0;
    let cursor = addDaysToKey( todayKey, -1 );

    for( let i = 0; i < maxLookbackDays; i++, cursor = addDaysToKey( cursor, -1 ) ) {

        if( done.has( cursor ) ) streak++;
        else if( isWorkDayKey( workDays, cursor ) ) break;

    }

    return streak;

}

/**
 * The longest streak ever reached, walking forward from the first completion to today with the
 * same rule (a completion adds 1, a missed work day resets, a free day without work is skipped).
 */
export function computeLongestStreak( { completionDayKeys, todayKey, workDays }: StreakHistoryInput ): number {

    const done = new Set( completionDayKeys );
    if( done.size === 0 ) return 0;

    const first = [ ...done ].sort()[0];

    let best = 0;
    let run = 0;

    for( let cursor = first; cursor <= todayKey; cursor = addDaysToKey( cursor, 1 ) ) {

        if( done.has( cursor ) ) {
            run++;
            if( run > best ) best = run;
        }
        else if( cursor !== todayKey && isWorkDayKey( workDays, cursor ) ) run = 0;

    }

    return best;

}
