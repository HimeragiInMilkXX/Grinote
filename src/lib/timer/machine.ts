/**
 * Work timer state machine (MVP 4.5). Pure: the server calls `applyTimerEvent` with its own clock,
 * the client only reads the state (./view.ts). Rules are in CLAUDE.md "Work timer".
 */

import { FREE_TIMER_CHANGES, normalizeTimerConfig, TIMER_CONFIG } from "./config";
import type { BreakSource, TimerConfig, TimerEvent, TimerMode, TimerSegment, TimerState, TimerTotals } from "./types";
import { TIMER_MODES } from "./types";

export class TimerRuleError extends Error {
    constructor( public code: string, message: string ) {
        super( message );
        this.name = "TimerRuleError";
    }
}

export interface ApplyOptions {
    /** scheduled break overrun (ms) that still counts as on time (server config) */
    overrunGraceMs?: number;
}

const emptyTotals = (): TimerTotals => ( {
    workMs: 0, breakMs: 0, gapMs: 0, pauseMs: 0,
    sessions: 0, completedSessions: 0, scheduledBreaks: 0, customBreaks: 0, pauses: 0,
} );

export const isTimerMode = ( v: unknown ): v is TimerMode => typeof v === "string" && ( TIMER_MODES as readonly string[] ).includes( v );

/** Countdown length of a new session in `mode`, null = count-up. */
function sessionTarget( s: TimerState ): number | null {
    switch( s.mode ) {
        case "pomodoro": return TIMER_CONFIG.pomodoro.workMs;
        case "deep": return s.deepRemainingMs ?? TIMER_CONFIG.deep.workMs;
        case "starter": return s.starterRemainingMs;
        case "flowtime": return null;
    }
}

const resetModeProgress = ( s: TimerState ) => {
    s.pomodoroCycle = 0;
    s.deepRemainingMs = null;
    s.starterRemainingMs = TIMER_CONFIG.starter.workMs;
};

export function createTimer( mode: TimerMode, config: TimerConfig | null | undefined, now: number ): TimerState {

    if( !isTimerMode( mode ) ) throw new TimerRuleError( "invalid_mode", "不明なタイマーです" );

    const cfg = normalizeTimerConfig( mode, config );

    const s: TimerState = {
        v: 1,
        mode,
        config: cfg,
        phase: "work",
        phaseStartedAt: now,
        sessionOpen: false,
        sessionWorkMs: 0,
        sessionTargetMs: null,
        suggestionSnoozedAtMs: 0,
        breakSource: null,
        breakEndsAt: null,
        awaitingKind: null,
        pauseReason: null,
        pomodoroCycle: 0,
        deepRemainingMs: null,
        starterRemainingMs: TIMER_CONFIG.starter.workMs,
        changesUsed: 0,
        resets: 0,
        totals: emptyTotals(),
        segments: [],
        modeHistory: [ { mode, config: cfg, at: now, free: true } ],
    };

    startSession( s, now );
    return s;

}

/**
 * Wraps a record that was open before 4.5 (no timer) as a flowtime session holding its time.
 * `anchor` is the old running anchor (records.updated_at).
 */
export function legacyTimer( durationMs: number, running: boolean, anchor: number, now: number ): TimerState {

    const s = createTimer( "flowtime", null, Math.min( anchor, now ) );
    s.sessionWorkMs = Math.max( 0, Math.round( durationMs ) || 0 );
    s.totals.workMs = s.sessionWorkMs;
    if( s.sessionWorkMs > 0 ) s.segments.push( { kind: "work", mode: "flowtime", start: Math.min( anchor, now ) - s.sessionWorkMs, end: Math.min( anchor, now ), ms: s.sessionWorkMs } );
    if( !running ) {
        s.phase = "paused";
        s.totals.pauses += 1;
    }
    return s;

}

// ---------- helpers ----------

function pushSegment( s: TimerState, seg: Omit<TimerSegment, "ms" | "mode"> & { mode?: TimerMode } ) {
    const ms = Math.max( 0, seg.end - seg.start );
    s.segments.push( { ...seg, mode: seg.mode ?? s.mode, ms } );
    return ms;
}

