import { describe, expect, it } from "vitest";
import { dateKeyInZone } from "@/lib/rewards/streaks";
import { buildCalendarWeeks, calendarRange, weekStartKey, workedDaysByProject, type CalendarProject } from "./week";

const project = ( over: Partial<CalendarProject> = {} ): CalendarProject => ( {
    id: "p1",
    name: "Japanese",
    color: "teal",
    work_days: [ 1, 3, 5 ], // Mon Wed Fri
    createdKey: "2026-11-01",
    achieve_date_goal: "2027-03-31",
    ...over,
} );

// 2026-11-27 is a Friday
const TODAY = "2026-11-27";

const build = ( projects: CalendarProject[], worked: Record<string, string[]> = {}, weeksAround = 1 ) =>
    buildCalendarWeeks( {
        projects,
        workedDays: new Map( Object.entries( worked ).map( ( [ id, days ] ) => [ id, new Set( days ) ] ) ),
        todayKey: TODAY,
        weeksAround,
    } );

const current = ( weeks: ReturnType<typeof build> ) => weeks.find( w => w.offset === 0 )!;
const day = ( weeks: ReturnType<typeof build>, key: string ) => weeks.flatMap( w => w.days ).find( d => d.key === key )!;

describe( "week keys", () => {

    it( "finds Monday, across month and year boundaries", () => {
        expect( weekStartKey( "2026-11-27" ) ).toBe( "2026-11-23" );
        expect( weekStartKey( "2026-11-23" ) ).toBe( "2026-11-23" );
        expect( weekStartKey( "2026-11-29" ) ).toBe( "2026-11-23" ); // Sunday
        expect( weekStartKey( "2026-12-02" ) ).toBe( "2026-11-30" );
        expect( weekStartKey( "2027-01-01" ) ).toBe( "2026-12-28" );
    });

    it( "covers n weeks on each side", () => {
        expect( calendarRange( TODAY, 2 ) ).toEqual( { firstKey: "2026-11-09", lastKey: "2026-12-13" } );
        expect( calendarRange( TODAY, 0 ) ).toEqual( { firstKey: "2026-11-23", lastKey: "2026-11-29" } );
    });

});

describe( "buildCalendarWeeks", () => {

    it( "returns 2n + 1 weeks of 7 days from Monday", () => {
        const weeks = build( [], {}, 3 );
        expect( weeks.map( w => w.offset ) ).toEqual( [ -3, -2, -1, 0, 1, 2, 3 ] );
        expect( current( weeks ).startKey ).toBe( "2026-11-23" );
        expect( current( weeks ).endKey ).toBe( "2026-11-29" );
        expect( weeks.every( w => w.days.length === 7 && w.days[0].weekday === 1 && w.days[6].weekday === 7 ) ).toBe( true );
    });

    it( "flags today and past days", () => {
        const week = current( build( [] ) );
        expect( week.days.filter( d => d.isToday ).map( d => d.key ) ).toEqual( [ TODAY ] );
        expect( week.days.filter( d => d.isPast ).map( d => d.key ) ).toEqual( [ "2026-11-23", "2026-11-24", "2026-11-25", "2026-11-26" ] );
    });

    it( "places a project on its work days", () => {
        const week = current( build( [ project() ] ) );
        expect( week.days.filter( d => d.entries.length ).map( d => d.weekday ) ).toEqual( [ 1, 3, 5 ] );
        expect( week.days[0].entries[0] ).toMatchObject( { projectId: "p1", kind: "scheduled", worked: false, isGoalDay: false, color: "teal" } );
    });

    it( "clips to the project lifespan", () => {
        const weeks = build( [ project( { createdKey: "2026-11-25", achieve_date_goal: "2026-11-30" } ) ] );
        const keys = weeks.flatMap( w => w.days ).filter( d => d.entries.length ).map( d => d.key );
        // Wed 25 (created), Fri 27, Mon 30 (goal day, also a work day)
        expect( keys ).toEqual( [ "2026-11-25", "2026-11-27", "2026-11-30" ] );
        expect( day( weeks, "2026-11-30" ).entries[0] ).toMatchObject( { kind: "scheduled", isGoalDay: true } );
    });

    it( "flags the goal day even when it isn't a work day", () => {
        const weeks = build( [ project( { achieve_date_goal: "2026-11-28" } ) ] ); // Saturday
        expect( day( weeks, "2026-11-28" ).entries ).toEqual( [ expect.objectContaining( { kind: "goal", isGoalDay: true, worked: false } ) ] );
        expect( day( weeks, "2026-11-30" ).entries ).toEqual( [] );
    });

    it( "marks worked days and adds extra entries for unplanned work", () => {
        const weeks = build( [ project() ], { p1: [ "2026-11-23", "2026-11-24" ] } );
        expect( day( weeks, "2026-11-23" ).entries[0] ).toMatchObject( { kind: "scheduled", worked: true } );
        expect( day( weeks, "2026-11-24" ).entries[0] ).toMatchObject( { kind: "extra", worked: true } );
        expect( day( weeks, "2026-11-25" ).entries[0] ).toMatchObject( { kind: "scheduled", worked: false } );
    });

    it( "orders entries by name and repairs bad colors and work days", () => {
        const weeks = build( [
            project( { id: "b", name: "Blender", color: "nope", work_days: [ 1, 1, 9 ] } ),
            project( { id: "a", name: "Art", color: "rose", work_days: [ 1 ] } ),
        ] );
        const monday = day( weeks, "2026-11-23" ).entries;
        expect( monday.map( e => e.projectId ) ).toEqual( [ "a", "b" ] );
        expect( monday[1].color ).toBe( "teal" );
    });

    it( "treats a missing goal date as open-ended", () => {
        const weeks = build( [ project( { achieve_date_goal: null } ) ], {}, 4 );
        expect( day( weeks, "2026-12-25" ).entries ).toHaveLength( 1 );
    });

});

describe( "workedDaysByProject", () => {

    const tokyo = ( d: Date ) => dateKeyInZone( d, "Asia/Tokyo" );

    it( "uses Tokyo days for start and end", () => {
        const map = workedDaysByProject( [
            // 2026-11-23 23:30 JST -> 2026-11-24 00:30 JST
            { project_id: "p1", started_at: "2026-11-23T14:30:00Z", ended_at: "2026-11-23T15:30:00Z" },
            { project_id: "p2", started_at: "2026-11-25T01:00:00Z", ended_at: null },
            { project_id: "p2", started_at: "bad", ended_at: null },
        ], tokyo );
        expect( [ ...map.get( "p1" )! ] ).toEqual( [ "2026-11-23", "2026-11-24" ] );
        expect( [ ...map.get( "p2" )! ] ).toEqual( [ "2026-11-25" ] );
    });

});
