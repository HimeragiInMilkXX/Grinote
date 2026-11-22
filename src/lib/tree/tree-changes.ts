/**
 * Pure goal-tree change engine shared by the AI tool (server), the review card
 * (chat) and the tree editor (client). It has no React, Next or Supabase
 * dependency so it can be unit-tested directly.
 *
 * Invariants it enforces on the resulting tree:
 * - exactly one isRoot node, which is never edited, deleted, or given a parent;
 * - every other node descends from the root (no orphans, no cycles), one parent each;
 * - isCompleted nodes are never edited, deleted or moved, and no edge change touches them;
 * - repeating tasks with progress (isLoop && repetitions_completed > 0) are only
 *   changed when explicitly allowed (the user decides on the review card).
 */

import type { Edge } from "@xyflow/react";
import type { PreviewChange, Task, TaskNodeType } from "@/types/flow";
import { newNodeId, uniqueById } from "./ids";

export const MAX_OPS = 12;

export const EDITABLE_FIELDS = [
    "task_name",
    "description",
    "bg_color",
    "text_color",
    "isAction",
    "time_limit",
    "isLoop",
    "repetitions_required",
] as const;

export type EditableField = typeof EDITABLE_FIELDS[number];
export type EditableTaskFields = Pick<Task, EditableField>;

/** Fields the app controls; the assistant must never set them. */
const SYSTEM_FIELDS = [ "isRoot", "isCompleted", "repetitions_completed" ] as const;

export type AddOp = {
    /** Temporary key for the new node (becomes a UUID after normalizeOps). */
    key: string;
    /** Existing node id, a new node key from this proposal, or (fallback) an exact existing task name. */
    parentKey: string;
    position?: { x: number, y: number };
    task_name: string;
    isAction: boolean;
} & Partial<Omit<EditableTaskFields, "task_name" | "isAction">>;

export type UpdateOp = { id: string; changes: Partial<EditableTaskFields> & Record<string, unknown>; reason?: string };
export type MoveOp = { id: string; newParent: string; reason?: string };
export type DeleteOp = { id: string; reason?: string };

export type TreeChangeOps = {
    add: AddOp[];
    update: UpdateOp[];
    move: MoveOp[];
    delete: DeleteOp[];
};

export type Graph = { nodes: TaskNodeType[], edges: Edge[] };

export type LockReason = "root" | "completed" | "loop_in_progress";

export type ProtectedNode = {
    id: string;
    task_name: string;
    repetitions_completed: number;
    repetitions_required: number;
    /** What the proposal does to it, e.g. "update", "move", "delete", "add child". */
    actions: string[];
};

export type TreeDiff = {
    added: { id: string, task_name: string, parentId: string | null }[];
    updated: { id: string, task_name: string, before: Partial<EditableTaskFields>, after: Partial<EditableTaskFields>, reason?: string }[];
    moved: { id: string, task_name: string, fromParentId: string | null, toParentId: string | null, auto: boolean, reason?: string }[];
    deleted: { id: string, task_name: string, reparentedChildren: string[], reason?: string }[];
    removedEdges: { source: string, target: string }[];
    addedEdges: { source: string, target: string }[];
    /** id -> task name, for every node in the original and resulting graph (including deleted ones). */
    names: Record<string, string>;
};

export type ApplyResult = {
    graph: Graph;
    diff: TreeDiff;
    errors: string[];
    warnings: string[];
    protectedNodes: ProtectedNode[];
};

export type ApplyOptions = {
    /** Progressed loops the user allowed to change. "all" defers the decision (used when drafting). */
    allowedProtectedIds?: "all" | string[];
};

export const emptyOps = (): TreeChangeOps => ({ add: [], update: [], move: [], delete: [] });

export const countOps = ( ops: TreeChangeOps ) =>
    ops.add.length + ops.update.length + ops.move.length + ops.delete.length;

export const lockReason = ( task: Task | undefined ): LockReason | null => {
    if( !task ) return null;
    if( task.isRoot ) return "root";
    if( task.isCompleted ) return "completed";
    if( task.isLoop && ( task.repetitions_completed ?? 0 ) > 0 ) return "loop_in_progress";
    return null;
};

