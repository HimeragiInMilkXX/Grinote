import { describe, expect, it } from "vitest";
import type { Edge } from "@xyflow/react";
import type { Task, TaskNodeType } from "@/types/flow";
import {
    applyTreeChanges,
    buildPreviewGraph,
    countOps,
    emptyOps,
    lockReason,
    MAX_OPS,
    normalizeOps,
    rekeyAddOps,
    withoutOpsFor,
    type AddOp,
    type Graph,
    type TreeChangeOps,
} from "./tree-changes";

// ---------- fixture ----------
//
// root (isRoot)
// ├─ A  label
// │  ├─ A1 action
// │  └─ A2 action (completed)
// ├─ B  label
// │  ├─ L  loop with progress 2/5
// │  └─ B1 action
// └─ C  action
//    └─ C1 action

const task = ( name: string, extra: Partial<Task> = {} ): Task => ({
    task_name: name,
    bg_color: "#FFFFFF",
    text_color: "#000000",
    description: "",
    isAction: true,
    time_limit: { hours: 0, minutes: 30, seconds: 0 },
    isLoop: false,
    repetitions_required: 2,
    isCompleted: false,
    repetitions_completed: 0,
    isRoot: false,
    ...extra,
});

const node = ( id: string, t: Task ): TaskNodeType => ({
    id,
    position: { x: 0, y: 0 },
    data: { label: t.task_name, task: t },
    type: "taskNode",
});

const edge = ( source: string, target: string ): Edge => ({ id: `${source}-${target}`, source, target });

const fixture = (): Graph => ({
    nodes: [
        node( "root", task( "Goal", { isRoot: true, isAction: false } ) ),
        node( "A", task( "Learn basics", { isAction: false } ) ),
        node( "A1", task( "Read docs" ) ),
        node( "A2", task( "Install tools", { isCompleted: true } ) ),
        node( "B", task( "Practice", { isAction: false } ) ),
        node( "L", task( "Daily drill", { isLoop: true, repetitions_required: 5, repetitions_completed: 2 } ) ),
        node( "B1", task( "Mini project" ) ),
        node( "C", task( "Final project" ) ),
        node( "C1", task( "Plan project" ) ),
    ],
    edges: [
        edge( "root", "A" ), edge( "A", "A1" ), edge( "A", "A2" ),
        edge( "root", "B" ), edge( "B", "L" ), edge( "B", "B1" ),
        edge( "root", "C" ), edge( "C", "C1" ),
    ],
});

const ops = ( partial: Partial<TreeChangeOps> ): TreeChangeOps => ({ ...emptyOps(), ...partial });

const addOp = ( key: string, parentKey: string, extra: Partial<AddOp> = {} ): AddOp => ({
    key,
    parentKey,
    task_name: `New ${key}`,
    isAction: true,
    time_limit: { hours: 0, minutes: 20, seconds: 0 },
    ...extra,
});

const parentOf = ( graph: Graph, id: string ) => graph.edges.find( e => e.target === id )?.source;

const expectError = ( errors: string[], fragment: string ) =>
    expect( errors.some( e => e.toLowerCase().includes( fragment.toLowerCase() ) ), `expected an error containing "${fragment}", got:\n${errors.join( "\n" )}` ).toBe( true );

// ---------- tests ----------

describe( "lockReason", () => {
    it( "classifies root, completed and progressed loops", () => {
        const g = fixture();
        const by = ( id: string ) => g.nodes.find( n => n.id === id )!.data.task;
        expect( lockReason( by( "root" ) ) ).toBe( "root" );
        expect( lockReason( by( "A2" ) ) ).toBe( "completed" );
        expect( lockReason( by( "L" ) ) ).toBe( "loop_in_progress" );
        expect( lockReason( by( "A1" ) ) ).toBeNull();
    });
});

