import { asTimerState } from "./machine";
import type { TimerState, TimerSummary } from "./types";

/** Totals of a closed (or open) timer for the report, task_complete, journey and the AI. */
export function summarizeTimer( s: TimerState ): TimerSummary {

    const t = s.totals;
    const breakMs = t.breakMs + t.gapMs;

    return {
        focusMs: t.workMs,
        breakMs,
        totalMs: t.workMs + breakMs,
        sessions: t.sessions,
        completedSessions: t.completedSessions,
        breaks: t.scheduledBreaks + t.customBreaks,
        scheduledBreaks: t.scheduledBreaks,
        customBreaks: t.customBreaks,
        pauses: t.pauses,
        pauseMs: t.pauseMs,
        pauseReasons: s.segments.filter( seg => seg.kind === "pause" && seg.reason ).map( seg => seg.reason! ),
        modes: s.modeHistory,
        changesUsed: s.changesUsed,
        resets: s.resets,
    };

}

/** Summary from a stored `records.timer` value, null for records before 4.5. */
export const summarizeStoredTimer = ( v: unknown ): TimerSummary | null => {
    const s = asTimerState( v );
    return s ? summarizeTimer( s ) : null;
};
