import { describe, expect, it } from "vitest";
import { defaultWhen, isPickableDay, isWorkDayKey, nextWorkDayKey, resolveScheduledFor, todayFocusMs, type ScheduleContext } from "./schedule";

const TZ = "Asia/Tokyo";

// 2026-11-27 is a Friday
describe( "nextWorkDayKey", () => {

    it( "skips non-work days", () => {
        expect( nextWorkDayKey( "2026-11-27", [ 1, 3, 5 ] ) ).toBe( "2026-11-30" );
        expect( nextWorkDayKey( "2026-11-27", [ 6 ] ) ).toBe( "2026-11-28" );
    } );

    it( "is strictly after today", () => {
        expect( nextWorkDayKey( "2026-11-27", [ 5 ] ) ).toBe( "2026-12-04" );
    } );

    it( "treats empty work days as every day", () => {
        expect( nextWorkDayKey( "2026-11-27", [] ) ).toBe( "2026-11-28" );
        expect( isWorkDayKey( "2026-11-29", [] ) ).toBe( true );
    } );

    it( "stops at the goal date", () => {
        expect( nextWorkDayKey( "2026-11-27", [ 1 ], "2026-11-29" ) ).toBeNull();
        expect( nextWorkDayKey( "2026-11-27", [ 1 ], "2026-11-30" ) ).toBe( "2026-11-30" );
    } );

    it( "ignores a goal date already in the past", () => {
        expect( nextWorkDayKey( "2026-11-27", [ 1 ], "2026-11-01" ) ).toBe( "2026-11-30" );
    } );

} );

describe( "todayFocusMs", () => {

    it( "sums records that started or ended on the Tokyo day, without abandoned ones", () => {
        const records = [
            { started_at: "2026-11-26T16:00:00Z", ended_at: "2026-11-26T16:30:00Z", duration: 1000, status: "completed" }, // 01:00 JST on the 27th
            { started_at: "2026-11-26T14:30:00Z", ended_at: "2026-11-26T15:10:00Z", duration: "2000", status: "completed" }, // crosses JST midnight
            { started_at: "2026-11-26T14:00:00Z", ended_at: "2026-11-26T14:20:00Z", duration: 4000, status: "completed" }, // 23:00 JST on the 26th
            { started_at: "2026-11-27T01:00:00Z", ended_at: null, duration: 8000, status: "active" },
            { started_at: "2026-11-27T02:00:00Z", ended_at: null, duration: 16000, status: "abandoned" },
        ];
        expect( todayFocusMs( records, "2026-11-27", TZ ) ).toBe( 1000 + 2000 + 8000 );
    } );

} );

const ctx = ( extra: Partial<ScheduleContext> = {} ): ScheduleContext => ( {
    todayKey: "2026-11-27",
    todayIsWorkDay: true,
    remainingMs: 10 * 60_000,
    nextWorkDay: "2026-11-30",
    goalKey: "2026-12-31",
    ...extra,
} );

describe( "resolveScheduledFor", () => {

    it( "follows the user's choice over the model", () => {
        expect( resolveScheduledFor( "next_work_day", "today", ctx() ) ).toEqual( { when: "next_work_day", key: "2026-11-30" } );
        expect( resolveScheduledFor( "continue_now", "next_work_day", ctx() ) ).toEqual( { when: "today", key: "2026-11-27" } );
    } );

    it( "uses the model's when for unsure / tree saves", () => {
        expect( resolveScheduledFor( "unsure", "next_work_day", ctx() ).key ).toBe( "2026-11-30" );
        expect( resolveScheduledFor( null, "today", ctx() ).key ).toBe( "2026-11-27" );
    } );

    it( "falls back to the default rule for an unknown when", () => {
        expect( resolveScheduledFor( "unsure", "tomorrow", ctx() ).when ).toBe( "today" );
        expect( resolveScheduledFor( "unsure", "", ctx( { remainingMs: 0 } ) ).when ).toBe( "next_work_day" );
        expect( resolveScheduledFor( null, undefined, ctx( { todayIsWorkDay: false } ) ).when ).toBe( "next_work_day" );
    } );

    it( "uses today when no work day is left before the goal", () => {
        expect( resolveScheduledFor( "next_work_day", null, ctx( { nextWorkDay: null } ) ) ).toEqual( { when: "today", key: "2026-11-27" } );
    } );

    it( "defaultWhen: no daily goal means time is left", () => {
        expect( defaultWhen( ctx( { remainingMs: null } ) ) ).toBe( "today" );
    } );

} );

describe( "isPickableDay", () => {

    it( "allows today up to the goal date", () => {
        expect( isPickableDay( "2026-11-27", "2026-11-27", "2026-12-01" ) ).toBe( true );
        expect( isPickableDay( "2026-11-26", "2026-11-27", "2026-12-01" ) ).toBe( false );
        expect( isPickableDay( "2026-12-02", "2026-11-27", "2026-12-01" ) ).toBe( false );
        expect( isPickableDay( "2026/12/01", "2026-11-27", null ) ).toBe( false );
    } );

    it( "doesn't cap at a goal date in the past", () => {
        expect( isPickableDay( "2026-12-02", "2026-11-27", "2026-11-01" ) ).toBe( true );
    } );

} );