describe( "add", () => {

    it( "adds nodes under the root, an existing label and a new node", () => {
        const g = fixture();
        const r = applyTreeChanges( g, ops({ add: [ addOp( "n1", "root" ), addOp( "n2", "A" ), addOp( "n3", "n1" ) ] }) );
        expect( r.errors ).toEqual( [] );
        expect( r.graph.nodes ).toHaveLength( g.nodes.length + 3 );
        expect( parentOf( r.graph, "n1" ) ).toBe( "root" );
        expect( parentOf( r.graph, "n2" ) ).toBe( "A" );
        expect( parentOf( r.graph, "n3" ) ).toBe( "n1" );
        expect( r.diff.added.map( a => a.id ) ).toEqual( [ "n1", "n2", "n3" ] );
        expect( r.diff.addedEdges ).toHaveLength( 3 );
        expect( r.diff.removedEdges ).toEqual( [] );
    });

    it( "fills optional fields with editor defaults and system fields with safe values", () => {
        const r = applyTreeChanges( fixture(), ops({ add: [ addOp( "n1", "root" ) ] }) );
        const t = r.graph.nodes.find( n => n.id === "n1" )!.data.task;
        expect( t ).toMatchObject({ bg_color: "#FFFFFF", text_color: "#000000", isLoop: false, isCompleted: false, repetitions_completed: 0, isRoot: false });
    });

    it( "warns when adding children to an existing action", () => {
        const r = applyTreeChanges( fixture(), ops({ add: [ addOp( "n1", "C" ) ] }) );
        expect( r.errors ).toEqual( [] );
        expect( r.warnings.join() ).toContain( "must be completed before it can start" );
    });

    it( "rejects attaching to a completed node", () => {
        expectError( applyTreeChanges( fixture(), ops({ add: [ addOp( "n1", "A2" ) ] }) ).errors, "completed" );
    });

    it( "rejects unknown parents, self parents, duplicate keys and existing ids as keys", () => {
        expectError( applyTreeChanges( fixture(), ops({ add: [ addOp( "n1", "nope" ) ] }) ).errors, "not found" );
        expectError( applyTreeChanges( fixture(), ops({ add: [ addOp( "n1", "n1" ) ] }) ).errors, "own parent" );
        expectError( applyTreeChanges( fixture(), ops({ add: [ addOp( "n1", "root" ), addOp( "n1", "root" ) ] }) ).errors, "duplicate" );
        expectError( applyTreeChanges( fixture(), ops({ add: [ addOp( "A1", "root" ) ] }) ).errors, "existing node id" );
    });

    it( "rejects new nodes forming a cycle among themselves", () => {
        const r = applyTreeChanges( fixture(), ops({ add: [ addOp( "x", "y" ), addOp( "y", "x" ) ] }) );
        expectError( r.errors, "cycle" );
    });

    it( "validates field ranges", () => {
        const bad = addOp( "n1", "root", { time_limit: { hours: 0, minutes: 90, seconds: 0 } } );
        expectError( applyTreeChanges( fixture(), ops({ add: [ bad ] }) ).errors, "time_limit" );
        const loop = addOp( "n2", "root", { isLoop: true, repetitions_required: 1 } );
        expectError( applyTreeChanges( fixture(), ops({ add: [ loop ] }) ).errors, "at least 2" );
    });

});

describe( "update", () => {

    it( "updates only changed fields and records before/after", () => {
        const r = applyTreeChanges( fixture(), ops({ update: [ { id: "A1", changes: { task_name: "Read official docs", description: "", time_limit: { hours: 1, minutes: 0, seconds: 0 } }, reason: "clearer" } ] }) );
        expect( r.errors ).toEqual( [] );
        const t = r.graph.nodes.find( n => n.id === "A1" )!;
        expect( t.data.task.task_name ).toBe( "Read official docs" );
        expect( t.data.label ).toBe( "Read official docs" );
        expect( r.diff.updated ).toHaveLength( 1 );
        // description was already "" so it is not a change
        expect( r.diff.updated[0].before ).toEqual( { task_name: "Read docs", time_limit: { hours: 0, minutes: 30, seconds: 0 } } );
        expect( r.diff.updated[0].after ).toEqual( { task_name: "Read official docs", time_limit: { hours: 1, minutes: 0, seconds: 0 } } );
        expect( r.diff.updated[0].reason ).toBe( "clearer" );
    });

    it( "does not mutate the input graph", () => {
        const g = fixture();
        const snapshot = JSON.stringify( g );
        applyTreeChanges( g, ops({ update: [ { id: "A1", changes: { task_name: "X" } } ], delete: [ { id: "B1" } ] }) );
        expect( JSON.stringify( g ) ).toBe( snapshot );
    });

    it( "rejects updating the root or completed nodes", () => {
        expectError( applyTreeChanges( fixture(), ops({ update: [ { id: "root", changes: { task_name: "X" } } ] }) ).errors, "root" );
        expectError( applyTreeChanges( fixture(), ops({ update: [ { id: "A2", changes: { task_name: "X" } } ] }) ).errors, "completed" );
    });

    it( "rejects system fields and ignores unknown fields with a warning", () => {
        const r = applyTreeChanges( fixture(), ops({ update: [ { id: "A1", changes: { isCompleted: true, foo: 1, task_name: "Y" } } ] }) );
        expectError( r.errors, "isCompleted is managed by the app" );
        expect( r.warnings.join() ).toContain( "unknown field \"foo\"" );
    });

    it( "rejects repetitions_required below repetitions_completed", () => {
        const r = applyTreeChanges( fixture(), ops({ update: [ { id: "L", changes: { repetitions_required: 1 } } ] }), { allowedProtectedIds: [ "L" ] } );
        expectError( r.errors, "cannot be lower" );
    });

    it( "skips no-op updates with a warning", () => {
        const r = applyTreeChanges( fixture(), ops({ update: [ { id: "A1", changes: { task_name: "Read docs" } } ] }) );
        expect( r.errors ).toEqual( [] );
        expect( r.diff.updated ).toHaveLength( 0 );
        expect( r.warnings.join() ).toContain( "no effective change" );
    });

    it( "rejects updating a node that is also deleted", () => {
        expectError( applyTreeChanges( fixture(), ops({ update: [ { id: "B1", changes: { task_name: "X" } } ], delete: [ { id: "B1" } ] }) ).errors, "both updated and deleted" );
    });

});

