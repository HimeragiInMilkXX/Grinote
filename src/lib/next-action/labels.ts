/** Client-safe display helpers for the next action. */

import { WEEKDAYS } from "@/lib/projects/work-days";
import { addDaysToKey, isoWeekdayOfKey } from "@/lib/rewards/streaks";
import type { PlanItemRole, PlanItemState } from "./types";

/** 今日 / 明日 / 12月1日(月) */
export function dayLabel( key: string, todayKey: string ): string {

    if( key === todayKey ) return "今日";
    if( key === addDaysToKey( todayKey, 1 ) ) return "明日";

    const [ , m, d ] = key.split( "-" ).map( Number );

    return `${m}月${d}日(${WEEKDAYS[ isoWeekdayOfKey( key ) - 1 ]?.label ?? ""})`;

}

export const ROLE_LABELS: Record<PlanItemRole, string> = {
    practice: "練習",
    progress: "進捗",
};

export const ITEM_STATE_LABELS: Record<PlanItemState, string | null> = {
    ok: null,
    done: "完了",
    missing: "削除されました",
    blocked: "子タスクが未完了です",
    completed: "完了済み",
};

export const formatEstimate = ( minutes: number ) => minutes <= 0 ? null : minutes < 60 ? `${minutes}分` : `${Math.floor( minutes / 60 )}時間${minutes % 60 ? `${minutes % 60}分` : ""}`;
