import { describe, expect, it } from "vitest";
import { computeJourneyStats, toJourneyEntry } from "./history";

describe( "computeJourneyStats", () => {

    it( "sums work time and computes streaks on the Tokyo day", () => {
        const entries = [
            // Mon 2026-11-23 09:00 JST and Fri 2026-11-20 23:30 JST (= 14:30 UTC)
            { durationMs: 30 * 60000, completedAt: "2026-11-23T00:00:00Z" },
            { durationMs: 15 * 60000, completedAt: "2026-11-20T14:30:00Z" },
        ];
        const stats = computeJourneyStats( entries, { created_at: "2026-11-01T00:00:00Z", work_days: [ 1, 2, 3, 4, 5 ] }, new Date( "2026-11-23T05:00:00Z" ) );
        expect( stats.totalWorkMs ).toBe( 45 * 60000 );
        expect( stats.completedTasks ).toBe( 2 );
        expect( stats.currentStreak ).toBe( 2 );
        expect( stats.longestStreak ).toBe( 2 );
        expect( stats.startedAt ).toBe( "2026-11-01T00:00:00Z" );
    });

    it( "is all zero without entries", () => {
        const stats = computeJourneyStats( [], { created_at: "2026-11-01T00:00:00Z", work_days: [] } );
        expect( stats ).toMatchObject( { totalWorkMs: 0, completedTasks: 0, currentStreak: 0, longestStreak: 0 } );
    });

});

describe( "toJourneyEntry", () => {

    it( "falls back to the node and xp_change for records before 4.0", () => {
        const e = toJourneyEntry( {
            id: 1, node_id: "n", started_at: "s", completed_at: null, updated_at: "u", duration: "60000", xp_change: 12,
            reward_breakdown: null, nodes: { task_name: "旧タスク", description: null, time_limit: "00:30:00" }, task_journals: [],
        } );
        expect( e ).toMatchObject( { taskName: "旧タスク", completedAt: "u", durationMs: 60000, actualMinutes: 1, estimatedMinutes: 30, xp: 12, journal: null } );
    });

});

describe( "timer summaries (4.5)", () => {

    it( "summarizes a stored timer and adds sessions / break time to the stats", async () => {
        const { createTimer, applyTimerEvent } = await import( "@/lib/timer/machine" );
        const t0 = Date.UTC( 2026, 10, 25 );
        let timer = createTimer( "pomodoro", null, t0 );
        timer = applyTimerEvent( timer, { type: "session_due" }, t0 + 25 * 60000 );
        timer = applyTimerEvent( timer, { type: "accept_break" }, t0 + 25 * 60000 );
        timer = applyTimerEvent( timer, { type: "end_break" }, t0 + 30 * 60000 );
        timer = applyTimerEvent( timer, { type: "close" }, t0 + 40 * 60000 );

        const e = toJourneyEntry( {
            id: 2, node_id: "n", started_at: "2026-11-25T00:00:00Z", completed_at: "2026-11-25T00:40:00Z", updated_at: "2026-11-25T00:40:00Z",
            duration: String( 35 * 60000 ), xp_change: 10, reward_breakdown: null, timer, nodes: null, task_journals: [],
        } );
        expect( e.timer ).toMatchObject( { focusMs: 35 * 60000, breakMs: 5 * 60000, sessions: 2, breaks: 1 } );
        expect( e.timer?.modes.map( m => m.mode ) ).toEqual( [ "pomodoro" ] );

        const stats = computeJourneyStats( [ e, { durationMs: 60000, completedAt: "2026-11-24T00:00:00Z" } ], { created_at: "2026-11-01T00:00:00Z", work_days: [] } );
        expect( stats.totalSessions ).toBe( 2 );
        expect( stats.totalBreakMs ).toBe( 5 * 60000 );
    });

    it( "is null for records before 4.5", () => {
        const e = toJourneyEntry( { id: 3, node_id: "n", started_at: "x", completed_at: null, updated_at: "2026-11-25T00:00:00Z", duration: 0, xp_change: 0, reward_breakdown: null, nodes: null, task_journals: [] } );
        expect( e.timer ).toBeNull();
    });

});