describe( "move (break + reconnect)", () => {

    it( "moves a branch to another parent and reports removed/added edges", () => {
        const r = applyTreeChanges( fixture(), ops({ move: [ { id: "C", newParent: "B", reason: "belongs to practice" } ] }) );
        expect( r.errors ).toEqual( [] );
        expect( parentOf( r.graph, "C" ) ).toBe( "B" );
        expect( parentOf( r.graph, "C1" ) ).toBe( "C" );
        expect( r.diff.removedEdges ).toEqual( [ { source: "root", target: "C" } ] );
        expect( r.diff.addedEdges ).toEqual( [ { source: "B", target: "C" } ] );
        expect( r.diff.moved[0] ).toMatchObject({ id: "C", fromParentId: "root", toParentId: "B", auto: false });
    });

    it( "moves an existing node under a new node", () => {
        const r = applyTreeChanges( fixture(), ops({ add: [ addOp( "grp", "root", { isAction: false } ) ], move: [ { id: "B1", newParent: "grp" } ] }) );
        expect( r.errors ).toEqual( [] );
        expect( parentOf( r.graph, "B1" ) ).toBe( "grp" );
    });

    it( "rejects moving into its own branch", () => {
        expectError( applyTreeChanges( fixture(), ops({ move: [ { id: "C", newParent: "C1" } ] }) ).errors, "cycle" );
    });

    it( "rejects moving the root, a completed node, or under a completed node", () => {
        expectError( applyTreeChanges( fixture(), ops({ move: [ { id: "root", newParent: "A" } ] }) ).errors, "root" );
        expectError( applyTreeChanges( fixture(), ops({ move: [ { id: "A2", newParent: "B" } ] }) ).errors, "completed" );
        expectError( applyTreeChanges( fixture(), ops({ move: [ { id: "B1", newParent: "A2" } ] }) ).errors, "completed" );
    });

    it( "rejects disconnecting without a new parent", () => {
        expectError( applyTreeChanges( fixture(), ops({ move: [ { id: "B1", newParent: "" } ] }) ).errors, "newParent is required" );
    });

    it( "rejects moving a new node (use parentKey instead) and moving twice", () => {
        expectError( applyTreeChanges( fixture(), ops({ add: [ addOp( "n1", "root" ) ], move: [ { id: "n1", newParent: "A" } ] }) ).errors, "parentKey" );
        expectError( applyTreeChanges( fixture(), ops({ move: [ { id: "B1", newParent: "A" }, { id: "B1", newParent: "C" } ] }) ).errors, "moved twice" );
    });

    it( "skips a move to the current parent with a warning", () => {
        const r = applyTreeChanges( fixture(), ops({ move: [ { id: "B1", newParent: "B" } ] }) );
        expect( r.errors ).toEqual( [] );
        expect( r.diff.moved ).toHaveLength( 0 );
        expect( r.warnings.join() ).toContain( "already under" );
    });

});

