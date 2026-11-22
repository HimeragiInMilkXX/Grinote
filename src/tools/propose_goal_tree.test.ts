import { describe, expect, it, vi } from "vitest";

// The tool module imports server actions (Supabase, next/headers); the schema tests don't need them.
vi.mock( "@/app/project/[projectId]/tree/serverActions", () => ({
    fetchGraph: vi.fn(),
    countRecordsForNodes: vi.fn(),
}) );

const { proposeGoalTreeInputSchema, summarizeForModel } = await import( "./propose_goal_tree" );

const base = { project_id: "p1", goal: "Reorganize practice" };

describe( "propose_goal_tree input schema", () => {

    it( "accepts a single-list proposal and defaults the other lists to []", () => {
        const parsed = proposeGoalTreeInputSchema.parse({ ...base, delete: [ { id: "n1", reason: "duplicate" } ] });
        expect( parsed.add ).toEqual( [] );
        expect( parsed.update ).toEqual( [] );
        expect( parsed.move ).toEqual( [] );
        expect( parsed.delete ).toHaveLength( 1 );
    });

    it( "accepts a minimal new node (optional fields omitted)", () => {
        const parsed = proposeGoalTreeInputSchema.parse({
            ...base,
            add: [ { key: "k1", parentKey: "root-id", task_name: "Practice scales", isAction: true, time_limit: { hours: 0, minutes: 30, seconds: 0 } } ],
        });
        expect( parsed.add[0].task_name ).toBe( "Practice scales" );
    });

    it( "accepts a partial update and keeps unknown keys for the engine to report", () => {
        const parsed = proposeGoalTreeInputSchema.parse({
            ...base,
            update: [ { id: "n1", changes: { task_name: "Renamed", isCompleted: true } } ],
        });
        expect( parsed.update[0].changes ).toMatchObject({ task_name: "Renamed", isCompleted: true });
    });

    it( "accepts a mixed proposal typical of a small model", () => {
        expect( () => proposeGoalTreeInputSchema.parse({
            ...base,
            add: [ { key: "grp", parentKey: "root-id", task_name: "Week 1", isAction: false, time_limit: { hours: 0, minutes: 2, seconds: 0 } } ],
            update: [ { id: "a", changes: { time_limit: { hours: 1, minutes: 30, seconds: 0 } }, reason: "more realistic" } ],
            move: [ { id: "b", newParent: "grp" } ],
            delete: [ { id: "c" } ],
        }) ).not.toThrow();
    });

    it( "rejects malformed durations, colors and missing references", () => {
        const bad = ( extra: object ) => proposeGoalTreeInputSchema.safeParse({ ...base, ...extra }).success;
        expect( bad({ add: [ { key: "k", parentKey: "r", task_name: "T", isAction: true, time_limit: { hours: 0, minutes: 90, seconds: 0 } } ] }) ).toBe( false );
        expect( bad({ add: [ { key: "k", parentKey: "r", task_name: "T", isAction: true, time_limit: "30m" } ] }) ).toBe( false );
        expect( bad({ add: [ { key: "k", parentKey: "r", task_name: "T", isAction: true, time_limit: { hours: 0, minutes: 5, seconds: 0 }, bg_color: "blue" } ] }) ).toBe( false );
        expect( bad({ move: [ { id: "a" } ] }) ).toBe( false );
        expect( bad({ update: [ { changes: { task_name: "x" } } ] }) ).toBe( false );
        expect( bad({ goal: "" }) ).toBe( false );
    });

});

describe( "summarizeForModel", () => {

    it( "produces a short text summary instead of the full diff", () => {
        const text = summarizeForModel({
            status: "draft",
            goal: "g",
            project_id: "p1",
            ops: { add: [], update: [], move: [], delete: [] },
            diff: {
                added: [ { id: "n", task_name: "New", parentId: "r" } ],
                updated: [ { id: "u", task_name: "U", before: { task_name: "Old" }, after: { task_name: "U" } } ],
                moved: [ { id: "m", task_name: "M", fromParentId: "r", toParentId: "u", auto: false } ],
                deleted: [ { id: "d", task_name: "D", reparentedChildren: [] } ],
                removedEdges: [],
                addedEdges: [],
                names: { r: "Root", u: "U" },
            },
            protectedNodes: [ { id: "l", task_name: "Loop", repetitions_completed: 1, repetitions_required: 3, actions: [ "update" ] } ],
            warnings: [],
            requiresConfirmation: true,
        });
        expect( text ).toContain( "1 added, 1 updated, 1 moved, 1 deleted" );
        expect( text ).toContain( "+ New under Root" );
        expect( text ).toContain( "> M: Root -> U" );
        expect( text ).toContain( "Needs user permission" );
    });

});
