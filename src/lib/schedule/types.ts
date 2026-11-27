/** Client-safe schedule types (MVP 6.0). */

/** A `schedule_items` row. */
export interface ScheduleItemRow {
    id: string;
    project_id: string;
    node_id: string;
    /** "YYYY-MM-DD" (Postgres date) */
    scheduled_for: string;
    done_at: string | null;
    record_id: number | null;
    created_at: string;
}

export const SCHEDULE_ITEM_SELECT = "id, project_id, node_id, scheduled_for, done_at, record_id, created_at";

/**
 * schedulable: open action whose children are complete (could be started now)
 * blocked: open action waiting for its subtasks (can still be scheduled, with a note)
 */
export type ScheduleNodeState = "schedulable" | "blocked" | "completed" | "not_action" | "root";

export interface ScheduleNode {
    id: string;
    name: string;
    /** ancestor names from the root's child down to the parent */
    path: string[];
    isLoop: boolean;
    repetitionsCompleted: number;
    repetitionsRequired: number;
    /** one session (`time_limit`), 0 = no estimate */
    estimateMinutes: number;
    state: ScheduleNodeState;
    /** position in tree order (depth-first) */
    order: number;
}

/**
 * open: not done, today or later
 * carried: not done, its day has passed (shown on today as 持ち越し)
 * done: ticked by a completed task report (frozen)
 * stale: not done, but the node was completed another way, deleted from the plan, or isn't an action anymore
 */
export type ScheduleEntryState = "open" | "carried" | "done" | "stale";

export interface ScheduleEntry {
    id: string;
    nodeId: string;
    name: string;
    path: string[];
    /** the scheduled day */
    dayKey: string;
    state: ScheduleEntryState;
    doneAt: string | null;
    estimateMinutes: number;
    isLoop: boolean;
    /** could be started on on-air right now */
    startable: boolean;
    order: number;
    createdAt: string;
}

/** A tree node with pending entries on today (for the tree highlight). */
export interface ScheduleHighlight {
    /** pending sessions today (carried ones included) */
    count: number;
    /** at least one of them is carried over from an earlier day */
    carried: boolean;
    /** could be started now (false = waiting for subtasks) */
    startable: boolean;
}

export interface ScheduleAddOp{ node_id: string; date: string; count: number }
export interface ScheduleMoveOp { item_id: string; date: string }
export interface ScheduleRemoveOp { item_id: string }

export interface ScheduleOps {
    add: ScheduleAddOp[];
    move: ScheduleMoveOp[];
    remove: ScheduleRemoveOp[];
}

export interface DayTotal {
    key: string;
    minutes: number;
    /** null = the project has no daily goal */
    goalMinutes: number | null;
    over: boolean;
}

export interface DayChange {
    key: string;
    beforeMinutes: number;
    afterMinutes: number;
    goalMinutes: number | null;
    over: boolean;
}