describe( "delete", () => {

    it( "deletes a leaf", () => {
        const r = applyTreeChanges( fixture(), ops({ delete: [ { id: "B1", reason: "duplicate" } ] }) );
        expect( r.errors ).toEqual( [] );
        expect( r.graph.nodes.some( n => n.id === "B1" ) ).toBe( false );
        expect( r.graph.edges.some( e => e.target === "B1" ) ).toBe( false );
        expect( r.diff.deleted ).toEqual( [ { id: "B1", task_name: "Mini project", reparentedChildren: [], reason: "duplicate" } ] );
        expect( r.diff.removedEdges ).toEqual( [ { source: "B", target: "B1" } ] );
    });

    it( "moves children of a deleted middle node up to its parent", () => {
        const r = applyTreeChanges( fixture(), ops({ delete: [ { id: "C" } ] }) );
        expect( r.errors ).toEqual( [] );
        expect( parentOf( r.graph, "C1" ) ).toBe( "root" );
        expect( r.diff.deleted[0].reparentedChildren ).toEqual( [ "C1" ] );
        expect( r.diff.moved ).toContainEqual( expect.objectContaining({ id: "C1", fromParentId: "C", toParentId: "root", auto: true }) );
    });

    it( "respects an explicit move of a deleted node's child", () => {
        const r = applyTreeChanges( fixture(), ops({ delete: [ { id: "C" } ], move: [ { id: "C1", newParent: "A" } ] }) );
        expect( r.errors ).toEqual( [] );
        expect( parentOf( r.graph, "C1" ) ).toBe( "A" );
        expect( r.diff.deleted[0].reparentedChildren ).toEqual( [] );
    });

    it( "deletes a whole branch when children are deleted too", () => {
        const r = applyTreeChanges( fixture(), ops({ delete: [ { id: "C" }, { id: "C1" } ] }) );
        expect( r.errors ).toEqual( [] );
        expect( r.graph.nodes.map( n => n.id ) ).not.toContain( "C1" );
    });

    it( "rejects deleting the root, a completed node, or a parent of a completed node", () => {
        expectError( applyTreeChanges( fixture(), ops({ delete: [ { id: "root" } ] }) ).errors, "root" );
        expectError( applyTreeChanges( fixture(), ops({ delete: [ { id: "A2" } ] }) ).errors, "completed" );
        expectError( applyTreeChanges( fixture(), ops({ delete: [ { id: "A" } ] }) ).errors, "is completed and cannot be moved" );
    });

    it( "rejects attaching new nodes to a node being deleted", () => {
        expectError( applyTreeChanges( fixture(), ops({ add: [ addOp( "n1", "B1" ) ], delete: [ { id: "B1" } ] }) ).errors, "being deleted" );
    });

    it( "rejects unknown ids", () => {
        expectError( applyTreeChanges( fixture(), ops({ delete: [ { id: "ghost" } ] }) ).errors, "not found" );
    });

});

describe( "protected loops (isLoop with progress)", () => {

    const touchLoop = ops({ update: [ { id: "L", changes: { task_name: "Daily drill v2" } } ] });

    it( "is listed and blocked by default", () => {
        const r = applyTreeChanges( fixture(), touchLoop );
        expect( r.protectedNodes ).toEqual( [ expect.objectContaining({ id: "L", actions: [ "update" ], repetitions_completed: 2 }) ] );
        expectError( r.errors, "needs the user's permission" );
    });

    it( "is allowed when the user allows the id, or deferred with \"all\" while drafting", () => {
        expect( applyTreeChanges( fixture(), touchLoop, { allowedProtectedIds: [ "L" ] } ).errors ).toEqual( [] );
        const drafting = applyTreeChanges( fixture(), touchLoop, { allowedProtectedIds: "all" } );
        expect( drafting.errors ).toEqual( [] );
        expect( drafting.protectedNodes ).toHaveLength( 1 );
    });

    it( "counts adding a child, moving and deleting as touching", () => {
        expect( applyTreeChanges( fixture(), ops({ add: [ addOp( "n1", "L" ) ] }), { allowedProtectedIds: "all" } ).protectedNodes[0].actions ).toEqual( [ "add child" ] );
        expect( applyTreeChanges( fixture(), ops({ move: [ { id: "L", newParent: "A" } ] }), { allowedProtectedIds: "all" } ).protectedNodes[0].actions ).toEqual( [ "move" ] );
        expect( applyTreeChanges( fixture(), ops({ delete: [ { id: "L" } ] }), { allowedProtectedIds: "all" } ).protectedNodes[0].actions ).toEqual( [ "delete" ] );
        // Deleting its parent moves the loop automatically, which also needs permission
        expect( applyTreeChanges( fixture(), ops({ delete: [ { id: "B" } ] }), { allowedProtectedIds: "all" } ).protectedNodes[0].actions ).toEqual( [ "move" ] );
    });

    it( "withoutOpsFor drops the denied operations so the rest still applies", () => {
        const proposal = ops({ update: [ { id: "L", changes: { task_name: "X" } }, { id: "A1", changes: { task_name: "Y" } } ], add: [ addOp( "n1", "L" ) ] });
        const filtered = withoutOpsFor( proposal, [ "L" ] );
        expect( countOps( filtered ) ).toBe( 1 );
        const r = applyTreeChanges( fixture(), filtered );
        expect( r.errors ).toEqual( [] );
        expect( r.diff.updated.map( u => u.id ) ).toEqual( [ "A1" ] );
    });

});

