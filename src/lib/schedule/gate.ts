/**
 * When may the next action pop up by itself (after a task completion or a tree save)?
 * The schedule is the user's own plan, so the AI suggestion only fills a gap (pure, unit-tested):
 *
 * - allowed when no scheduled task is left for today, or
 * - when the "next day" has none. The next day is today while today's daily goal isn't reached
 *   yet (so that case is the same as the first rule), otherwise the next work day.
 *
 * The manual entry point on the dashboard is never gated.
 */

export interface ScheduleGateInput {
    todayKey: string;
    /** open + carried entries shown on today */
    todayPending: number;
    /** today's focus reached daily_time_goal (false when there is no goal) */
    goalReached: boolean;
    nextWorkDayKey: string | null;
    /** open entries on the next work day */
    nextWorkDayPending: number;
}

export interface ScheduleGate {
    allowed: boolean;
    todayPending: number;
    /** the day the rule looked at after today */
    nextDayKey: string;
    nextDayPending: number;
}

export function scheduleGate( input: ScheduleGateInput ): ScheduleGate {

    const useToday = !input.goalReached || !input.nextWorkDayKey;
    const nextDayKey = useToday ? input.todayKey : input.nextWorkDayKey!;
    const nextDayPending = useToday ? input.todayPending : input.nextWorkDayPending;

    return {
        allowed: input.todayPending === 0 || nextDayPending === 0,
        todayPending: input.todayPending,
        nextDayKey,
        nextDayPending,
    };

}

/** Used when the schedule can't be read: never block the next action because of it. */
export const OPEN_GATE = ( todayKey: string ): ScheduleGate => ( { allowed: true, todayPending: 0, nextDayKey: todayKey, nextDayPending: 0 } );