export const TASK_DEFAULTS: Omit<Task, "task_name" | "isAction"> = {
    bg_color: "#FFFFFF",
    text_color: "#000000",
    description: "",
    time_limit: { hours: 0, minutes: 2, seconds: 0 },
    isLoop: false,
    repetitions_required: 2,
    isCompleted: false,
    repetitions_completed: 0,
    isRoot: false,
};

export const makeTreeEdge = ( source: string, target: string ): Edge => ({
    id: `${source}-${target}`,
    source,
    target,
    sourceHandle: "source",
    targetHandle: "target",
    deletable: true,
    type: "smoothstep",
    animated: true,
});

const norm = ( s: string ) => s.trim().toLowerCase();

/**
 * Resolve references and turn temporary keys into UUIDs.
 * References may be an exact node id, a new node key, or, as a fallback for small
 * models, a unique exact task name of an existing node (reported as a warning).
 */
export function normalizeOps( graph: Graph, input: Partial<TreeChangeOps> ): { ops: TreeChangeOps, warnings: string[] } {

    const warnings: string[] = [];
    const ops: TreeChangeOps = {
        add: input.add ?? [],
        update: input.update ?? [],
        move: input.move ?? [],
        delete: input.delete ?? [],
    };

    const existingIds = new Set( graph.nodes.map( n => n.id ) );

    // Every new node gets a freshly generated id, even if the model sent a UUID-looking key
    // (it may be an id from another project or an earlier draft). Existing ids are kept as-is
    // so the collision is reported by applyTreeChanges.
    const keyToId: Record<string, string> = {};
    const taken = new Set( existingIds );
    ops.add.forEach( a => {
        if( keyToId[a.key] || existingIds.has( a.key ) ) return;
        const id = newNodeId( taken );
        taken.add( id );
        keyToId[a.key] = id;
    });

    const byName = new Map<string, string[]>();
    graph.nodes.forEach( n => {
        const key = norm( n.data.task.task_name ?? "" );
        byName.set( key, [ ...( byName.get( key ) ?? [] ), n.id ] );
    });

    const resolveExisting = ( ref: string ): string => {
        if( existingIds.has( ref ) ) return ref;
        const matches = byName.get( norm( ref ) );
        if( matches?.length === 1 ) {
            warnings.push( `Resolved "${ref}" by task name; use exact node ids from get_graph_info.` );
            return matches[0];
        }
        return ref;
    };

    const resolveParent = ( ref: string ): string => keyToId[ref] ?? resolveExisting( ref );

    return {
        warnings,
        ops: {
            add: ops.add.map( a => ({ ...a, key: keyToId[a.key] ?? a.key, parentKey: resolveParent( a.parentKey ) }) ),
            update: ops.update.map( u => ({ ...u, id: resolveExisting( u.id ) }) ),
            move: ops.move.map( m => ({ ...m, id: resolveExisting( m.id ), newParent: resolveParent( m.newParent ) }) ),
            delete: ops.delete.map( d => ({ ...d, id: resolveExisting( d.id ) }) ),
        },
    };
}

/**
 * Give a fresh id to every new node whose key is already taken (e.g. a draft built against the
 * saved tree, applied to a newer canvas), and rewrite the references to it.
 */
export function rekeyAddOps( ops: TreeChangeOps, takenIds: Set<string> ): TreeChangeOps {
    const used = new Set( [ ...takenIds, ...ops.add.map( a => a.key ) ] );
    const map: Record<string, string> = {};
    ops.add.forEach( a => {
        if( !takenIds.has( a.key ) || map[a.key] ) return;
        const id = newNodeId( used );
        used.add( id );
        map[a.key] = id;
    });
    if( Object.keys( map ).length === 0 ) return ops;
    // Inside the proposal a key always means the new node it defines (normalizeOps generated it
    // against the saved tree), so every reference to it follows the new id.
    return {
        ...ops,
        add: ops.add.map( a => ({ ...a, key: map[a.key] ?? a.key, parentKey: map[a.parentKey] ?? a.parentKey }) ),
        move: ops.move.map( m => ({ ...m, newParent: map[m.newParent] ?? m.newParent }) ),
    };
}