describe( "structure and limits", () => {

    it( "rejects empty proposals and more than MAX_OPS operations", () => {
        expectError( applyTreeChanges( fixture(), emptyOps() ).errors, "no changes" );
        const many = Array.from( { length: MAX_OPS + 1 }, ( _, i ) => addOp( `n${i}`, "root" ) );
        expectError( applyTreeChanges( fixture(), ops({ add: many }) ).errors, "too many" );
    });

    it( "warns (not errors) about pre-existing disconnected nodes the proposal does not touch", () => {
        const g = fixture();
        g.nodes.push( node( "orphan", task( "Lost" ) ) );
        const r = applyTreeChanges( g, ops({ add: [ addOp( "n1", "root" ) ] }) );
        expect( r.errors ).toEqual( [] );
        expect( r.warnings.join() ).toContain( "already disconnected" );
        // ...but the proposal may fix it
        const fixed = applyTreeChanges( g, ops({ move: [ { id: "orphan", newParent: "A" } ] }) );
        expect( fixed.errors ).toEqual( [] );
        expect( fixed.warnings.join() ).not.toContain( "already disconnected" );
    });

    it( "rejects a graph without exactly one root", () => {
        const g = fixture();
        g.nodes[0].data.task.isRoot = false;
        expectError( applyTreeChanges( g, ops({ add: [ addOp( "n1", "A" ) ] }) ).errors, "exactly one root" );
    });

    it( "keeps every surviving node reachable from the root after a mixed proposal", () => {
        const r = applyTreeChanges( fixture(), ops({
            add: [ addOp( "grp", "root", { isAction: false } ), addOp( "n1", "grp" ) ],
            update: [ { id: "B1", changes: { description: "Small app" } } ],
            move: [ { id: "C", newParent: "grp" } ],
            delete: [ { id: "A1" } ],
        }) );
        expect( r.errors ).toEqual( [] );
        const parents = new Map( r.graph.edges.map( e => [ e.target, e.source ] ) );
        r.graph.nodes.filter( n => !n.data.task.isRoot ).forEach( n => {
            let cur: string | undefined = n.id;
            const seen = new Set<string>();
            while( cur && cur !== "root" && !seen.has( cur ) ) { seen.add( cur ); cur = parents.get( cur ); }
            expect( cur, `${n.id} should reach root` ).toBe( "root" );
        });
        // one parent per node
        expect( new Set( r.graph.edges.map( e => e.target ) ).size ).toBe( r.graph.edges.length );
    });

});

