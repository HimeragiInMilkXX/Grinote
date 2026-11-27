/**
 * Reads a stored plan against the current tree (pure, unit-tested): which items can still be
 * started, which are done, and whether the plan went stale (tree edits).
 */

import { intervalToMinutes } from "@/lib/rewards/breakdown";
import { NEXT_ACTION_MAX_GENERATIONS } from "./config";
import { nodeStates, type PlanNodeRow } from "./candidates";
import type { NextActionRow, NextActionView, PlanItemRole, PlanItemView } from "./types";

function itemView( role: PlanItemRole, nodeId: string | null, reason: string | null, doneAt: string | null, rows: readonly PlanNodeRow[], states: ReturnType<typeof nodeStates>, snapshotName: string | null ): PlanItemView {

    const node = nodeId ? rows.find( r => r.id === nodeId ) : undefined;
    const state = node ? states.get( node.id ) : undefined;

    let itemState: PlanItemView["state"];
    if( !node ) itemState = doneAt ? "done" : "missing";
    else if( doneAt ) itemState = "done";
    else if( state === "startable" ) itemState = "ok";
    else if( state === "completed" ) itemState = "completed";
    else itemState = "blocked";

    return {
        role,
        nodeId: node?.id ?? null,
        name: node?.task_name ?? snapshotName ?? "（削除されたタスク）",
        reason: reason ?? "",
        state: itemState,
        isLoop: !!node?.isLoop,
        repetitionsCompleted: node?.repetitions_completed ?? 0,
        repetitionsRequired: node?.repetitions_required ?? 1,
        estimateMinutes: Math.round( intervalToMinutes( node?.time_limit ?? null ) ),
    };

}

export function resolvePlan( row: NextActionRow, rows: readonly PlanNodeRow[], todayKey: string ): NextActionView | null {

    if( !row.kind || !row.scheduled_for ) return null;

    const states = nodeStates( rows );
    const items: PlanItemView[] = [];

    // practice first: the usual order is "warm up with the practice, then the progress task"
    if( row.kind === "practice_progress" ) {
        items.push( itemView( "practice", row.practice_node_id, row.practice_reason, row.practice_done_at, rows, states, row.practice_task_name ) );
    }
    items.push( itemView( "progress", row.progress_node_id, row.progress_reason, row.progress_done_at, rows, states, row.progress_task_name ) );

    const finished = items.every( i => i.state === "done" );
    const stale = items.some( i => i.state === "missing" || i.state === "blocked" || i.state === "completed" );

    return {
        id: row.id,
        status: row.status,
        origin: row.origin,
        intent: row.intent,
        kind: row.kind,
        source: row.source,
        items,
        message: row.message ?? "",
        scheduledFor: row.scheduled_for,
        overdue: !finished && row.scheduled_for < todayKey,
        finished,
        stale,
        remainingRevisions: Math.max( 0, NEXT_ACTION_MAX_GENERATIONS - row.generation_count ),
        model: row.model,
    };

}

/**
 * Should saving the tree ask for a new plan? Only when there are startable tasks and the saved
 * plan is missing, finished, or went stale.
 */
export function shouldAskForPlan( saved: NextActionView | null, candidateCount: number ): boolean {

    if( candidateCount === 0 ) return false;
    if( !saved ) return true;

    return saved.finished || saved.stale;

}

/** Which nodes the tree highlights (only items that can still be started). */
export function planHighlights( view: NextActionView | null ): Record<string, PlanItemRole> {

    const out: Record<string, PlanItemRole> = {};

    for( const item of view?.items ?? [] ) {
        if( item.nodeId && item.state === "ok" ) out[ item.nodeId ] = item.role;
    }

    return out;

}

/** Which item a completed node advances (null when it isn't part of the plan). */
export function matchCompletedNode( row: Pick<NextActionRow, "progress_node_id" | "practice_node_id" | "progress_done_at" | "practice_done_at">, nodeId: string ): PlanItemRole | null {

    if( row.progress_node_id === nodeId && !row.progress_done_at ) return "progress";
    if( row.practice_node_id === nodeId && !row.practice_done_at ) return "practice";

    return null;

}