/** Banks the running work stretch (session stays open). */
function closeWorkStretch( s: TimerState, end: number ) {
    if( s.phase !== "work" ) return;
    const ms = pushSegment( s, { kind: "work", start: s.phaseStartedAt, end } );
    s.sessionWorkMs += ms;
    s.totals.workMs += ms;
}

function startSession( s: TimerState, at: number ) {
    s.phase = "work";
    s.phaseStartedAt = at;
    s.sessionOpen = true;
    s.sessionWorkMs = 0;
    s.sessionTargetMs = sessionTarget( s );
    s.suggestionSnoozedAtMs = 0;
    s.breakSource = null;
    s.breakEndsAt = null;
    s.awaitingKind = null;
    s.pauseReason = null;
}

/** Ends the open session (after its stretch was banked). Empty sessions aren't counted. */
function endSession( s: TimerState, completed: boolean ) {
    if( !s.sessionOpen ) return;
    if( s.sessionWorkMs > 0 ) {
        s.totals.sessions += 1;
        if( completed ) s.totals.completedSessions += 1;
    }
    // carry unfinished countdowns over a break
    if( !completed && s.sessionTargetMs != null ) {
        const left = Math.max( 0, s.sessionTargetMs - s.sessionWorkMs );
        if( s.mode === "deep" ) s.deepRemainingMs = left > 0 ? left : null;
        if( s.mode === "starter" ) s.starterRemainingMs = left;
    }
    if( completed && s.mode === "starter" ) s.starterRemainingMs = 0;
    s.sessionOpen = false;
    s.sessionWorkMs = 0;
    s.sessionTargetMs = null;
}

function startBreak( s: TimerState, source: BreakSource, at: number, now: number ) {
    s.phase = "break";
    s.phaseStartedAt = at;
    s.breakSource = source;
    s.awaitingKind = null;
    const planned = scheduledBreakMs( source );
    s.breakEndsAt = planned == null ? null : now + planned;
    if( planned == null ) s.totals.customBreaks += 1;
    else s.totals.scheduledBreaks += 1;
}

export function scheduledBreakMs( source: BreakSource | null ): number | null {
    switch( source ) {
        case "short": return TIMER_CONFIG.pomodoro.shortBreakMs;
        case "long": return TIMER_CONFIG.pomodoro.longBreakMs;
        case "deep": return TIMER_CONFIG.deep.breakMs;
        case "suggested": return TIMER_CONFIG.flowtime.breakMs;
        default: return null;
    }
}

/** Focus of the open session including the running stretch. */
export function sessionFocusMs( s: TimerState, now: number ) {
    return s.sessionWorkMs + ( s.phase === "work" ? Math.max( 0, now - s.phaseStartedAt ) : 0 );
}

/** The starter's 10 minutes are done (live). */
export function starterReached( s: TimerState, now: number ) {
    if( s.mode !== "starter" ) return false;
    if( !s.sessionOpen ) return s.starterRemainingMs <= 0;
    return s.sessionTargetMs != null && sessionFocusMs( s, now ) >= s.sessionTargetMs;
}

const fail = ( code: string, message: string ): never => { throw new TimerRuleError( code, message ); };

const requirePhase = ( s: TimerState, ...phases: TimerState[ "phase" ][] ) => {
    if( !phases.includes( s.phase ) ) fail( "wrong_phase", "今の状態ではこの操作はできません" );
};

const cleanReason = ( reason: string | null | undefined ) => {
    const t = ( reason ?? "" ).replace( /\s+/g, " " ).trim().slice( 0, TIMER_CONFIG.pauseReasonMaxLength );
    return t || null;
};

/** Switches the mode (session data kept by the caller). Returns whether it was free. */
function switchMode( s: TimerState, mode: TimerMode, config: TimerConfig | undefined, now: number, forceFree: boolean ) {

    if( !isTimerMode( mode ) ) fail( "invalid_mode", "不明なタイマーです" );

    const cfg = normalizeTimerConfig( mode, config );
    if( mode === s.mode && JSON.stringify( cfg ) === JSON.stringify( s.config ) ) fail( "same_mode", "同じタイマーです" );

    // leaving the 10-min starter is free: it's meant to hand over to another timer
    const free = forceFree || s.mode === "starter";
    let reset = false;

    if( !free ) {
        s.changesUsed += 1;
        reset = s.changesUsed > FREE_TIMER_CHANGES;
    }

    s.mode = mode;
    s.config = cfg;
    resetModeProgress( s );
    s.modeHistory.push( { mode, config: cfg, at: now, ...( free ? { free: true } : {} ), ...( reset ? { reset: true } : {} ) } );

    return { free, reset };

}