/** Drop every operation that targets (or attaches to) the given node ids. */
export function withoutOpsFor( ops: TreeChangeOps, ids: string[] ): TreeChangeOps {
    if( ids.length === 0 ) return ops;
    const drop = new Set( ids );
    return {
        add: ops.add.filter( a => !drop.has( a.parentKey ) ),
        update: ops.update.filter( u => !drop.has( u.id ) ),
        move: ops.move.filter( m => !drop.has( m.id ) && !drop.has( m.newParent ) ),
        delete: ops.delete.filter( d => !drop.has( d.id ) ),
    };
}

const sameValue = ( a: unknown, b: unknown ) => JSON.stringify( a ) === JSON.stringify( b );

function validateFields( label: string, fields: Partial<EditableTaskFields> ): string[] {

    const errors: string[] = [];
    const isInt = ( n: unknown ) => typeof n === "number" && Number.isInteger( n );

    if( "task_name" in fields ) {
        const name = fields.task_name;
        if( typeof name !== "string" || !name.trim() || name.length > 100 )
            errors.push( `${label}: task_name must be 1-100 characters.` );
    }
    for( const key of [ "bg_color", "text_color" ] as const ) {
        if( key in fields ) {
            const color = fields[key];
            if( typeof color !== "string" || !( color.includes( "#" ) || color.includes( "rgb" ) ) )
                errors.push( `${label}: ${key} must be a CSS hex color such as #FFFFFF.` );
        }
    }
    if( "description" in fields && typeof fields.description !== "string" )
        errors.push( `${label}: description must be a string.` );
    for( const key of [ "isAction", "isLoop" ] as const ) {
        if( key in fields && typeof fields[key] !== "boolean" )
            errors.push( `${label}: ${key} must be true or false.` );
    }
    if( "time_limit" in fields ) {
        const t = fields.time_limit;
        if( !t || typeof t !== "object" ||
            !isInt( t.hours ) || t.hours < 0 || t.hours > 10 ||
            !isInt( t.minutes ) || t.minutes < 0 || t.minutes > 59 ||
            !isInt( t.seconds ) || t.seconds < 0 || t.seconds > 59 )
            errors.push( `${label}: time_limit must be {hours:0-10, minutes:0-59, seconds:0-59} with integers, e.g. 90 minutes = {hours:1,minutes:30,seconds:0}.` );
    }
    if( "repetitions_required" in fields ) {
        const r = fields.repetitions_required;
        if( !isInt( r ) || ( r as number ) < 1 )
            errors.push( `${label}: repetitions_required must be a positive integer.` );
    }

    return errors;
}

/**
 * Apply a change proposal to a graph and validate the result.
 * The input graph is never mutated.
 */
