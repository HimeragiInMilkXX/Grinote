import { describe, expect, it } from "vitest";
import { applyTimerEvent, createTimer, legacyTimer, recordStatusFor, TimerRuleError } from "./machine";
import { summarizeTimer } from "./summary";
import { timerView } from "./view";
import type { TimerEvent, TimerState } from "./types";

const MIN = 60_000;
const T0 = Date.UTC( 2026, 10, 25, 1, 0, 0 );
const at = ( min: number, sec = 0 ) => T0 + min * MIN + sec * 1000;

/** Applies [minute, event] steps in order. */
function run( s: TimerState, steps: Array<[ number, TimerEvent ]>, grace = 10_000 ) {
    return steps.reduce( ( acc, [ m, e ] ) => applyTimerEvent( acc, e, at( m ), { overrunGraceMs: grace } ), s );
}

const expectRule = ( fn: () => unknown, code: string ) => {
    try { fn(); }
    catch( e ) {
        expect( e ).toBeInstanceOf( TimerRuleError );
        expect( ( e as TimerRuleError ).code ).toBe( code );
        return;
    }
    throw new Error( `expected TimerRuleError ${code}` );
};

describe( "pomodoro", () => {

    it( "closes the session exactly at 25:00 however late it is reported, the wait counts as break", () => {
        let s = createTimer( "pomodoro", null, at( 0 ) );
        s = run( s, [ [ 40, { type: "session_due" } ] ] );
        expect( s.phase ).toBe( "awaiting" );
        expect( s.totals.workMs ).toBe( 25 * MIN );
        expect( s.awaitingKind ).toBe( "short" );
        s = run( s, [ [ 41, { type: "accept_break" } ] ] );
        expect( s.breakEndsAt ).toBe( at( 46 ) ); // full 5 min from the answer
        s = run( s, [ [ 46, { type: "end_break" } ], [ 47, { type: "close" } ] ] );
        const sum = summarizeTimer( s );
        expect( sum.focusMs ).toBe( 26 * MIN );
        expect( sum.breakMs ).toBe( 21 * MIN ); // 25 → 46
        expect( sum.sessions ).toBe( 2 );
        expect( sum.completedSessions ).toBe( 1 );
        expect( sum.scheduledBreaks ).toBe( 1 );
    });

    it( "rejects an early session_due", () => {
        const s = createTimer( "pomodoro", null, at( 0 ) );
        expectRule( () => applyTimerEvent( s, { type: "session_due" }, at( 20 ) ), "not_due" );
        expect( applyTimerEvent( s, { type: "session_due" }, at( 24, 59 ) ).phase ).toBe( "awaiting" ); // within tolerance
    });

    it( "offers a long break after 4 completed sessions, skipped breaks still count", () => {
        let s = createTimer( "pomodoro", null, at( 0 ) );
        s = run( s, [
            [ 25, { type: "session_due" } ], [ 25, { type: "skip_break" } ],
            [ 50, { type: "session_due" } ], [ 50, { type: "skip_break" } ],
            [ 75, { type: "session_due" } ], [ 75, { type: "skip_break" } ],
            [ 100, { type: "session_due" } ],
        ] );
        expect( s.awaitingKind ).toBe( "long" );
        s = run( s, [ [ 100, { type: "accept_break" } ], [ 115, { type: "end_break" } ] ] );
        expect( s.pomodoroCycle ).toBe( 0 );
        expect( summarizeTimer( s ).breaks ).toBe( 1 ); // skipped offers aren't breaks
    });

    it( "a mid-session break voids the session for the long-break cycle and restarts a full 25", () => {
        let s = createTimer( "pomodoro", null, at( 0 ) );
        s = run( s, [ [ 10, { type: "take_break" } ], [ 15, { type: "end_break" } ] ] );
        expect( s.pomodoroCycle ).toBe( 0 );
        expect( s.sessionTargetMs ).toBe( 25 * MIN );
        expect( s.totals.sessions ).toBe( 1 );
        expect( s.totals.completedSessions ).toBe( 0 );
        expect( s.totals.customBreaks ).toBe( 1 );
    });

    it( "a skipped wait goes into break time but not the break count", () => {
        let s = createTimer( "pomodoro", null, at( 0 ) );
        s = run( s, [ [ 25, { type: "session_due" } ], [ 27, { type: "skip_break" } ], [ 30, { type: "close" } ] ] );
        const sum = summarizeTimer( s );
        expect( sum.breakMs ).toBe( 2 * MIN );
        expect( sum.breaks ).toBe( 0 );
        expect( sum.focusMs ).toBe( 28 * MIN );
    });

});

