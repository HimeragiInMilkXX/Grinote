/**
 * Work timer (MVP 4.5). The whole state machine is one JSON object stored in `records.timer`
 * and only ever changed on the server through `applyTimerEvent` (./machine.ts), with server time.
 * All timestamps are epoch milliseconds.
 */

export const TIMER_MODES = [ "pomodoro", "deep", "starter", "flowtime" ] as const;
export type TimerMode = typeof TIMER_MODES[ number ];

export interface TimerConfig {
    /** Flowtime only: suggest a break after this many minutes of continuous focus. */
    flowSuggestMin?: number;
}

/**
 * - work: a focus session is running
 * - paused: "something came up" (not a break, not counted in focus/break/total)
 * - break: a scheduled (countdown) or custom (open-ended) break
 * - awaiting: a countdown session ended, waiting for 休憩する / スキップ (the wait counts as break time)
 * - ended: 完成 or 諦める
 */
export type TimerPhase = "work" | "paused" | "break" | "awaiting" | "ended";

/** custom = 休憩する (open-ended). The others are scheduled countdown breaks. */
export type BreakSource = "custom" | "short" | "long" | "deep" | "suggested";

export interface TimerSegment {
    /** gap = waiting at the break offer and then skipping it (break time, not a break) */
    kind: "work" | "break" | "gap" | "pause";
    mode: TimerMode;
    start: number;
    end: number;
    ms: number;
    source?: BreakSource;
    reason?: string;
}

export interface TimerModeChange {
    mode: TimerMode;
    config: TimerConfig;
    at: number;
    /** didn't use one of the free changes (first pick, or leaving the 10-min starter) */
    free?: boolean;
    /** this change was over the free limit and reset all timer stats */
    reset?: boolean;
}

export interface TimerTotals {
    /** focus time (closed work stretches); mirrored into records.duration */
    workMs: number;
    /** scheduled + custom break time */
    breakMs: number;
    /** waiting at a skipped break offer (counted as break time, not as a break) */
    gapMs: number;
    pauseMs: number;
    sessions: number;
    /** countdown sessions that ran to the end */
    completedSessions: number;
    scheduledBreaks: number;
    customBreaks: number;
    pauses: number;
}

export interface TimerState {
    v: 1;
    mode: TimerMode;
    config: TimerConfig;
    phase: TimerPhase;
    /** start of the current phase stretch */
    phaseStartedAt: number;

    /** a focus session is open (work or paused inside it) */
    sessionOpen: boolean;
    /** focus banked in the open session before the current stretch (pauses don't split a session) */
    sessionWorkMs: number;
    /** countdown length of the open session (compared with its focus), null = count-up */
    sessionTargetMs: number | null;
    /** flowtime: session focus at which the last break suggestion was dismissed */
    suggestionSnoozedAtMs: number;

    /** scheduled / custom break in progress */
    breakSource: BreakSource | null;
    /** when a scheduled break countdown ends (null for a custom break) */
    breakEndsAt: number | null;
    /** break offered at the end of a countdown session */
    awaitingKind: "short" | "long" | "deep" | null;
    pauseReason: string | null;

    /** pomodoro: completed sessions since the last long break */
    pomodoroCycle: number;
    /** 50/10: focus left of the 50 minutes after a mid-session break (null = a full 50) */
    deepRemainingMs: number | null;
    /** starter: focus left of the 10 minutes */
    starterRemainingMs: number;

    /** paid timer changes used (max FREE_TIMER_CHANGES before each change resets the stats) */
    changesUsed: number;
    resets: number;

    totals: TimerTotals;
    segments: TimerSegment[];
    modeHistory: TimerModeChange[];
}

export type TimerEvent =
    | { type: "pause"; reason?: string | null }
    | { type: "resume" }
    | { type: "take_break" }
    | { type: "take_suggested_break" }
    | { type: "snooze_suggestion" }
    | { type: "end_break" }
    | { type: "session_due" }
    | { type: "accept_break" }
    | { type: "skip_break" }
    | { type: "starter_switch"; mode: TimerMode; config?: TimerConfig }
    | { type: "change_mode"; mode: TimerMode; config?: TimerConfig }
    | { type: "close" }
    | { type: "reopen" };

export type TimerEventType = TimerEvent[ "type" ];

export interface TimerSummary {
    focusMs: number;
    /** break + gap time */
    breakMs: number;
    /** focus + break (pauses excluded) */
    totalMs: number;
    sessions: number;
    completedSessions: number;
    breaks: number;
    scheduledBreaks: number;
    customBreaks: number;
    pauses: number;
    pauseMs: number;
    pauseReasons: string[];
    modes: TimerModeChange[];
    changesUsed: number;
    resets: number;
}

/** What the picker returns. */
export interface TimerChoice {
    mode: TimerMode;
    config?: TimerConfig;
}
