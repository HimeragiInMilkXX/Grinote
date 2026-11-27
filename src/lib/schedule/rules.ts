/**
 * Which tree nodes can be scheduled and how often (pure, unit-tested).
 *
 * - Any open action can be scheduled, also one still waiting for its subtasks ("blocked").
 * - One-time action: at most one open entry.
 * - Loop: repetitions_completed + open entries <= repetitions_required.
 * Done entries are history and don't count (the node's repetitions_completed already does).
 * The DB trigger `schedule_items_guard` enforces the same limit.
 */

import { nodeStates, pathOf, treeOrder, type PlanNodeRow } from "@/lib/next-action/candidates";
import { intervalToMinutes } from "@/lib/rewards/breakdown";
import type { ScheduleEntry, ScheduleEntryState, ScheduleItemRow, ScheduleNode, ScheduleNodeState } from "./types";

/** Every node in tree order with its schedule state. */
export function buildScheduleNodes( rows: readonly PlanNodeRow[] ): ScheduleNode[] {

    const states = nodeStates( rows );
    const byId = new Map( rows.map( r => [ r.id, r ] ) );

    return treeOrder( rows ).map( ( r, order ) => {

        const s = states.get( r.id );
        const state: ScheduleNodeState = s === "startable" ? "schedulable" : s ?? "not_action";

        return {
            id: r.id,
            name: r.task_name,
            path: pathOf( r, byId ),
            isLoop: !!r.isLoop,
            repetitionsCompleted: r.repetitions_completed ?? 0,
            repetitionsRequired: Math.max( 1, r.repetitions_required ?? 1 ),
            estimateMinutes: Math.round( intervalToMinutes( r.time_limit ) ),
            state,
            order,
        };

    } );

}

export const isSchedulableState = ( state: ScheduleNodeState ) => state === "schedulable" || state === "blocked";

/** Open (not done) entries per node. */
export function openCountByNode( items: readonly Pick<ScheduleItemRow, "node_id" | "done_at">[] ): Map<string, number> {

    const map = new Map<string, number>();

    for( const item of items ) {
        if( item.done_at ) continue;
        map.set( item.node_id, ( map.get( item.node_id ) ?? 0 ) + 1 );
    }

    return map;

}

/** How many more entries the node may get. */
export function capacityOf( node: ScheduleNode, openCount: number ): number {

    if( !isSchedulableState( node.state ) ) return 0;

    if( node.isLoop ) return Math.max( 0, node.repetitionsRequired - node.repetitionsCompleted - openCount );

    return openCount > 0 ? 0 : 1;

}

/** Why a node can't get another entry (Japanese, for the picker and errors), or null when it can. */
export function capacityReason( node: ScheduleNode, openCount: number ): string | null {

    if( node.state === "root" ) return "最終目標はスケジュールできません";
    if( node.state === "not_action" ) return "レーベルはスケジュールできません";
    if( node.state === "completed" ) return "完了済みのタスクです";
    if( capacityOf( node, openCount ) > 0 ) return null;

    if( node.isLoop ) return `残りの回数（${node.repetitionsRequired - node.repetitionsCompleted}回）はすべて予定済みです`;

    return "1回きりのタスクはすでに予定済みです";

}

function entryState( item: ScheduleItemRow, node: ScheduleNode | undefined, todayKey: string ): ScheduleEntryState {

    if( item.done_at ) return "done";
    if( !node || !isSchedulableState( node.state ) ) return "stale";
    if( item.scheduled_for < todayKey ) return "carried";

    return "open";

}

/** Entries joined with their nodes, sorted by day, then tree order, then creation. */
export function buildEntries( items: readonly ScheduleItemRow[], nodes: readonly ScheduleNode[], todayKey: string ): ScheduleEntry[] {

    const byId = new Map( nodes.map( n => [ n.id, n ] ) );

    return items
        .map( ( item ): ScheduleEntry => {
            const node = byId.get( item.node_id );
            return {
                id: item.id,
                nodeId: item.node_id,
                name: node?.name ?? "（削除されたタスク）",
                path: node?.path ?? [],
                dayKey: item.scheduled_for.slice( 0, 10 ),
                state: entryState( item, node, todayKey ),
                doneAt: item.done_at,
                estimateMinutes: node?.estimateMinutes ?? 0,
                isLoop: node?.isLoop ?? false,
                startable: node?.state === "schedulable",
                order: node?.order ?? Number.MAX_SAFE_INTEGER,
                createdAt: item.created_at,
            };
        } )
        .sort( compareEntries );

}

export function compareEntries( a: ScheduleEntry, b: ScheduleEntry ): number {

    if( a.dayKey !== b.dayKey ) return a.dayKey < b.dayKey ? -1 : 1;
    if( a.order !== b.order ) return a.order - b.order;

    return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0;

}

/** Entries that still need work (open or carried over). */
export const isPending = ( e: Pick<ScheduleEntry, "state"> ) => e.state === "open" || e.state === "carried";
