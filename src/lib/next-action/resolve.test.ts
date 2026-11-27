import { describe, expect, it } from "vitest";
import { fixture } from "./test-fixtures";
import { matchCompletedNode, planHighlights, resolvePlan, shouldAskForPlan } from "./resolve";
import type { NextActionRow } from "./types";

const row = ( extra: Partial<NextActionRow> = {} ): NextActionRow => ( {
    id: "na1",
    project_id: "proj",
    user_id: "u",
    status: "saved",
    origin: "task_completed",
    intent: "unsure",
    kind: "practice_progress",
    source: "ai",
    progress_node_id: "b1",
    practice_node_id: "p",
    progress_task_name: "b1",
    practice_task_name: "p",
    progress_reason: "next step",
    practice_reason: "practice",
    message: "msg",
    scheduled_for: "2026-11-27",
    generation_count: 2,
    history: [],
    model: "m",
    progress_done_at: null,
    practice_done_at: null,
    saved_at: "2026-11-27T00:00:00Z",
    created_at: "2026-11-27T00:00:00Z",
    updated_at: "2026-11-27T00:00:00Z",
    ...extra,
} );

describe( "resolvePlan", () => {

    it( "lists practice then progress with their states", () => {
        const v = resolvePlan( row(), fixture, "2026-11-27" )!;
        expect( v.items.map( i => [ i.role, i.nodeId, i.state ] ) ).toEqual( [ [ "practice", "p", "ok" ], [ "progress", "b1", "ok" ] ] );
        expect( v ).toMatchObject( { stale: false, finished: false, overdue: false, remainingRevisions: 2 } );
    } );

    it( "marks deleted and blocked items as stale, keeping the snapshot name", () => {
        const rows = fixture.filter( n => n.id !== "p" ).concat( { ...fixture[5], id: "b1child", parent_node_id: "b1" } );
        const v = resolvePlan( row( { practice_node_id: null } ), rows, "2026-11-27" )!;
        expect( v.items[0] ).toMatchObject( { state: "missing", name: "p" } );
        expect( v.items[1].state ).toBe( "blocked" );
        expect( v.stale ).toBe( true );
    } );

    it( "done items and overdue days", () => {
        const v = resolvePlan( row( { progress_done_at: "x", practice_done_at: "y", scheduled_for: "2026-11-25" } ), fixture, "2026-11-27" )!;
        expect( v.finished ).toBe( true );
        expect( v.overdue ).toBe( false );
        const w = resolvePlan( row( { scheduled_for: "2026-11-25" } ), fixture, "2026-11-27" )!;
        expect( w.overdue ).toBe( true );
    } );

    it( "returns null for an empty draft", () => {
        expect( resolvePlan( row( { kind: null } ), fixture, "2026-11-27" ) ).toBeNull();
    } );

} );

describe( "shouldAskForPlan / planHighlights / matchCompletedNode", () => {

    it( "asks only when there is something to plan and the plan is missing, finished or stale", () => {
        const v = resolvePlan( row(), fixture, "2026-11-27" );
        expect( shouldAskForPlan( null, 0 ) ).toBe( false );
        expect( shouldAskForPlan( null, 2 ) ).toBe( true );
        expect( shouldAskForPlan( v, 2 ) ).toBe( false );
        expect( shouldAskForPlan( resolvePlan( row( { progress_node_id: null } ), fixture, "2026-11-27" ), 2 ) ).toBe( true );
    } );

    it( "highlights only startable items", () => {
        expect( planHighlights( resolvePlan( row( { practice_done_at: "x" } ), fixture, "2026-11-27" ) ) ).toEqual( { b1: "progress" } );
    } );

    it( "matches a completed node to its open item", () => {
        expect( matchCompletedNode( row(), "p" ) ).toBe( "practice" );
        expect( matchCompletedNode( row( { progress_done_at: "x" } ), "b1" ) ).toBeNull();
        expect( matchCompletedNode( row(), "zz" ) ).toBeNull();
    } );

} );
