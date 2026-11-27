import { describe, expect, it } from "vitest";
import { fixture, node } from "@/lib/next-action/test-fixtures";
import { buildEntries, buildScheduleNodes, capacityOf, capacityReason, openCountByNode } from "./rules";
import { dayTotal, entriesForDay, pendingCount, scheduleWeeks, todayHighlights, weekDayKeys } from "./days";
import { normalizeScheduleOps, ScheduleOpsError, type ScheduleOpsContext } from "./normalize";
import { scheduleGate } from "./gate";
import type { ScheduleItemRow } from "./types";

// fixture: root ─ a (group) ─ a1 (done), a2 | b (action, waits for b1) ─ b1 (75 min) | p (loop 1/3)
const TODAY = "2026-11-27"; // Friday
const nodes = buildScheduleNodes( fixture );
const byId = Object.fromEntries( nodes.map( n => [ n.id, n ] ) );

const item = ( id: string, nodeId: string, day: string, extra: Partial<ScheduleItemRow> = {} ): ScheduleItemRow => ( {
    id,
    project_id: "proj",
    node_id: nodeId,
    scheduled_for: day,
    done_at: null,
    record_id: null,
    created_at: `2026-11-20T00:00:0${id.length}Z`,
    ...extra,
} );

const ctx = ( items: ScheduleItemRow[] = [], extra: Partial<ScheduleOpsContext> = {} ): ScheduleOpsContext => ( {
    todayKey: TODAY,
    goalKey: "2027-03-01",
    workDays: [ 1, 2, 3, 4, 5 ],
    goalMinutes: 60,
    nodes,
    items,
    ...extra,
} );

const problemsOf = ( fn: () => unknown ) => {
    try { fn(); } catch( e ) { if( e instanceof ScheduleOpsError ) return e.problems; throw e; }
    throw new Error( "expected ScheduleOpsError" );
};

describe( "buildScheduleNodes", () => {

    it( "maps node states in tree order", () => {
        expect( nodes.map( n => [ n.id, n.state ] ) ).toEqual( [
            [ "root", "root" ], [ "a", "not_action" ], [ "a1", "completed" ], [ "a2", "schedulable" ],
            [ "b", "blocked" ], [ "b1", "schedulable" ], [ "p", "schedulable" ],
        ] );
        expect( byId.b1.estimateMinutes ).toBe( 75 );
        expect( byId.a2.path ).toEqual( [ "a" ] );
    } );

} );

describe( "capacity", () => {

    it( "one-time tasks once, loops up to the remaining repetitions", () => {
        expect( capacityOf( byId.a2, 0 ) ).toBe( 1 );
        expect( capacityOf( byId.a2, 1 ) ).toBe( 0 );
        expect( capacityOf( byId.p, 0 ) ).toBe( 2 );
        expect( capacityOf( byId.p, 2 ) ).toBe( 0 );
        expect( capacityOf( byId.b, 0 ) ).toBe( 1 ); // blocked is still schedulable
        expect( capacityOf( byId.a1, 0 ) ).toBe( 0 );
        expect( capacityOf( byId.root, 0 ) ).toBe( 0 );
        expect( capacityReason( byId.a, 0 ) ).toMatch( /レーベル/ );
        expect( capacityReason( byId.p, 2 ) ).toMatch( /2回/ );
    } );

    it( "done entries don't count as open", () => {
        expect( openCountByNode( [ item( "x", "p", TODAY, { done_at: "2026-11-27T01:00:00Z" } ), item( "y", "p", TODAY ) ] ).get( "p" ) ).toBe( 1 );
    } );

} );

describe( "entries and days", () => {

    const items = [
        item( "old", "a2", "2026-11-25" ),
        item( "done", "p", "2026-11-25", { done_at: "2026-11-25T03:00:00Z" } ),
        item( "t1", "b1", TODAY ),
        item( "t2", "p", TODAY ),
        item( "gone", "a1", TODAY ),
        item( "fut", "p", "2026-11-30" ),
    ];
    const entries = buildEntries( items, nodes, TODAY );

    it( "derives entry states", () => {
        const state = Object.fromEntries( entries.map( e => [ e.id, e.state ] ) );
        expect( state ).toEqual( { old: "carried", done: "done", t1: "open", t2: "open", gone: "stale", fut: "open" } );
    } );

    it( "today shows carried entries first, then its own in tree order", () => {
        expect( entriesForDay( entries, TODAY, TODAY ).map( e => e.id ) ).toEqual( [ "old", "gone", "t1", "t2" ] );
        expect( entriesForDay( entries, "2026-11-25", TODAY ).map( e => e.id ) ).toEqual( [ "old", "done" ] );
        expect( pendingCount( entriesForDay( entries, TODAY, TODAY ) ) ).toBe( 3 );
    } );

    it( "totals skip stale entries and flag days over the goal", () => {
        const today = entriesForDay( entries, TODAY, TODAY );
        expect( dayTotal( TODAY, today, 60 ) ).toEqual( { key: TODAY, minutes: 30 + 75 + 30, goalMinutes: 60, over: true } );
        expect( dayTotal( TODAY, today, null ).over ).toBe( false );
    } );

    it( "highlights the nodes with pending entries today (carried included, done/stale/other days not)", () => {
        expect( todayHighlights( entries, TODAY ) ).toEqual( {
            a2: { count: 1, carried: true, startable: true },
            b1: { count: 1, carried: false, startable: true },
            p: { count: 1, carried: false, startable: true },
        } );
    } );

    it( "counts each pending session of a node and keeps blocked nodes", () => {
        const more = buildEntries( [ ...items, item( "t3", "p", TODAY ), item( "w", "b", TODAY ) ], nodes, TODAY );
        const h = todayHighlights( more, TODAY );
        expect( h.p.count ).toBe( 2 );
        expect( h.b ).toEqual( { count: 1, carried: false, startable: false } );
    } );

} );