export function applyTreeChanges( graph: Graph, rawOps: Partial<TreeChangeOps>, options: ApplyOptions = {} ): ApplyResult {

    const ops: TreeChangeOps = { ...emptyOps(), ...rawOps };
    const allowed = options.allowedProtectedIds ?? [];
    const errors: string[] = [];
    const warnings: string[] = [];

    const original = new Map( graph.nodes.map( n => [ n.id, n ] ) );
    const names: Record<string, string> = Object.fromEntries( graph.nodes.map( n => [ n.id, n.data.task.task_name ] ) );
    const label = ( id: string ) => `"${names[id] ?? id}"`;

    // Parent map from edges (target -> source)
    const originalParent = new Map<string, string>();
    graph.edges.forEach( e => originalParent.set( e.target, e.source ) );
    const parent = new Map( originalParent );

    const roots = graph.nodes.filter( n => n.data.task.isRoot );
    if( roots.length !== 1 ) errors.push( `The tree must have exactly one root node, found ${roots.length}.` );
    const rootId = roots[0]?.id;

    if( countOps( ops ) === 0 ) errors.push( "The proposal contains no changes." );
    if( countOps( ops ) > MAX_OPS ) errors.push( `Too many changes (${countOps( ops )}). Use at most ${MAX_OPS} operations per proposal and describe the rest for a later proposal.` );

    // Track which nodes are touched, and how, to report protected loops.
    const touched = new Map<string, Set<string>>();
    const touch = ( id: string, action: string ) => {
        if( !touched.has( id ) ) touched.set( id, new Set() );
        touched.get( id )!.add( action );
    };

    const deleteIds = new Set( ops.delete.map( d => d.id ) );
    const moveIds = new Set<string>();
    const addIds = new Set<string>();

    // Anything an edge points to or from must not be completed
    const assertEdgeEndpoint = ( id: string, context: string ) => {
        const node = original.get( id );
        if( node?.data.task.isCompleted ) {
            errors.push( `${context}: ${label( id )} is completed; completed tasks cannot gain, lose or change connections.` );
            return false;
        }
        return true;
    };

    // ---------- ADD ----------
    const addedNodes: TaskNodeType[] = [];
    ops.add.forEach( ( a, index ) => {

        const id = a.key;
        const ctx = `add[${index}] "${a.task_name}"`;

        if( original.has( id ) ) { errors.push( `${ctx}: key "${id}" is an existing node id; new nodes need a new unique key. To change an existing node use update or move.` ); return; }
        if( addIds.has( id ) ) { errors.push( `${ctx}: duplicate key "${a.key}".` ); return; }
        addIds.add( id );
        names[id] = a.task_name;

        const { key: _key, parentKey: _parentKey, position, ...fields } = a;
        const task: Task = { ...TASK_DEFAULTS, ...fields, isCompleted: false, repetitions_completed: 0, isRoot: false };
        if( task.isLoop && task.repetitions_required < 2 ) errors.push( `${ctx}: a repeating task needs repetitions_required of at least 2.` );
        errors.push( ...validateFields( ctx, task ) );

        addedNodes.push({
            id,
            position: position ?? { x: 0, y: 0 },
            connectable: true,
            selectable: true,
            draggable: true,
            data: { label: task.task_name, task },
            type: "taskNode",
        });

        parent.set( id, a.parentKey );

    });

    // Validate add parents once all new keys are known
    ops.add.forEach( ( a, index ) => {
        const ctx = `add[${index}] "${a.task_name}"`;
        const p = a.parentKey;
        if( !p ) { errors.push( `${ctx}: parentKey is required.` ); return; }
        if( p === a.key ) { errors.push( `${ctx}: a node cannot be its own parent.` ); return; }
        if( !original.has( p ) && !addIds.has( p ) ) {
            errors.push( `${ctx}: parent "${p}" not found. Use an exact node id from get_graph_info or a key from add.` );
            return;
        }
        if( deleteIds.has( p ) ) errors.push( `${ctx}: parent ${label( p )} is being deleted in this proposal.` );
        if( !assertEdgeEndpoint( p, ctx ) ) return;
        if( original.has( p ) ) {
            if( lockReason( original.get( p )!.data.task ) === "loop_in_progress" ) touch( p, "add child" );
            if( original.get( p )!.data.task.isAction && !original.get( p )!.data.task.isRoot )
                warnings.push( `${label( p )} is an action: its new child tasks must be completed before it can start.` );
        }
    });

    // ---------- UPDATE ----------
    const updates = new Map<string, Partial<EditableTaskFields>>();
    const updateReasons = new Map<string, string>();
    ops.update.forEach( ( u, index ) => {

        const ctx = `update[${index}] ${label( u.id )}`;
        const node = original.get( u.id );

        if( !node ) {
            errors.push( addIds.has( u.id )
                ? `${ctx}: new nodes are defined fully in add; do not update them.`
                : `${ctx}: node "${u.id}" not found. Use an exact node id from get_graph_info.` );
            return;
        }

        const lock = lockReason( node.data.task );
        if( lock === "root" ) { errors.push( `${ctx}: the root node can never be changed.` ); return; }
        if( lock === "completed" ) { errors.push( `${ctx}: completed tasks can never be changed.` ); return; }
        if( deleteIds.has( u.id ) ) { errors.push( `${ctx}: a node cannot be both updated and deleted.` ); return; }

        const changes: Partial<EditableTaskFields> = {};
        for( const [ key, value ] of Object.entries( u.changes ?? {} ) ) {
            if( value === undefined ) continue;
            if( ( SYSTEM_FIELDS as readonly string[] ).includes( key ) ) {
                errors.push( `${ctx}: ${key} is managed by the app and cannot be changed.` );
                continue;
            }
            if( !( EDITABLE_FIELDS as readonly string[] ).includes( key ) ) {
                warnings.push( `${ctx}: ignored unknown field "${key}".` );
                continue;
            }
            ( changes as Record<string, unknown> )[key] = value;
        }

        if( updates.has( u.id ) ) warnings.push( `${ctx}: merged a second update for the same node.` );
        updates.set( u.id, { ...( updates.get( u.id ) ?? {} ), ...changes } );
        if( u.reason ) updateReasons.set( u.id, u.reason );

    });

    const updatedDiff: TreeDiff["updated"] = [];
    const updatedTasks = new Map<string, Task>();
    updates.forEach( ( changes, id ) => {

        const node = original.get( id )!;
        const ctx = `update ${label( id )}`;
        const before: Partial<EditableTaskFields> = {};
        const after: Partial<EditableTaskFields> = {};

        ( Object.keys( changes ) as EditableField[] ).forEach( key => {
            if( sameValue( node.data.task[key], changes[key] ) ) return;
            ( before as Record<string, unknown> )[key] = node.data.task[key];
            ( after as Record<string, unknown> )[key] = changes[key];
        });

        if( Object.keys( after ).length === 0 ) { warnings.push( `${ctx}: no effective change, skipped.` ); return; }

        errors.push( ...validateFields( ctx, after ) );

        const task: Task = { ...node.data.task, ...after };
        if( task.repetitions_required < ( task.repetitions_completed ?? 0 ) )
            errors.push( `${ctx}: repetitions_required (${task.repetitions_required}) cannot be lower than repetitions already completed (${task.repetitions_completed}).` );
        if( task.isLoop && ( "isLoop" in after || "repetitions_required" in after ) && task.repetitions_required < 2 )
            errors.push( `${ctx}: a repeating task needs repetitions_required of at least 2.` );

        if( lockReason( node.data.task ) === "loop_in_progress" ) touch( id, "update" );

        updatedTasks.set( id, task );
        updatedDiff.push({ id, task_name: task.task_name, before, after, reason: updateReasons.get( id ) });
        names[id] = task.task_name;

    });

    // ---------- MOVE ----------
    const movedDiff: TreeDiff["moved"] = [];
    ops.move.forEach( ( m, index ) => {

        const ctx = `move[${index}] ${label( m.id )}`;
        const node = original.get( m.id );

        if( !node ) {
            errors.push( addIds.has( m.id )
                ? `${ctx}: to place a new node, set its parentKey in add instead of moving it.`
                : `${ctx}: node "${m.id}" not found. Use an exact node id from get_graph_info.` );
            return;
        }
        if( moveIds.has( m.id ) ) { errors.push( `${ctx}: the node is moved twice; keep one move.` ); return; }

        const lock = lockReason( node.data.task );
        if( lock === "root" ) { errors.push( `${ctx}: the root node cannot be moved or given a parent.` ); return; }
        if( lock === "completed" ) { errors.push( `${ctx}: completed tasks cannot be moved.` ); return; }
        if( deleteIds.has( m.id ) ) { errors.push( `${ctx}: a node cannot be both moved and deleted.` ); return; }

        const p = m.newParent;
        if( !p ) { errors.push( `${ctx}: newParent is required; every node must stay connected to the root.` ); return; }
        if( p === m.id ) { errors.push( `${ctx}: a node cannot be its own parent.` ); return; }
        if( !original.has( p ) && !addIds.has( p ) ) { errors.push( `${ctx}: new parent "${p}" not found. Use an exact node id from get_graph_info or a key from add.` ); return; }
        if( deleteIds.has( p ) ) { errors.push( `${ctx}: new parent ${label( p )} is being deleted in this proposal.` ); return; }
        if( !assertEdgeEndpoint( p, ctx ) ) return;

        const from = originalParent.get( m.id ) ?? null;
        if( from === p ) { warnings.push( `${ctx}: already under ${label( p )}, skipped.` ); return; }
        if( from && !assertEdgeEndpoint( from, ctx ) ) return;

        moveIds.add( m.id );
        parent.set( m.id, p );

        if( lock === "loop_in_progress" ) touch( m.id, "move" );
        if( original.has( p ) && lockReason( original.get( p )!.data.task ) === "loop_in_progress" ) touch( p, "add child" );
        if( from && lockReason( original.get( from )?.data.task ) === "loop_in_progress" ) touch( from, "remove child" );

        movedDiff.push({ id: m.id, task_name: names[m.id], fromParentId: from, toParentId: p, auto: false, reason: m.reason });

    });

    // ---------- DELETE ----------
    const deletedDiff: TreeDiff["deleted"] = [];
    const seenDelete = new Set<string>();
    ops.delete.forEach( ( d, index ) => {

        const ctx = `delete[${index}] ${label( d.id )}`;
        const node = original.get( d.id );

        if( seenDelete.has( d.id ) ) return;
        seenDelete.add( d.id );

        if( !node ) {
            errors.push( addIds.has( d.id )
                ? `${ctx}: do not add and delete the same node; just leave it out.`
                : `${ctx}: node "${d.id}" not found. Use an exact node id from get_graph_info.` );
            return;
        }

        const lock = lockReason( node.data.task );
        if( lock === "root" ) { errors.push( `${ctx}: the root node can never be deleted.` ); return; }
        if( lock === "completed" ) { errors.push( `${ctx}: completed tasks can never be deleted.` ); return; }
        if( lock === "loop_in_progress" ) touch( d.id, "delete" );

        const p = originalParent.get( d.id );
        if( p && !assertEdgeEndpoint( p, ctx ) ) return;
        if( p && lockReason( original.get( p )?.data.task ) === "loop_in_progress" ) touch( p, "remove child" );

        deletedDiff.push({ id: d.id, task_name: names[d.id], reparentedChildren: [], reason: d.reason });

    });

    // Children of deleted nodes move up to the nearest surviving ancestor unless moved or deleted explicitly
    const nearestSurvivingAncestor = ( id: string ): string | undefined => {
        const seen = new Set<string>();
        let current = parent.get( id );
        while( current && deleteIds.has( current ) && !seen.has( current ) ) {
            seen.add( current );
            current = parent.get( current );
        }
        return current && !deleteIds.has( current ) ? current : undefined;
    };

    deletedDiff.forEach( entry => {
        for( const [ child, p ] of Array.from( parent.entries() ) ) {

            if( p !== entry.id || deleteIds.has( child ) ) continue;

            const ancestor = nearestSurvivingAncestor( entry.id );
            const childNode = original.get( child );

            if( childNode?.data.task.isCompleted ) {
                errors.push( `delete ${label( entry.id )}: its child ${label( child )} is completed and cannot be moved, so ${label( entry.id )} cannot be deleted.` );
                continue;
            }
            if( !ancestor ) {
                errors.push( `delete ${label( entry.id )}: its child ${label( child )} would have no parent. Move or delete the child too.` );
                continue;
            }
            if( !assertEdgeEndpoint( ancestor, `delete ${label( entry.id )}` ) ) continue;

            parent.set( child, ancestor );
            entry.reparentedChildren.push( child );

            if( childNode && lockReason( childNode.data.task ) === "loop_in_progress" ) touch( child, "move" );
            if( lockReason( original.get( ancestor )?.data.task ) === "loop_in_progress" ) touch( ancestor, "add child" );

            if( !addIds.has( child ) )
                movedDiff.push({ id: child, task_name: names[child], fromParentId: entry.id, toParentId: ancestor, auto: true, reason: `${names[entry.id]} is deleted` });

        }
    });

    deleteIds.forEach( id => parent.delete( id ) );

    // ---------- STRUCTURE ----------
    const survivingIds = [
        ...graph.nodes.filter( n => !deleteIds.has( n.id ) ).map( n => n.id ),
        ...addedNodes.map( n => n.id ),
    ];

    const surviving = new Set( survivingIds );

    if( rootId ) parent.delete( rootId );

    // Cycle check for every touched node (moves / adds / reparenting)
    const changedParent = new Set<string>( [ ...addIds, ...moveIds, ...deletedDiff.flatMap( d => d.reparentedChildren ) ] );
    changedParent.forEach( id => {
        const seen = new Set<string>( [ id ] );
        let current = parent.get( id );
        while( current ) {
            if( seen.has( current ) ) {
                errors.push( `${label( id )} would end up inside its own branch (a cycle). Choose a parent outside its branch.` );
                break;
            }
            seen.add( current );
            current = parent.get( current );
        }
    });

    // Reachability from the root
    const children = new Map<string, string[]>();
    parent.forEach( ( p, c ) => { if( surviving.has( c ) ) children.set( p, [ ...( children.get( p ) ?? [] ), c ] ); });
    const reachable = new Set<string>();
    const stack = rootId ? [ rootId ] : [];
    while( stack.length ) {
        const id = stack.pop()!;
        if( reachable.has( id ) ) continue;
        reachable.add( id );
        stack.push( ...( children.get( id ) ?? [] ) );
    }

    survivingIds.forEach( id => {
        if( reachable.has( id ) || !rootId ) return;
        if( changedParent.has( id ) ) errors.push( `${label( id )} would not be connected to the root.` );
        else warnings.push( `${label( id )} is already disconnected from the root; consider moving it under a parent or deleting it.` );
    });

    // ---------- PROTECTED ----------
    const protectedNodes: ProtectedNode[] = [];
    touched.forEach( ( actions, id ) => {
        const task = original.get( id )?.data.task;
        if( !task || lockReason( task ) !== "loop_in_progress" ) return;
        protectedNodes.push({
            id,
            task_name: task.task_name,
            repetitions_completed: task.repetitions_completed,
            repetitions_required: task.repetitions_required,
            actions: Array.from( actions ),
        });
        if( allowed !== "all" && !allowed.includes( id ) )
            errors.push( `${label( id )} is a repeating task with progress (${task.repetitions_completed}/${task.repetitions_required}); changing it needs the user's permission.` );
    });

    // ---------- RESULT GRAPH ----------
    const nodes: TaskNodeType[] = [
        ...graph.nodes
            .filter( n => !deleteIds.has( n.id ) )
            .map( n => {
                const task = updatedTasks.get( n.id );
                return task ? { ...n, data: { ...n.data, label: task.task_name, task } } : n;
            }),
        ...addedNodes,
    ];

    // Rough initial positions for new nodes, to the right of their parent
    const positions = new Map( nodes.map( n => [ n.id, n.position ] ) );
    const childCount = new Map<string, number>();
    addedNodes.forEach( n => {
        const add = ops.add.find( a => a.key === n.id );
        if( add?.position ) return;
        const p = parent.get( n.id );
        const base = ( p && positions.get( p ) ) || { x: 0, y: 0 };
        const i = childCount.get( p ?? "" ) ?? 0;
        childCount.set( p ?? "", i + 1 );
        n.position = { x: base.x + 300, y: base.y + i * 120 };
        positions.set( n.id, n.position );
    });

    const existingEdge = new Map( graph.edges.map( e => [ `${e.source}->${e.target}`, e ] ) );
    const edges: Edge[] = [];
    parent.forEach( ( p, c ) => {
        if( !surviving.has( c ) || !surviving.has( p ) ) return;
        edges.push( existingEdge.get( `${p}->${c}` ) ?? makeTreeEdge( p, c ) );
    });

    const removedEdges: TreeDiff["removedEdges"] = [];
    originalParent.forEach( ( p, c ) => { if( parent.get( c ) !== p ) removedEdges.push({ source: p, target: c }); });
    const addedEdges: TreeDiff["addedEdges"] = [];
    parent.forEach( ( p, c ) => { if( originalParent.get( c ) !== p && surviving.has( c ) ) addedEdges.push({ source: p, target: c }); });

    return {
        graph: { nodes, edges },
        diff: {
            added: addedNodes.map( n => ({ id: n.id, task_name: n.data.task.task_name, parentId: parent.get( n.id ) ?? null }) ),
            updated: updatedDiff,
            moved: movedDiff,
            deleted: deletedDiff,
            removedEdges,
            addedEdges,
            names,
        },
        errors: Array.from( new Set( errors ) ),
        warnings: Array.from( new Set( warnings ) ),
        protectedNodes,
    };

}