// ---------- events ----------

export function applyTimerEvent( prev: TimerState, event: TimerEvent, now: number, opts: ApplyOptions = {} ): TimerState {

    const s: TimerState = structuredClone( prev );
    const grace = Math.max( 0, opts.overrunGraceMs ?? 10_000 );

    switch( event.type ) {

        case "pause": {
            requirePhase( s, "work" );
            closeWorkStretch( s, now );
            s.phase = "paused";
            s.phaseStartedAt = now;
            s.pauseReason = cleanReason( event.reason );
            s.totals.pauses += 1;
            return s;
        }

        case "resume": {
            requirePhase( s, "paused" );
            const ms = pushSegment( s, { kind: "pause", start: s.phaseStartedAt, end: now, ...( s.pauseReason ? { reason: s.pauseReason } : {} ) } );
            s.totals.pauseMs += ms;
            s.pauseReason = null;
            if( s.sessionOpen ) {
                s.phase = "work";
                s.phaseStartedAt = now;
            } else {
                // back from the task report: a new session
                if( s.mode === "starter" && s.starterRemainingMs <= 0 ) fail( "starter_needs_switch", "10分スターターを続けるには、別のタイマーに切り替えてください" );
                startSession( s, now );
            }
            return s;
        }

        case "take_break":
        case "take_suggested_break": {
            requirePhase( s, "work" );
            if( event.type === "take_suggested_break" && s.mode !== "flowtime" ) fail( "wrong_mode", "フロータイムだけの操作です" );
            closeWorkStretch( s, now );
            endSession( s, false );
            startBreak( s, event.type === "take_break" ? "custom" : "suggested", now, now );
            return s;
        }

        case "snooze_suggestion": {
            requirePhase( s, "work" );
            if( s.mode !== "flowtime" ) fail( "wrong_mode", "フロータイムだけの操作です" );
            s.suggestionSnoozedAtMs = sessionFocusMs( s, now );
            return s;
        }

        case "end_break": {
            requirePhase( s, "break" );
            if( s.mode === "starter" && s.starterRemainingMs <= 0 ) fail( "starter_needs_switch", "10分スターターを続けるには、別のタイマーに切り替えてください" );
            // a scheduled break that ran over by at most `grace` ends on time
            const end = s.breakEndsAt != null && now > s.breakEndsAt && now - s.breakEndsAt <= grace ? s.breakEndsAt : now;
            const ms = pushSegment( s, { kind: "break", start: s.phaseStartedAt, end, source: s.breakSource ?? "custom" } );
            s.totals.breakMs += ms;
            if( s.breakSource === "long" ) s.pomodoroCycle = 0;
            startSession( s, end );
            return s;
        }

        case "session_due": {
            requirePhase( s, "work" );
            if( s.mode !== "pomodoro" && s.mode !== "deep" ) fail( "wrong_mode", "このタイマーにはカウントダウンの終わりがありません" );
            if( s.sessionTargetMs == null ) fail( "wrong_mode", "カウントダウン中ではありません" );
            const dueAt = s.phaseStartedAt + ( s.sessionTargetMs! - s.sessionWorkMs );
            if( dueAt - now > TIMER_CONFIG.dueToleranceMs ) fail( "not_due", "まだセッションの途中です" );
            // close exactly at the scheduled end, however late the client reports it
            closeWorkStretch( s, dueAt );
            if( s.mode === "pomodoro" ) {
                s.pomodoroCycle += 1;
                s.awaitingKind = s.pomodoroCycle % TIMER_CONFIG.pomodoro.longBreakEvery === 0 ? "long" : "short";
            }
            else {
                s.awaitingKind = "deep";
            }
            endSession( s, true );
            s.deepRemainingMs = null;
            s.phase = "awaiting";
            s.phaseStartedAt = dueAt;
            return s;
        }

        case "accept_break": {
            requirePhase( s, "awaiting" );
            // the wait at the offer is part of this break; the countdown starts now
            startBreak( s, s.awaitingKind ?? "short", s.phaseStartedAt, now );
            return s;
        }

        case "skip_break": {
            requirePhase( s, "awaiting" );
            const ms = pushSegment( s, { kind: "gap", start: s.phaseStartedAt, end: Math.max( now, s.phaseStartedAt ) } );
            s.totals.gapMs += ms;
            startSession( s, Math.max( now, s.phaseStartedAt ) );
            return s;
        }

        case "starter_switch": {
            if( s.mode !== "starter" ) fail( "wrong_mode", "10分スターターだけの操作です" );
            if( s.phase === "break" ) {
                switchMode( s, event.mode, event.config, now, true );
                return s;
            }
            requirePhase( s, "work", "paused" );
            if( !starterReached( s, now ) ) fail( "starter_not_reached", "10分たつまで切り替えられません" );
            closeWorkStretch( s, now );
            const wasPaused = s.phase === "paused";
            switchMode( s, event.mode, event.config, now, true );
            if( s.sessionOpen ) {
                // the same session goes on in the new timer; a countdown starts now
                const target = sessionTarget( s );
                s.sessionTargetMs = target == null ? null : s.sessionWorkMs + target;
                s.suggestionSnoozedAtMs = s.mode === "flowtime" ? 0 : s.suggestionSnoozedAtMs;
            }
            if( !wasPaused ) {
                s.phase = "work";
                s.phaseStartedAt = now;
            }
            return s;
        }

        case "change_mode": {
            requirePhase( s, "break" );
            const { reset } = switchMode( s, event.mode, event.config, now, false );
            if( reset ) {
                s.resets += 1;
                s.totals = emptyTotals();
                s.segments = [];
                // the break goes on, counted from now
                s.phaseStartedAt = now;
                if( s.breakSource === "custom" ) s.totals.customBreaks = 1;
                else if( s.breakSource ) s.totals.scheduledBreaks = 1;
            }
            return s;
        }

        case "close": {
            switch( s.phase ) {
                case "work":
                    closeWorkStretch( s, now );
                    endSession( s, false );
                    break;
                case "paused": {
                    s.totals.pauseMs += pushSegment( s, { kind: "pause", start: s.phaseStartedAt, end: now, ...( s.pauseReason ? { reason: s.pauseReason } : {} ) } );
                    endSession( s, false );
                    break;
                }
                case "break":
                    s.totals.breakMs += pushSegment( s, { kind: "break", start: s.phaseStartedAt, end: now, source: s.breakSource ?? "custom" } );
                    break;
                case "awaiting":
                    s.totals.gapMs += pushSegment( s, { kind: "gap", start: s.phaseStartedAt, end: Math.max( now, s.phaseStartedAt ) } );
                    break;
                case "ended":
                    return s;
            }
            s.phase = "ended";
            s.phaseStartedAt = now;
            s.breakSource = null;
            s.breakEndsAt = null;
            s.awaitingKind = null;
            s.pauseReason = null;
            return s;
        }

        case "reopen": {
            requirePhase( s, "ended" );
            s.phase = "paused";
            s.phaseStartedAt = now;
            s.pauseReason = "レポートから作業に戻る";
            s.totals.pauses += 1;
            return s;
        }

    }

    return fail( "unknown_event", "不明な操作です" );

}

/** Records.status for a timer phase (pause and break both look "paused" to the rest of the app). */
export const recordStatusFor = ( s: TimerState ): "active" | "paused" => s.phase === "work" ? "active" : "paused";

/** Loose runtime check for a stored timer (jsonb). */
export function asTimerState( v: unknown ): TimerState | null {
    if( !v || typeof v !== "object" ) return null;
    const t = v as Partial<TimerState>;
    if( t.v !== 1 || !isTimerMode( t.mode ) || !t.totals || !Array.isArray( t.segments ) || !Array.isArray( t.modeHistory ) ) return null;
    return t as TimerState;
}
