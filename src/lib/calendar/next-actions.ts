/**
 * The 今日 / 明日 next action panel under the weekly calendar (pure, unit-tested).
 * Every project is listed on both days (name + color). Its saved next action shows on the day it
 * is scheduled; one from an earlier day that isn't finished carries over to today (持ち越し).
 */

import type { PlanKind } from "@/lib/next-action/config";
import type { PlanItemRole } from "@/lib/next-action/types";
import { isProjectColor, PROJECT_COLORS, type ProjectColor } from "@/lib/projects/colors";
import { addDaysToKey, isoWeekdayOfKey } from "@/lib/rewards/streaks";

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

export interface NextActionProjectInput {
    id: string;
    name: string;
    color: string | null;
    work_days: number[] | null;
    achieve_date_goal?: string | null;
}

export interface NextActionDayRow {
    projectId: string;
    name: string;
    color: ProjectColor;
    isWorkDay: boolean;
    /** the goal date is before this day */
    pastGoal: boolean;
    plan: { kind: PlanKind; items: CalendarPlanItem[]; carriedOver: boolean; scheduledFor: string } | null;
    /** a plan scheduled after tomorrow (shown as a hint) */
    laterKey: string | null;
}

export interface NextActionDay {
    key: string;
    label: "今日" | "明日";
    rows: NextActionDayRow[];
}

export function buildNextActionDays( { projects, plans, todayKey }: { projects: readonly NextActionProjectInput[]; plans: readonly CalendarPlan[]; todayKey: string } ): NextActionDay[] {

    const tomorrowKey = addDaysToKey( todayKey, 1 );
    const planOf = new Map( plans.filter( p => p.items.some( i => !i.done ) ).map( p => [ p.projectId, p ] ) );
    const sorted = [ ...projects ].sort( ( a, b ) => a.name.localeCompare( b.name, "ja" ) || a.id.localeCompare( b.id ) );

    const day = ( key: string, label: NextActionDay["label"] ): NextActionDay => ( {
        key,
        label,
        rows: sorted.map( p => {
            const plan = planOf.get( p.id );
            const workDays = p.work_days ?? [];
            const onThisDay = plan && ( plan.scheduledFor === key || ( label === "今日" && plan.scheduledFor < todayKey ) );
            return {
                projectId: p.id,
                name: p.name,
                color: isProjectColor( p.color ) ? p.color : PROJECT_COLORS[0].key,
                isWorkDay: workDays.length === 0 || workDays.includes( isoWeekdayOfKey( key ) ),
                pastGoal: !!p.achieve_date_goal && p.achieve_date_goal.slice( 0, 10 ) < key,
                plan: onThisDay ? { kind: plan.kind, items: plan.items, carriedOver: plan.scheduledFor < todayKey, scheduledFor: plan.scheduledFor } : null,
                laterKey: plan && plan.scheduledFor > tomorrowKey ? plan.scheduledFor : null,
            };
        } ),
    } );

    return [ day( todayKey, "今日" ), day( tomorrowKey, "明日" ) ];

}
