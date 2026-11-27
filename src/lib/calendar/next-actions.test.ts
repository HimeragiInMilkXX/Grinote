import { describe, expect, it } from "vitest";
import { buildNextActionDays, type CalendarPlan } from "./next-actions";

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

// 2026-11-27 is a Friday
describe( "buildNextActionDays", () => {

    it( "lists every project on today and tomorrow, sorted, with colors and work days", () => {
        const [ today, tomorrow ] = buildNextActionDays( { projects, plans: [], todayKey: "2026-11-27" } );
        expect( today ).toMatchObject( { key: "2026-11-27", label: "今日" } );
        expect( tomorrow.key ).toBe( "2026-11-28" );
        expect( today.rows.map( r => r.projectId ) ).toEqual( [ "a", "b", "c" ] );
        expect( today.rows.find( r => r.projectId === "a" )?.color ).toBe( "teal" );
        expect( today.rows.map( r => r.isWorkDay ) ).toEqual( [ true, false, true ] );
        expect( tomorrow.rows.map( r => r.isWorkDay ) ).toEqual( [ true, true, false ] );
        expect( today.rows.every( r => r.plan === null ) ).toBe( true );
        expect( today.rows.map( r => r.pastGoal ) ).toEqual( [ false, false, false ] );
        expect( tomorrow.rows.map( r => r.pastGoal ) ).toEqual( [ false, false, true ] );
    } );

    it( "puts a plan on its day and carries an unfinished past one over to today", () => {
        const [ today, tomorrow ] = buildNextActionDays( {
            projects,
            plans: [ plan( "a", "2026-11-28" ), plan( "b", "2026-11-25" ), plan( "c", "2026-11-27" ) ],
            todayKey: "2026-11-27",
        } );
        const at = ( d: typeof today, id: string ) => d.rows.find( r => r.projectId === id )!;
        expect( at( today, "a" ).plan ).toBeNull();
        expect( at( tomorrow, "a" ).plan?.scheduledFor ).toBe( "2026-11-28" );
        expect( at( today, "b" ).plan ).toMatchObject( { carriedOver: true } );
        expect( at( tomorrow, "b" ).plan ).toBeNull();
        expect( at( today, "c" ).plan ).toMatchObject( { carriedOver: false } );
    } );

    it( "hides finished plans and hints later ones", () => {
        const [ today, tomorrow ] = buildNextActionDays( {
            projects,
            plans: [ plan( "a", "2026-11-27", true ), plan( "c", "2026-12-04" ) ],
            todayKey: "2026-11-27",
        } );
        expect( today.rows.find( r => r.projectId === "a" )?.plan ).toBeNull();
        expect( tomorrow.rows.find( r => r.projectId === "c" ) ).toMatchObject( { plan: null, laterKey: "2026-12-04" } );
    } );

} );
