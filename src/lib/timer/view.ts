/** What the on-air screen shows for a timer at `now` (client clock corrected by the server offset). */

import { TIMER_CONFIG } from "./config";
import { scheduledBreakMs, sessionFocusMs, starterReached } from "./machine";
import type { TimerState } from "./types";

export interface TimerView {
    phase: TimerState[ "phase" ];
    /** big clock value; null = hidden (custom break) */
    clockMs: number | null;
    direction: "down" | "up" | null;
    /** focus of the open session */
    sessionFocusMs: number;
    /** countdown session reached its end (pomodoro / 50-10) → report session_due */
    sessionDue: boolean;
    /** 10-min starter done, still undecided */
    starterCheck: boolean;
    /** flowtime: suggest a break now */
    suggestBreak: boolean;
    /** scheduled break countdown finished */
    breakOver: boolean;
    /** custom break: elapsed (for the 5-min notices) */
    breakElapsedMs: number;
    /** pomodoro: completed sessions in the current cycle (0-4) */
    cycle: number;
    liveFocusMs: number;
    liveBreakMs: number;
    livePauseMs: number;
    /** sessions including the open one if it has focus */
    liveSessions: number;
    liveBreaks: number;
}

export function timerView( s: TimerState, now: number ): TimerView {

    const focus = sessionFocusMs( s, now );
    const running = Math.max( 0, now - s.phaseStartedAt );

    let clockMs: number | null = null;
    let direction: TimerView[ "direction" ] = null;

    if( s.phase === "work" || s.phase === "paused" ) {
        if( s.sessionTargetMs != null && focus < s.sessionTargetMs ) {
            clockMs = s.sessionTargetMs - focus;
            direction = "down";
        }
        else if( s.sessionTargetMs != null && s.mode === "starter" ) {
            // after the 10 minutes the starter counts up
            clockMs = focus;
            direction = "up";
        }
        else if( s.sessionTargetMs != null ) {
            clockMs = 0;
            direction = "down";
        }
        else {
            clockMs = focus;
            direction = "up";
        }
    }
    else if( s.phase === "break" && s.breakEndsAt != null ) {
        clockMs = Math.max( 0, s.breakEndsAt - now );
        direction = "down";
    }
    else if( s.phase === "awaiting" ) {
        clockMs = 0;
        direction = "down";
    }

    const flowEvery = ( s.config.flowSuggestMin ?? TIMER_CONFIG.flowtime.defaultSuggestMin ) * 60_000;

    const inBreakTime = s.phase === "break" || s.phase === "awaiting";

    return {
        phase: s.phase,
        clockMs,
        direction,
        sessionFocusMs: focus,
        sessionDue: s.phase === "work" && ( s.mode === "pomodoro" || s.mode === "deep" ) && s.sessionTargetMs != null && focus >= s.sessionTargetMs,
        starterCheck: s.phase === "work" && starterReached( s, now ),
        suggestBreak: s.phase === "work" && s.mode === "flowtime" && focus >= s.suggestionSnoozedAtMs + flowEvery && focus >= flowEvery,
        breakOver: s.phase === "break" && s.breakEndsAt != null && now >= s.breakEndsAt,
        breakElapsedMs: s.phase === "break" ? running : 0,
        cycle: s.pomodoroCycle % TIMER_CONFIG.pomodoro.longBreakEvery || ( s.pomodoroCycle > 0 && s.phase !== "work" ? TIMER_CONFIG.pomodoro.longBreakEvery : 0 ),
        liveFocusMs: s.totals.workMs + ( s.phase === "work" ? running : 0 ),
        liveBreakMs: s.totals.breakMs + s.totals.gapMs + ( inBreakTime ? running : 0 ),
        livePauseMs: s.totals.pauseMs + ( s.phase === "paused" ? running : 0 ),
        liveSessions: s.totals.sessions + ( s.sessionOpen && focus > 0 ? 1 : 0 ),
        liveBreaks: s.totals.scheduledBreaks + s.totals.customBreaks,
    };

}

/** Planned length of the current scheduled break (for a progress bar). */
export const currentBreakPlannedMs = ( s: TimerState ) => s.phase === "break" ? scheduledBreakMs( s.breakSource ) : null;