describe( "pause", () => {

    it( "freezes the countdown, keeps the session and counts in neither focus nor break", () => {
        let s = createTimer( "pomodoro", null, at( 0 ) );
        s = run( s, [ [ 10, { type: "pause", reason: "  電話  " } ] ] );
        expect( recordStatusFor( s ) ).toBe( "paused" );
        expect( timerView( s, at( 30 ) ).clockMs ).toBe( 15 * MIN );
        s = run( s, [ [ 30, { type: "resume" } ] ] );
        expect( timerView( s, at( 35 ) ).clockMs ).toBe( 10 * MIN );
        expectRule( () => applyTimerEvent( s, { type: "session_due" }, at( 40 ) ), "not_due" );
        s = run( s, [ [ 45, { type: "session_due" } ], [ 45, { type: "close" } ] ] );
        const sum = summarizeTimer( s );
        expect( sum.focusMs ).toBe( 25 * MIN );
        expect( sum.sessions ).toBe( 1 );
        expect( sum.completedSessions ).toBe( 1 );
        expect( sum.pauses ).toBe( 1 );
        expect( sum.pauseMs ).toBe( 20 * MIN );
        expect( sum.pauseReasons ).toEqual( [ "電話" ] );
        expect( sum.totalMs ).toBe( 25 * MIN );
    });

    it( "can't change the timer while paused", () => {
        const s = run( createTimer( "flowtime", null, at( 0 ) ), [ [ 5, { type: "pause" } ] ] );
        expectRule( () => applyTimerEvent( s, { type: "change_mode", mode: "deep" }, at( 6 ) ), "wrong_phase" );
    });

});

describe( "50/10", () => {

    it( "resumes the remaining focus after a mid-session break", () => {
        let s = createTimer( "deep", null, at( 0 ) );
        s = run( s, [ [ 30, { type: "take_break" } ], [ 35, { type: "end_break" } ] ] );
        expect( s.sessionTargetMs ).toBe( 20 * MIN );
        s = run( s, [ [ 55, { type: "session_due" } ] ] );
        expect( s.awaitingKind ).toBe( "deep" );
        s = run( s, [ [ 55, { type: "accept_break" } ], [ 65, { type: "end_break" } ] ] );
        expect( s.sessionTargetMs ).toBe( 50 * MIN );
    });

});

describe( "scheduled break overrun", () => {

    const inBreak = () => run( createTimer( "deep", null, at( 0 ) ), [ [ 50, { type: "session_due" } ], [ 50, { type: "accept_break" } ] ] );

    it( "within the grace, the next session starts at the scheduled end", () => {
        const s = applyTimerEvent( inBreak(), { type: "end_break" }, at( 60, 8 ), { overrunGraceMs: 10_000 } );
        expect( s.phaseStartedAt ).toBe( at( 60 ) );
        expect( s.totals.breakMs ).toBe( 10 * MIN );
    });

    it( "beyond the grace, the whole overrun counts as break", () => {
        const s = applyTimerEvent( inBreak(), { type: "end_break" }, at( 60, 30 ), { overrunGraceMs: 10_000 } );
        expect( s.phaseStartedAt ).toBe( at( 60, 30 ) );
        expect( s.totals.breakMs ).toBe( 10 * MIN + 30_000 );
    });

});

describe( "10-min starter", () => {

    it( "counts up after 10 min and switches for free, keeping the session", () => {
        let s = createTimer( "starter", null, at( 0 ) );
        expect( timerView( s, at( 4 ) ) ).toMatchObject( { clockMs: 6 * MIN, direction: "down", starterCheck: false } );
        expect( timerView( s, at( 12 ) ) ).toMatchObject( { clockMs: 12 * MIN, direction: "up", starterCheck: true } );
        expectRule( () => applyTimerEvent( s, { type: "starter_switch", mode: "flowtime" }, at( 5 ) ), "starter_not_reached" );
        s = run( s, [ [ 12, { type: "starter_switch", mode: "flowtime" } ] ] );
        expect( s.mode ).toBe( "flowtime" );
        expect( s.changesUsed ).toBe( 0 );
        expect( timerView( s, at( 20 ) ).clockMs ).toBe( 20 * MIN );
        s = run( s, [ [ 20, { type: "close" } ] ] );
        expect( summarizeTimer( s ).sessions ).toBe( 1 );
        expect( s.modeHistory.map( m => m.mode ) ).toEqual( [ "starter", "flowtime" ] );
    });

    it( "switching to a countdown starts its countdown at the switch", () => {
        const s = run( createTimer( "starter", null, at( 0 ) ), [ [ 11, { type: "starter_switch", mode: "pomodoro" } ] ] );
        expect( timerView( s, at( 11 ) ).clockMs ).toBe( 25 * MIN );
        expect( run( s, [ [ 36, { type: "session_due" } ] ] ).totals.workMs ).toBe( 36 * MIN );
    });

    it( "resumes the rest of the 10 minutes after an early break, needs a switch after them", () => {
        let s = createTimer( "starter", null, at( 0 ) );
        s = run( s, [ [ 4, { type: "take_break" } ], [ 6, { type: "end_break" } ] ] );
        expect( s.sessionTargetMs ).toBe( 6 * MIN );
        s = run( s, [ [ 14, { type: "take_break" } ] ] );
        expectRule( () => applyTimerEvent( s, { type: "end_break" }, at( 15 ) ), "starter_needs_switch" );
        s = run( s, [ [ 15, { type: "change_mode", mode: "deep" } ], [ 16, { type: "end_break" } ] ] );
        expect( s.changesUsed ).toBe( 0 ); // leaving the starter is free
        expect( s.mode ).toBe( "deep" );
    });

});

