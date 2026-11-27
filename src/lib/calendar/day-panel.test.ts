import { describe, expect, it } from "vitest";
import { buildDayPanel, pendingCounts, type CalendarPlan, type CalendarScheduleEntry } from "./day-panel";

const projects = [
    { id: "b", name: "ぎたー", color: "rose", work_days: [ 6 ] },
    { id: "a", name: "えいご", color: "nope", work_days: [] },
    { id: "c", name: "すうがく", color: "teal", work_days: [ 5 ], achieve_date_goal: "2026-11-27" },
];

const plan = ( projectId: string, scheduledFor: string, done = false ): CalendarPlan => ( {
    projectId,
    kind: "progress",
    scheduledFor,
    items: [ { role: "progress", name: "task", done } ],
} );

const entry = ( id: string, projectId: string, dayKey: string, state: CalendarScheduleEntry["state"], order = 1 ): CalendarScheduleEntry => ( {
    id, projectId, nodeId: `n-${id}`, name: id, dayKey, state, isLoop: false, order,
} );

// 2026-11-27 is a Friday
const TODAY = "2026-11-27";

describe( "buildDayPanel", () => {

    it( "lists every project, sorted, with colors, work days and the goal date", () => {
        const today = buildDayPanel( { projects, plans: [], entries: [], focusKey: TODAY, todayKey: TODAY } );
        const tomorrow = buildDayPanel( { projects, plans: [], entries: [], focusKey: "2026-11-28", todayKey: TODAY } );
        expect( today.key ).toBe( TODAY );
        expect( today.rows.map( r => r.projectId ) ).toEqual( [ "a", "b", "c" ] );
        expect( today.rows.find( r => r.projectId === "a" )?.color ).toBe( "teal" );
        expect( today.rows.map( r => r.isWorkDay ) ).toEqual( [ true, false, true ] );
        expect( tomorrow.rows.map( r => r.isWorkDay ) ).toEqual( [ true, true, false ] );
        expect( tomorrow.rows.map( r => r.pastGoal ) ).toEqual( [ false, false, true ] );
        expect( today.rows.every( r => r.tasks.length === 0 && r.next === null && r.plan === null ) ).toBe( true );
    } );

    it( "shows the day's unfinished tasks in tree order and carries old ones over to today", () => {
        const entries = [
            entry( "t2", "a", TODAY, "open", 5 ),
            entry( "t1", "a", TODAY, "open", 2 ),
            entry( "old", "a", "2026-11-25", "carried", 9 ),
            entry( "d", "a", TODAY, "done", 1 ),
            entry( "s", "a", TODAY, "stale", 3 ),
            entry( "f1", "a", "2026-11-30", "open", 1 ),
            entry( "f2", "a", "2026-12-02", "open", 1 ),
        ];
        const row = buildDayPanel( { projects, plans: [], entries, focusKey: TODAY, todayKey: TODAY } ).rows[0];
        expect( row.tasks.map( t => t.id ) ).toEqual( [ "old", "t1", "t2" ] );
        expect( row.doneCount ).toBe( 1 );
        expect( row.next ).toEqual( { key: "2026-11-30", tasks: [ entries[5] ] } );

        // a later focused day doesn't show carried entries
        const later = buildDayPanel( { projects, plans: [], entries, focusKey: "2026-11-30", todayKey: TODAY } ).rows[0];
        expect( later.tasks.map( t => t.id ) ).toEqual( [ "f1" ] );
        expect( later.next?.key ).toBe( "2026-12-02" );

        // the past day of a carried entry still lists it as unfinished
        const past = buildDayPanel( { projects, plans: [], entries, focusKey: "2026-11-25", todayKey: TODAY } ).rows[0];
        expect( past.tasks.map( t => t.id ) ).toEqual( [ "old" ] );
    } );

    it( "puts a plan on its day and carries an unfinished past one over to today", () => {
        const plans = [ plan( "a", "2026-11-28" ), plan( "b", "2026-11-25" ), plan( "c", TODAY ), plan( "x", TODAY, true ) ];
        const today = buildDayPanel( { projects, plans, entries: [], focusKey: TODAY, todayKey: TODAY } );
        const tomorrow = buildDayPanel( { projects, plans, entries: [], focusKey: "2026-11-28", todayKey: TODAY } );
        const at = ( p: typeof today, id: string ) => p.rows.find( r => r.projectId === id )!;
        expect( at( today, "a" ).plan ).toBeNull();
        expect( at( today, "a" ).planLaterKey ).toBe( "2026-11-28" );
        expect( at( tomorrow, "a" ).plan?.scheduledFor ).toBe( "2026-11-28" );
        expect( at( today, "b" ).plan?.carriedOver ).toBe( true );
        expect( at( tomorrow, "b" ).plan ).toBeNull();
        expect( at( today, "c" ).plan?.carriedOver ).toBe( false );
    } );

    it( "drops finished plans", () => {
        const panel = buildDayPanel( { projects, plans: [ plan( "a", TODAY, true ) ], entries: [], focusKey: TODAY, todayKey: TODAY } );
        expect( panel.rows[0].plan ).toBeNull();
    } );

} );

describe( "pendingCounts", () => {

    it( "counts open entries on their day and carried ones on today", () => {
        const counts = pendingCounts( [
            entry( "1", "a", TODAY, "open" ),
            entry( "2", "a", "2026-11-20", "carried" ),
            entry( "3", "a", "2026-11-30", "open" ),
            entry( "4", "a", TODAY, "done" ),
            entry( "5", "b", TODAY, "stale" ),
        ], TODAY );
        expect( Object.fromEntries( counts ) ).toEqual( { [`a|${TODAY}`]: 2, "a|2026-11-30": 1 } );
    } );

} );
