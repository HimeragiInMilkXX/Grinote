import type { PlanIntent, PlanKind, PlanOrigin, PlanStatus } from "./config";
import type { PlanRevision } from "./prompt";

/** A `next_actions` row. */
export interface NextActionRow {
    id: string;
    project_id: string;
    user_id: string;
    status: PlanStatus;
    origin: PlanOrigin;
    intent: PlanIntent | null;
    kind: PlanKind | null;
    source: "ai" | "user";
    progress_node_id: string | null;
    practice_node_id: string | null;
    progress_task_name: string | null;
    practice_task_name: string | null;
    progress_reason: string | null;
    practice_reason: string | null;
    message: string | null;
    scheduled_for: string | null;
    generation_count: number;
    history: PlanRevision[] | null;
    model: string | null;
    progress_done_at: string | null;
    practice_done_at: string | null;
    saved_at: string | null;
    created_at: string;
    updated_at: string;
}

export type PlanItemRole = "progress" | "practice";

/** ok: startable now; done: completed since the plan was saved; missing: deleted;
 *  blocked: an incomplete subtask was added; completed: finished (not by following this plan). */
export type PlanItemState = "ok" | "done" | "missing" | "blocked" | "completed";

export interface PlanItemView {
    role: PlanItemRole;
    nodeId: string | null;
    name: string;
    reason: string;
    state: PlanItemState;
    isLoop: boolean;
    repetitionsCompleted: number;
    repetitionsRequired: number;
    estimateMinutes: number;
}

/** A plan as the UI shows it (draft or saved). */
export interface NextActionView {
    id: string;
    status: PlanStatus;
    origin: PlanOrigin;
    intent: PlanIntent | null;
    kind: PlanKind;
    source: "ai" | "user";
    items: PlanItemView[];
    message: string;
    scheduledFor: string;
    /** scheduled before today and not done */
    overdue: boolean;
    /** every item is done */
    finished: boolean;
    /** an item was deleted, blocked or completed elsewhere */
    stale: boolean;
    remainingRevisions: number;
    model: string | null;
}