describe( "scheduleWeeks", () => {

    it( "runs from the creation week to the goal week", () => {
        const { weeks, currentIndex } = scheduleWeeks( "2026-11-10", "2027-01-20", TODAY );
        expect( weeks[0] ).toBe( "2026-11-09" );
        expect( weeks[ currentIndex ] ).toBe( "2026-11-23" );
        expect( weeks.at( -1 ) ).toBe( "2027-01-18" );
        expect( weekDayKeys( "2026-11-23" ) ).toEqual( [ "2026-11-23", "2026-11-24", "2026-11-25", "2026-11-26", "2026-11-27", "2026-11-28", "2026-11-29" ] );
    } );

    it( "stops at the goal week (the goal mid-week keeps the whole week)", () => {
        const same = scheduleWeeks( TODAY, "2026-11-28", TODAY );
        expect( same.weeks ).toEqual( [ "2026-11-23" ] );
        const next = scheduleWeeks( TODAY, "2026-12-02", TODAY );
        expect( next.weeks ).toEqual( [ "2026-11-23", "2026-11-30" ] );
        expect( next.currentIndex ).toBe( 0 );
    } );

    it( "reaches a few weeks ahead without a goal or with an overdue one", () => {
        expect( scheduleWeeks( TODAY, null, TODAY ).weeks.length ).toBe( 5 );
        const overdue = scheduleWeeks( "2026-10-01", "2026-11-01", TODAY );
        expect( overdue.weeks[ overdue.currentIndex ] ).toBe( "2026-11-23" );
        expect( overdue.weeks.at( -1 ) ).toBe( "2026-12-21" );
    } );

    it( "extends past the goal to reach an entry left after it", () => {
        expect( scheduleWeeks( TODAY, "2026-11-28", TODAY, "2026-12-09" ).weeks.at( -1 ) ).toBe( "2026-12-07" );
        expect( scheduleWeeks( TODAY, "2026-11-28", TODAY, "2026-11-20" ).weeks ).toEqual( [ "2026-11-23" ] );
    } );

    it( "stays bounded", () => {
        const long = scheduleWeeks( "2020-01-01", "2030-01-01", TODAY );
        expect( long.weeks.length ).toBeLessThanOrEqual( 104 );
        expect( long.weeks[ long.currentIndex ] ).toBe( "2026-11-23" );
    } );

} );

