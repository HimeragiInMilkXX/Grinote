import { describe, expect, it } from "vitest";
import { addDaysToKey, computeCurrentStreak, computeLongestStreak, computeProjectStreak, computeTaskStreak, dateKeyInZone, isoWeekdayOfKey, startOfDayKey } from "./streaks";

// 2026-11-23 is a Monday
const MON = "2026-11-23";

describe( "day keys", () => {

    it( "formats in the given time zone", () => {
        // 2026-11-22 16:00 UTC = 2026-11-23 01:00 in Tokyo
        expect( dateKeyInZone( new Date( "2026-11-22T16:00:00Z" ), "Asia/Tokyo" ) ).toBe( "2026-11-23" );
        expect( dateKeyInZone( new Date( "2026-11-22T16:00:00Z" ), "UTC" ) ).toBe( "2026-11-22" );
    });

    it( "shifts days across months and gives ISO weekdays", () => {
        expect( addDaysToKey( "2026-12-01", -1 ) ).toBe( "2026-11-30" );
        expect( isoWeekdayOfKey( MON ) ).toBe( 1 );
        expect( isoWeekdayOfKey( "2026-11-22" ) ).toBe( 7 );
    });

    it( "finds the start of a Tokyo day", () => {
        expect( startOfDayKey( MON, "Asia/Tokyo" ).toISOString() ).toBe( "2026-11-22T15:00:00.000Z" );
    });

});

describe( "computeProjectStreak", () => {

    const weekdays = [ 1, 2, 3, 4, 5 ];

    it( "counts today alone when nothing was done before", () => {
        expect( computeProjectStreak( { completionDayKeys: [], todayKey: MON, workDays: weekdays } ) ).toBe( 1 );
    });

    it( "skips non-work days without breaking", () => {
        // Fri done, Sat/Sun off (not work days), Mon today
        expect( computeProjectStreak( { completionDayKeys: [ "2026-11-20", "2026-11-19" ], todayKey: MON, workDays: weekdays } ) ).toBe( 3 );
    });

    it( "counts work on a non-work day", () => {
        expect( computeProjectStreak( { completionDayKeys: [ "2026-11-22", "2026-11-21", "2026-11-20" ], todayKey: MON, workDays: weekdays } ) ).toBe( 4 );
    });

    it( "breaks on a missed work day", () => {
        // Thu done, Fri (work day) missed
        expect( computeProjectStreak( { completionDayKeys: [ "2026-11-19" ], todayKey: MON, workDays: weekdays } ) ).toBe( 1 );
    });

    it( "treats every day as a work day when work_days is empty", () => {
        expect( computeProjectStreak( { completionDayKeys: [ "2026-11-20" ], todayKey: MON, workDays: [] } ) ).toBe( 1 );
        expect( computeProjectStreak( { completionDayKeys: [ "2026-11-22", "2026-11-21" ], todayKey: MON, workDays: [] } ) ).toBe( 3 );
    });

    it( "does not double count today and stops at the project's first day", () => {
        expect( computeProjectStreak( { completionDayKeys: [ MON ], todayKey: MON, workDays: [] } ) ).toBe( 1 );
        // only non-work days back to creation: stops at creation instead of walking forever
        expect( computeProjectStreak( { completionDayKeys: [], todayKey: MON, workDays: [ 3 ], earliestDayKey: "2026-11-20" } ) ).toBe( 1 );
    });

});

describe( "computeTaskStreak", () => {

    it( "counts earlier completions today", () => {
        expect( computeTaskStreak( [] ) ).toBe( 0 );
        expect( computeTaskStreak( [
            { status: "completed", at: "2026-11-23T01:00:00Z" },
            { status: "completed", at: "2026-11-23T02:00:00Z" },
        ] ) ).toBe( 2 );
    });

    it( "resets after an abandoned task, regardless of input order", () => {
        expect( computeTaskStreak( [
            { status: "completed", at: "2026-11-23T04:00:00Z" },
            { status: "completed", at: "2026-11-23T01:00:00Z" },
            { status: "abandoned", at: "2026-11-23T02:00:00Z" },
            { status: "completed", at: "2026-11-23T03:00:00Z" },
        ] ) ).toBe( 2 );
        expect( computeTaskStreak( [ { status: "abandoned", at: "2026-11-23T02:00:00Z" } ] ) ).toBe( 0 );
    });

});

describe( "computeCurrentStreak", () => {

    const weekdays = [ 1, 2, 3, 4, 5 ];

    it( "does not break while today is still in progress", () => {
        // Fri + Thu done, weekend off, Mon (today) not done yet
        expect( computeCurrentStreak( { completionDayKeys: [ "2026-11-20", "2026-11-19" ], todayKey: MON, workDays: weekdays } ) ).toBe( 2 );
    });

    it( "counts today when it has a completion", () => {
        expect( computeCurrentStreak( { completionDayKeys: [ MON, "2026-11-20" ], todayKey: MON, workDays: weekdays } ) ).toBe( 2 );
    });

    it( "is 0 after a missed work day", () => {
        // Thu done, Fri missed
        expect( computeCurrentStreak( { completionDayKeys: [ "2026-11-19" ], todayKey: MON, workDays: weekdays } ) ).toBe( 0 );
        expect( computeCurrentStreak( { completionDayKeys: [], todayKey: MON, workDays: weekdays } ) ).toBe( 0 );
    });

});

describe( "computeLongestStreak", () => {

    const weekdays = [ 1, 2, 3, 4, 5 ];

    it( "is 0 without completions", () => {
        expect( computeLongestStreak( { completionDayKeys: [], todayKey: MON, workDays: weekdays } ) ).toBe( 0 );
    });

    it( "keeps the best run after a break", () => {
        // Mon-Wed of the previous week (3), Thu missed, Fri done (1), today Mon done (2)
        const keys = [ "2026-11-16", "2026-11-17", "2026-11-18", "2026-11-20", MON ];
        expect( computeLongestStreak( { completionDayKeys: keys, todayKey: MON, workDays: weekdays } ) ).toBe( 3 );
    });

    it( "skips free days and counts work done on them", () => {
        // Fri, Sat (free day, worked), Mon
        const keys = [ "2026-11-20", "2026-11-21", MON ];
        expect( computeLongestStreak( { completionDayKeys: keys, todayKey: MON, workDays: weekdays } ) ).toBe( 3 );
    });

    it( "treats every day as a work day when work_days is empty", () => {
        const keys = [ "2026-11-20", MON ];
        expect( computeLongestStreak( { completionDayKeys: keys, todayKey: MON, workDays: [] } ) ).toBe( 1 );
    });

});
