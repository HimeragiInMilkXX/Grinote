/**
 * Which tree nodes the next action may point at, and a compact tree outline for the model.
 * Pure (unit-tested). The rule mirrors `startTask` (onair/serverActions.ts): an action node
 * that isn't completed and whose direct children are all completed.
 */

import { intervalToMinutes } from "@/lib/rewards/breakdown";

/** A `nodes` row as the next action code reads it (time_limit is the Postgres interval text). */
export interface PlanNodeRow {
    id: string;
    parent_node_id: string | null;
    task_name: string;
    description: string | null;
    isAction: boolean | null;
    isLoop: boolean | null;
    isCompleted: boolean | null;
    isRoot: boolean | null;
    repetitions_required: number | null;
    repetitions_completed: number | null;
    time_limit: string | null;
}

export const PLAN_NODE_SELECT =
    "id, parent_node_id, task_name, description, isAction, isLoop, isCompleted, isRoot, repetitions_required, repetitions_completed, time_limit";

export interface PlanCandidate {
    id: string;
    /** short key the model answers with ("c1", "c2", ...) */
    key: string;
    name: string;
    description: string;
    isLoop: boolean;
    repetitionsCompleted: number;
    repetitionsRequired: number;
    estimateMinutes: number;
    /** ancestor names from the root's child down to the parent */
    path: string[];
}

export type NodeState = "startable" | "completed" | "blocked" | "not_action" | "root";

function childrenMap( rows: readonly PlanNodeRow[] ) {

    const map = new Map<string, PlanNodeRow[]>();

    for( const row of rows ) {
        if( !row.parent_node_id ) continue;
        const list = map.get( row.parent_node_id ) ?? [];
        list.push( row );
        map.set( row.parent_node_id, list );
    }

    return map;

}

/** State of every node: startable / completed / blocked (an incomplete child) / not an action / root. */
export function nodeStates( rows: readonly PlanNodeRow[] ): Map<string, NodeState> {

    const children = childrenMap( rows );
    const states = new Map<string, NodeState>();

    for( const row of rows ) {
        if( row.isRoot ) states.set( row.id, "root" );
        else if( row.isCompleted ) states.set( row.id, "completed" );
        else if( !row.isAction ) states.set( row.id, "not_action" );
        else if( ( children.get( row.id ) ?? [] ).some( c => !c.isCompleted ) ) states.set( row.id, "blocked" );
        else states.set( row.id, "startable" );
    }

    return states;

}

export function pathOf( row: PlanNodeRow, byId: Map<string, PlanNodeRow> ): string[] {

    const path: string[] = [];
    const seen = new Set<string>( [ row.id ] );
    let parentId = row.parent_node_id;

    while( parentId && !seen.has( parentId ) ) {
        seen.add( parentId );
        const parent = byId.get( parentId );
        if( !parent || parent.isRoot ) break;
        path.unshift( parent.task_name );
        parentId = parent.parent_node_id;
    }

    return path;

}

/** Startable nodes in a stable order (tree order: depth-first from the root, then leftovers). */
export function buildCandidates( rows: readonly PlanNodeRow[] ): PlanCandidate[] {

    const states = nodeStates( rows );
    const byId = new Map( rows.map( r => [ r.id, r ] ) );

    return treeOrder( rows )
        .filter( r => states.get( r.id ) === "startable" )
        .map( ( r, i ) => ( {
            id: r.id,
            key: `c${i + 1}`,
            name: r.task_name,
            description: r.description ?? "",
            isLoop: !!r.isLoop,
            repetitionsCompleted: r.repetitions_completed ?? 0,
            repetitionsRequired: r.repetitions_required ?? 1,
            estimateMinutes: Math.round( intervalToMinutes( r.time_limit ) ),
            path: pathOf( r, byId ),
        } ) );

}

/** Depth-first order from the root(s); nodes that aren't reachable come last. */
export function treeOrder( rows: readonly PlanNodeRow[] ): PlanNodeRow[] {

    const children = childrenMap( rows );
    const out: PlanNodeRow[] = [];
    const seen = new Set<string>();

    const visit = ( row: PlanNodeRow ) => {
        if( seen.has( row.id ) ) return;
        seen.add( row.id );
        out.push( row );
        for( const c of children.get( row.id ) ?? [] ) visit( c );
    };

    for( const r of rows.filter( r => !r.parent_node_id || r.isRoot ) ) visit( r );
    for( const r of rows ) visit( r );

    return out;

}

/**
 * Indented outline of the whole tree for the model. Startable nodes carry their candidate key,
 * so the model can see where each candidate sits.
 */
export function outlineTree( rows: readonly PlanNodeRow[], candidates: readonly PlanCandidate[], clean: ( s: string ) => string = s => s ): string {

    const states = nodeStates( rows );
    const keyOf = new Map( candidates.map( c => [ c.id, c.key ] ) );
    const children = childrenMap( rows );
    const lines: string[] = [];
    const seen = new Set<string>();

    const mark = ( row: PlanNodeRow ) => {
        const state = states.get( row.id );
        const tags: string[] = [];
        if( state === "root" ) tags.push( "final goal" );
        if( state === "completed" ) tags.push( "done" );
        if( state === "blocked" ) tags.push( "waiting for its subtasks" );
        if( state === "not_action" ) tags.push( "group" );
        if( state === "startable" ) tags.push( `startable ${keyOf.get( row.id )}` );
        if( row.isLoop ) tags.push( `repeat ${row.repetitions_completed ?? 0}/${row.repetitions_required ?? 1}` );
        return `[${tags.join( ", " )}]`;
    };

    const visit = ( row: PlanNodeRow, depth: number ) => {
        if( seen.has( row.id ) ) return;
        seen.add( row.id );
        lines.push( `${"  ".repeat( depth )}- ${clean( row.task_name )} ${mark( row )}` );
        for( const c of children.get( row.id ) ?? [] ) visit( c, depth + 1 );
    };

    for( const r of rows.filter( r => r.isRoot ) ) visit( r, 0 );
    for( const r of rows ) visit( r, 0 );

    return lines.join( "\n" );

}