describe( "normalizeScheduleOps", () => {

    it( "accepts adds and merges the same node/day", () => {
        const out = normalizeScheduleOps( { add: [ { node_id: "p", date: "2026-11-30" }, { node_id: "p", date: "2026-11-30" } ] }, ctx() );
        expect( out.ops.add ).toEqual( [ { node_id: "p", date: "2026-11-30", count: 2 } ] );
        expect( out.days ).toEqual( [ { key: "2026-11-30", beforeMinutes: 0, afterMinutes: 60, goalMinutes: 60, over: false } ] );
    } );

    it( "rejects a one-time task scheduled twice", () => {
        expect( problemsOf( () => normalizeScheduleOps( { add: [ { node_id: "a2", date: TODAY }, { node_id: "a2", date: "2026-11-30" } ] }, ctx() ) ) )
            .toEqual( [ expect.stringMatching( /add\[1\].*予定済み/ ) ] );
        expect( problemsOf( () => normalizeScheduleOps( { add: [ { node_id: "a2", date: TODAY } ] }, ctx( [ item( "x", "a2", "2026-11-30" ) ] ) ) ) )
            .toHaveLength( 1 );
    } );

    it( "rejects loops over completed + scheduled > required", () => {
        // p: 1/3 done, one open entry -> one more allowed
        const items = [ item( "x", "p", TODAY ) ];
        expect( normalizeScheduleOps( { add: [ { node_id: "p", date: "2026-11-30" } ] }, ctx( items ) ).ops.add ).toHaveLength( 1 );
        expect( problemsOf( () => normalizeScheduleOps( { add: [ { node_id: "p", date: "2026-11-30", count: 2 } ] }, ctx( items ) ) ) )
            .toEqual( [ expect.stringMatching( /あと1回/ ) ] );
    } );

    it( "frees capacity with removes in the same batch", () => {
        const items = [ item( "x", "a2", TODAY ) ];
        const out = normalizeScheduleOps( { remove: [ { item_id: "x" } ], add: [ { node_id: "a2", date: "2026-11-30" } ] }, ctx( items ) );
        expect( out.ops ).toEqual( { add: [ { node_id: "a2", date: "2026-11-30", count: 1 } ], move: [], remove: [ { item_id: "x" } ] } );
    } );

    it( "never touches done entries and never schedules into the past", () => {
        const items = [ item( "d", "p", "2026-11-25", { done_at: "2026-11-25T03:00:00Z" } ) ];
        const problems = problemsOf( () => normalizeScheduleOps( {
            remove: [ { item_id: "d" } ],
            move: [ { item_id: "d", date: TODAY } ],
            add: [ { node_id: "p", date: "2026-11-26" }, { node_id: "a1", date: TODAY }, { node_id: "a", date: TODAY }, { node_id: "zzz", date: TODAY } ],
        }, ctx( items ) ) );
        expect( problems ).toHaveLength( 6 );
        expect( problems.join( "\n" ) ).toMatch( /完了済みの予定なので削除/ );
        expect( problems.join( "\n" ) ).toMatch( /過去の日付/ );
    } );

    it( "carried entries can be moved to today, not to the past", () => {
        const items = [ item( "old", "a2", "2026-11-25" ) ];
        expect( normalizeScheduleOps( { move: [ { item_id: "old", date: TODAY } ] }, ctx( items ) ).ops.move ).toEqual( [ { item_id: "old", date: TODAY } ] );
        expect( problemsOf( () => normalizeScheduleOps( { move: [ { item_id: "old", date: "2026-11-26" } ] }, ctx( items ) ) ) ).toHaveLength( 1 );
    } );

    it( "rejects days after the goal date", () => {
        expect( problemsOf( () => normalizeScheduleOps( { add: [ { node_id: "a2", date: "2027-04-01" } ] }, ctx() ) ) )
            .toEqual( [ expect.stringMatching( /目標日/ ) ] );
    } );

    it( "warns (does not block) over the daily goal, on non-work days and for blocked tasks", () => {
        const out = normalizeScheduleOps( { add: [ { node_id: "b1", date: "2026-11-28" }, { node_id: "b", date: "2026-11-28" } ] }, ctx() );
        expect( out.ops.add ).toHaveLength( 2 );
        expect( out.warnings.join( "\n" ) ).toMatch( /目標時間（60分）を超えます/ );
        expect( out.warnings.join( "\n" ) ).toMatch( /作業日ではありません/ );
        expect( out.warnings.join( "\n" ) ).toMatch( /子タスク/ );
    } );

    it( "drops no-op moves with a warning and refuses an empty batch", () => {
        expect( problemsOf( () => normalizeScheduleOps( { move: [ { item_id: "x", date: TODAY } ] }, ctx( [ item( "x", "a2", TODAY ) ] ) ) ) )
            .toEqual( [ expect.stringMatching( /no changes/ ) ] );
        expect( problemsOf( () => normalizeScheduleOps( {}, ctx() ) ) ).toHaveLength( 1 );
    } );

    it( "computes before/after minutes for moved entries", () => {
        const out = normalizeScheduleOps( { move: [ { item_id: "x", date: "2026-11-30" } ] }, ctx( [ item( "x", "b1", TODAY ) ] ) );
        expect( out.days ).toEqual( [
            { key: TODAY, beforeMinutes: 75, afterMinutes: 0, goalMinutes: 60, over: false },
            { key: "2026-11-30", beforeMinutes: 0, afterMinutes: 75, goalMinutes: 60, over: true },
        ] );
    } );

    it( "ignores leftover entries of nodes that were completed another way", () => {
        const done = buildScheduleNodes( [ ...fixture.filter( r => r.id !== "a2" ), node( "a2", "a", { isCompleted: true } ) ] );
        const out = normalizeScheduleOps( { remove: [ { item_id: "x" } ] }, ctx( [ item( "x", "a2", TODAY ) ], { nodes: done } ) );
        expect( out.days[0] ).toMatchObject( { beforeMinutes: 0, afterMinutes: 0 } );
    } );

} );

describe( "scheduleGate", () => {

    const base = { todayKey: TODAY, nextWorkDayKey: "2026-11-30" };

    it( "allows when nothing is left today", () => {
        expect( scheduleGate( { ...base, todayPending: 0, goalReached: false, nextWorkDayPending: 3 } ).allowed ).toBe( true );
    } );

    it( "looks at today while the daily goal isn't reached", () => {
        const gate = scheduleGate( { ...base, todayPending: 2, goalReached: false, nextWorkDayPending: 0 } );
        expect( gate ).toEqual( { allowed: false, todayPending: 2, nextDayKey: TODAY, nextDayPending: 2 } );
    } );

    it( "looks at the next work day once the daily goal is reached", () => {
        expect( scheduleGate( { ...base, todayPending: 2, goalReached: true, nextWorkDayPending: 0 } ) )
            .toEqual( { allowed: true, todayPending: 2, nextDayKey: "2026-11-30", nextDayPending: 0 } );
        expect( scheduleGate( { ...base, todayPending: 2, goalReached: true, nextWorkDayPending: 1 } ).allowed ).toBe( false );
    } );

} );
