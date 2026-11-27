/**
 * The panel under the account calendar for the focused day (pure, unit-tested). Replaces the
 * fixed 今日 / 明日 next action panel (MVP 6.0).
 *
 * Every project is listed. For each one:
 * - the focused day's unfinished scheduled tasks in tree order (on today, open entries of earlier
 *   days carry over), plus how many of that day's entries are done;
 * - the next later day that has scheduled tasks, with those tasks;
 * - its saved next action when it belongs to the focused day (an unfinished one of an earlier day
 *   carries over to today), else a hint for a later one.
 */

import type { PlanKind } from "@/lib/next-action/config";
import type { PlanItemRole } from "@/lib/next-action/types";
import { isProjectColor, PROJECT_COLORS, type ProjectColor } from "@/lib/projects/colors";
import { isoWeekdayOfKey } from "@/lib/rewards/streaks";
import type { ScheduleEntryState } from "@/lib/schedule/types";

export interface CalendarPlanItem {
    role: PlanItemRole;
    name: string;
    done: boolean;
}

export interface CalendarPlan {
    projectId: string;
    kind: PlanKind;
    scheduledFor: string;
    items: CalendarPlanItem[];
}

/** A schedule entry as the calendar shows it (serializable). */
export interface CalendarScheduleEntry {
    id: string;
    projectId: string;
    nodeId: string;
    name: string;
    dayKey: string;
    state: ScheduleEntryState;
    isLoop: boolean;
    /** tree order inside its project */
    order: number;
}

export interface DayPanelProjectInput {
    id: string;
    name: string;
    color: string | null;
    work_days: number[] | null;
    achieve_date_goal?: string | null;
}

export interface DayPanelRow {
    projectId: string;
    name: string;
    color: ProjectColor;
    isWorkDay: boolean;
    /** the goal date is before this day */
    pastGoal: boolean;
    /** unfinished scheduled tasks of the day (carried ones first on today) */
    tasks: CalendarScheduleEntry[];
    /** done entries scheduled for the day */
    doneCount: number;
    /** the next later day with unfinished scheduled tasks */
    next: { key: string; tasks: CalendarScheduleEntry[] } | null;
    plan: { kind: PlanKind; items: CalendarPlanItem[]; carriedOver: boolean; scheduledFor: string } | null;
    /** an unfinished next action scheduled after the focused day (hint) */
    planLaterKey: string | null;
}

export interface DayPanel {
    key: string;
    rows: DayPanelRow[];
}

const byDayThenTree = ( a: CalendarScheduleEntry, b: CalendarScheduleEntry ) =>
    a.dayKey !== b.dayKey ? ( a.dayKey < b.dayKey ? -1 : 1 ) : a.order - b.order;

export function buildDayPanel( { projects, plans, entries, focusKey, todayKey }: {
    projects: readonly DayPanelProjectInput[];
    plans: readonly CalendarPlan[];
    entries: readonly CalendarScheduleEntry[];
    focusKey: string;
    todayKey: string;
} ): DayPanel {

    const planOf = new Map( plans.filter( p => p.items.some( i => !i.done ) ).map( p => [ p.projectId, p ] ) );
    const sorted = [ ...projects ].sort( ( a, b ) => a.name.localeCompare( b.name, "ja" ) || a.id.localeCompare( b.id ) );
    const isToday = focusKey === todayKey;

    const entriesOf = new Map<string, CalendarScheduleEntry[]>();
    for( const e of entries ) {
        const list = entriesOf.get( e.projectId ) ?? [];
        list.push( e );
        entriesOf.set( e.projectId, list );
    }

    return {
        key: focusKey,
        rows: sorted.map( p => {

            const own = ( entriesOf.get( p.id ) ?? [] ).slice().sort( byDayThenTree );
            const plan = planOf.get( p.id );
            const workDays = p.work_days ?? [];
            const onThisDay = plan && ( plan.scheduledFor === focusKey || ( isToday && plan.scheduledFor < todayKey ) );

            // the focused day: its unfinished entries; today also shows carried ones (oldest first)
            const tasks = own.filter( e =>
                ( e.dayKey === focusKey && ( e.state === "open" || e.state === "carried" ) )
                || ( isToday && e.state === "carried" && e.dayKey !== focusKey ),
            ).sort( ( a, b ) => ( a.dayKey === focusKey ? 1 : 0 ) - ( b.dayKey === focusKey ? 1 : 0 ) || byDayThenTree( a, b ) );

            const nextKey = own.find( e => e.state === "open" && e.dayKey > focusKey )?.dayKey ?? null;

            return {
                projectId: p.id,
                name: p.name,
                color: isProjectColor( p.color ) ? p.color : PROJECT_COLORS[0].key,
                isWorkDay: workDays.length === 0 || workDays.includes( isoWeekdayOfKey( focusKey ) ),
                pastGoal: !!p.achieve_date_goal && p.achieve_date_goal.slice( 0, 10 ) < focusKey,
                tasks,
                doneCount: own.filter( e => e.dayKey === focusKey && e.state === "done" ).length,
                next: nextKey ? { key: nextKey, tasks: own.filter( e => e.dayKey === nextKey && e.state === "open" ) } : null,
                plan: onThisDay ? { kind: plan.kind, items: plan.items, carriedOver: plan.scheduledFor < todayKey, scheduledFor: plan.scheduledFor } : null,
                planLaterKey: plan && plan.scheduledFor > focusKey ? plan.scheduledFor : null,
            };

        } ),
    };

}

/** Unfinished scheduled tasks per "projectId|dayKey" (carried ones count on today), for calendar badges. */
export function pendingCounts( entries: readonly CalendarScheduleEntry[], todayKey: string ): Map<string, number> {

    const map = new Map<string, number>();

    for( const e of entries ) {
        if( e.state !== "open" && e.state !== "carried" ) continue;
        const key = `${e.projectId}|${e.state === "carried" ? todayKey : e.dayKey}`;
        map.set( key, ( map.get( key ) ?? 0 ) + 1 );
    }

    return map;

}