describe( "normalizeOps", () => {

    it( "turns temporary keys into UUIDs everywhere they are referenced", () => {
        const { ops: n } = normalizeOps( fixture(), { add: [ addOp( "grp", "root" ), addOp( "leaf", "grp" ) ], move: [ { id: "B1", newParent: "grp" } ] } );
        const uuid = /^[0-9a-f-]{36}$/i;
        expect( n.add[0].key ).toMatch( uuid );
        expect( n.add[1].parentKey ).toBe( n.add[0].key );
        expect( n.move[0].newParent ).toBe( n.add[0].key );
        expect( n.add[0].parentKey ).toBe( "root" );
    });

    it( "resolves a unique exact task name to its id with a warning", () => {
        const { ops: n, warnings } = normalizeOps( fixture(), { delete: [ { id: "mini project" } ], add: [ addOp( "x", "Practice" ) ] } );
        expect( n.delete[0].id ).toBe( "B1" );
        expect( n.add[0].parentKey ).toBe( "B" );
        expect( warnings.length ).toBe( 2 );
    });

    it( "never keeps a UUID key sent by the model", () => {
        const echoed = "11111111-1111-4111-8111-111111111111";
        const { ops: n } = normalizeOps( fixture(), { add: [ addOp( echoed, "root" ), addOp( "leaf", echoed ) ] } );
        expect( n.add[0].key ).not.toBe( echoed );
        expect( n.add[1].parentKey ).toBe( n.add[0].key );
        expect( n.add[1].key ).not.toBe( n.add[0].key );
    });

    it( "leaves existing ids used as keys untouched so the collision is reported", () => {
        const { ops: n } = normalizeOps( fixture(), { add: [ addOp( "A1", "root" ) ] } );
        expect( n.add[0].key ).toBe( "A1" );
        expectError( applyTreeChanges( fixture(), n ).errors, "existing node id" );
    });

});

describe( "buildPreviewGraph", () => {

    it( "marks changes per node, keeps deleted nodes as ghosts and draws removed edges", () => {
        const g = fixture();
        const r = applyTreeChanges( g, ops({
            add: [ addOp( "n1", "A" ) ],
            update: [ { id: "A1", changes: { task_name: "Docs" } } ],
            move: [ { id: "B1", newParent: "C" } ],
            delete: [ { id: "C1" } ],
        }) );
        expect( r.errors ).toEqual( [] );
        const p = buildPreviewGraph( g, r );
        const change = ( id: string ) => p.nodes.find( n => n.id === id )?.data.previewChange;
        expect( change( "n1" )?.kinds ).toEqual( [ "added" ] );
        expect( change( "A1" ) ).toMatchObject({ kinds: [ "updated" ], before: { task_name: "Read docs" }, after: { task_name: "Docs" } });
        expect( change( "B1" ) ).toMatchObject({ kinds: [ "moved" ], fromParent: "Practice", toParent: "Final project" });
        expect( change( "C1" )?.kinds ).toEqual( [ "deleted" ] );
        expect( change( "root" ) ).toBeUndefined();
        expect( p.edges.some( e => e.id === "removed-B-B1" ) ).toBe( true );
        expect( p.edges.some( e => e.id === "removed-C-C1" ) ).toBe( true );
    });

});

describe( "rekeyAddOps", () => {

    it( "renames taken keys and rewrites references", () => {
        const o = ops({ add: [ addOp( "A1x", "root" ), addOp( "leaf", "A1x" ) ], move: [ { id: "B1", newParent: "A1x" } ] });
        const r = rekeyAddOps( o, new Set( [ "A1x" ] ) );
        const fresh = r.add[0].key;
        expect( fresh ).not.toBe( "A1x" );
        expect( r.add[1].parentKey ).toBe( fresh );
        expect( r.move[0].newParent ).toBe( fresh );
        expect( r.add[1].key ).toBe( "leaf" );
    });

    it( "returns the same ops when nothing collides", () => {
        const o = ops({ add: [ addOp( "n1", "root" ) ] });
        expect( rekeyAddOps( o, new Set( [ "root", "A" ] ) ) ).toBe( o );
    });

});

describe( "buildPreviewGraph ids", () => {

    it( "never returns duplicate node or edge ids", () => {
        const g = fixture();
        const r = applyTreeChanges( g, ops({ add: [ addOp( "n1", "A" ) ], delete: [ { id: "C1" } ], move: [ { id: "B1", newParent: "C" } ] }) );
        expect( r.errors ).toEqual( [] );
        // simulate a broken result that repeats a node and an edge
        const broken = { ...r, graph: { nodes: [ ...r.graph.nodes, r.graph.nodes[0] ], edges: [ ...r.graph.edges, r.graph.edges[0] ] } };
        const p = buildPreviewGraph( g, broken );
        expect( new Set( p.nodes.map( n => n.id ) ).size ).toBe( p.nodes.length );
        expect( new Set( p.edges.map( e => e.id ) ).size ).toBe( p.edges.length );
    });

});