/**
 * Build a read-only preview: the resulting graph plus "ghost" deleted nodes and removed
 * edges, with per-node change info in `data.previewChange`.
 */
export function buildPreviewGraph( original: Graph, result: ApplyResult ): Graph {

    const { diff } = result;
    const change = new Map<string, PreviewChange>();
    const get = ( id: string ) => {
        if( !change.has( id ) ) change.set( id, { kinds: [] } );
        return change.get( id )!;
    };
    const parentName = ( id: string | null ) => id ? diff.names[id] ?? id : null;

    diff.added.forEach( a => { get( a.id ).kinds.push( "added" ); });
    diff.updated.forEach( u => {
        const c = get( u.id );
        c.kinds.push( "updated" );
        c.before = u.before;
        c.after = u.after;
        if( u.reason ) c.reasons = [ ...( c.reasons ?? [] ), u.reason ];
    });
    diff.moved.forEach( m => {
        const c = get( m.id );
        c.kinds.push( "moved" );
        c.fromParent = parentName( m.fromParentId );
        c.toParent = parentName( m.toParentId );
        if( m.reason ) c.reasons = [ ...( c.reasons ?? [] ), m.reason ];
    });
    diff.deleted.forEach( d => {
        const c = get( d.id );
        c.kinds.push( "deleted" );
        if( d.reason ) c.reasons = [ ...( c.reasons ?? [] ), d.reason ];
    });

    const withChange = ( n: TaskNodeType ): TaskNodeType =>
        change.has( n.id ) ? { ...n, data: { ...n.data, previewChange: change.get( n.id ) } } : n;

    const resultIds = new Set( result.graph.nodes.map( n => n.id ) );
    const ghosts = original.nodes.filter( n => !resultIds.has( n.id ) && diff.deleted.some( d => d.id === n.id ) );

    const added = new Set( diff.addedEdges.map( e => `${e.source}->${e.target}` ) );

    const edges: Edge[] = [
        ...result.graph.edges.map( e => added.has( `${e.source}->${e.target}` )
            ? { ...e, style: { stroke: "#16a34a", strokeWidth: 2 } }
            : e ),
        ...diff.removedEdges.map( e => ({
            ...makeTreeEdge( e.source, e.target ),
            id: `removed-${e.source}-${e.target}`,
            animated: false,
            style: { stroke: "#dc2626", strokeDasharray: "6 4", strokeWidth: 2 },
        }) ),
    ];

    // React Flow needs unique node and edge ids; never hand it duplicates
    const nodes = [ ...result.graph.nodes.map( withChange ), ...ghosts.map( withChange ) ];
    const uniqueNodes = uniqueById( nodes );
    const uniqueEdges = uniqueById( edges );
    if( ( uniqueNodes.length !== nodes.length || uniqueEdges.length !== edges.length ) && process.env.NODE_ENV !== "production" )
        console.warn( "buildPreviewGraph: dropped duplicate node/edge ids", { nodes: nodes.length - uniqueNodes.length, edges: edges.length - uniqueEdges.length } );

    return { nodes: uniqueNodes, edges: uniqueEdges };

}
