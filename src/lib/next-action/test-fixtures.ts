/** Shared test fixture (not a test file). */

import type { PlanNodeRow } from "./candidates";

export const node = ( id: string, parent: string | null, extra: Partial<PlanNodeRow> = {} ): PlanNodeRow => ( {
    id,
    parent_node_id: parent,
    task_name: id,
    description: null,
    isAction: true,
    isLoop: false,
    isCompleted: false,
    isRoot: false,
    repetitions_required: 1,
    repetitions_completed: 0,
    time_limit: "00:30:00",
    ...extra,
} );

// root ─ a (group) ─ a1 (done), a2
//      ─ b (action, child b1 open) ─ b1
//      ─ p (loop 1/3)
export const fixture: PlanNodeRow[] = [
    node( "root", null, { isRoot: true, isAction: false, task_name: "Goal" } ),
    node( "a", "root", { isAction: false } ),
    node( "a1", "a", { isCompleted: true } ),
    node( "a2", "a" ),
    node( "b", "root" ),
    node( "b1", "b", { time_limit: "01:15:00" } ),
    node( "p", "root", { isLoop: true, repetitions_required: 3, repetitions_completed: 1 } ),
];