describe( "flowtime", () => {

    it( "suggests a break at the chosen interval, snoozes, and restarts from 0 after a break", () => {
        let s = createTimer( "flowtime", { flowSuggestMin: 25 }, at( 0 ) );
        expect( timerView( s, at( 24 ) ).suggestBreak ).toBe( false );
        expect( timerView( s, at( 25 ) ).suggestBreak ).toBe( true );
        s = run( s, [ [ 26, { type: "snooze_suggestion" } ] ] );
        expect( timerView( s, at( 30 ) ).suggestBreak ).toBe( false );
        expect( timerView( s, at( 51 ) ).suggestBreak ).toBe( true );
        s = run( s, [ [ 51, { type: "take_suggested_break" } ] ] );
        expect( s.breakEndsAt ).toBe( at( 61 ) );
        s = run( s, [ [ 61, { type: "end_break" } ] ] );
        expect( timerView( s, at( 62 ) ).clockMs ).toBe( MIN );
    });

    it( "falls back to the 50-min default for an invalid interval", () => {
        expect( createTimer( "flowtime", { flowSuggestMin: 1 }, at( 0 ) ).config.flowSuggestMin ).toBe( 50 );
    });

});

describe( "timer changes", () => {

    it( "only in a break; 3 free changes, then every change resets all stats", () => {
        let s = createTimer( "flowtime", null, at( 0 ) );
        expectRule( () => applyTimerEvent( s, { type: "change_mode", mode: "deep" }, at( 1 ) ), "wrong_phase" );
        s = run( s, [ [ 10, { type: "take_break" } ] ] );
        s = run( s, [ [ 11, { type: "change_mode", mode: "deep" } ], [ 12, { type: "change_mode", mode: "pomodoro" } ], [ 13, { type: "change_mode", mode: "flowtime" } ] ] );
        expect( s.changesUsed ).toBe( 3 );
        expect( s.totals.workMs ).toBe( 10 * MIN );
        s = run( s, [ [ 14, { type: "change_mode", mode: "deep" } ] ] );
        expect( s.resets ).toBe( 1 );
        expect( s.totals.workMs ).toBe( 0 );
        expect( s.totals.sessions ).toBe( 0 );
        s = run( s, [ [ 15, { type: "end_break" } ], [ 20, { type: "close" } ] ] );
        const sum = summarizeTimer( s );
        expect( sum.focusMs ).toBe( 5 * MIN );
        expect( sum.breakMs ).toBe( MIN );
        expect( sum.modes.map( m => m.mode ) ).toEqual( [ "flowtime", "deep", "pomodoro", "flowtime", "deep" ] );
        expect( sum.modes[ 4 ].reset ).toBe( true );
    });

    it( "not while the break offer is pending, and not to the same timer", () => {
        const s = run( createTimer( "pomodoro", null, at( 0 ) ), [ [ 25, { type: "session_due" } ] ] );
        expectRule( () => applyTimerEvent( s, { type: "change_mode", mode: "deep" }, at( 26 ) ), "wrong_phase" );
        const b = run( s, [ [ 26, { type: "accept_break" } ] ] );
        expectRule( () => applyTimerEvent( b, { type: "change_mode", mode: "pomodoro" }, at( 27 ) ), "same_mode" );
    });

});

describe( "close / reopen / legacy", () => {

    it( "closes from any phase and reopens as a pause that starts a new session", () => {
        let s = run( createTimer( "flowtime", null, at( 0 ) ), [ [ 30, { type: "close" } ] ] );
        expect( s.phase ).toBe( "ended" );
        s = run( s, [ [ 40, { type: "reopen" } ], [ 45, { type: "resume" } ], [ 55, { type: "close" } ] ] );
        const sum = summarizeTimer( s );
        expect( sum.focusMs ).toBe( 40 * MIN );
        expect( sum.sessions ).toBe( 2 );
        expect( sum.pauses ).toBe( 1 );
        expect( sum.totalMs ).toBe( 40 * MIN ); // report time isn't counted
    });

    it( "wraps a pre-4.5 open record as a flowtime session", () => {
        const s = legacyTimer( 12 * MIN, true, at( 20 ), at( 25 ) );
        expect( timerView( s, at( 25 ) ).clockMs ).toBe( 17 * MIN );
        const p = legacyTimer( 12 * MIN, false, at( 20 ), at( 25 ) );
        expect( p.phase ).toBe( "paused" );
        expect( summarizeTimer( run( p, [ [ 26, { type: "close" } ] ] ) ).focusMs ).toBe( 12 * MIN );
    });

});
