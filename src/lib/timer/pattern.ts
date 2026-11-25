import type { TimerMode, TimerSummary } from "./types";

/** Compact, reason-free work pattern for the AI (pause reasons are never sent). */
export interface WorkPattern {
    timers: TimerMode[];
    sessions: number;
    completedSessions: number;
    breaks: number;
    breakMinutes: number;
    pauses: number;
    pauseMinutes: number;
    resets: number;
}

const toMin = ( ms: number ) => Math.round( ( Math.max( 0, ms ) / 60_000 ) * 10 ) / 10;

export function toWorkPattern( s: TimerSummary ): WorkPattern {
    return {
        timers: s.modes.map( m => m.mode ),
        sessions: s.sessions,
        completedSessions: s.completedSessions,
        breaks: s.breaks,
        breakMinutes: toMin( s.breakMs ),
        pauses: s.pauses,
        pauseMinutes: toMin( s.pauseMs ),
        resets: s.resets,
    };
}

const MODE_EN: Record<TimerMode, string> = { pomodoro: "Pomodoro 25/5", deep: "Deep focus 50/10", starter: "10-minute starter", flowtime: "Flowtime" };

/** One line for the analysis prompt. */
export function describeWorkPattern( p: WorkPattern ): string {
    const timers = p.timers.map( t => MODE_EN[ t ] ?? t ).join( " → " );
    const parts = [
        `timer ${timers}`,
        `${p.sessions} focus session${p.sessions === 1 ? "" : "s"}${p.completedSessions ? ` (${p.completedSessions} ran to the end)` : ""}`,
        `${p.breaks} break${p.breaks === 1 ? "" : "s"} (${Math.round( p.breakMinutes )} min)`,
    ];
    if( p.pauses ) parts.push( `${p.pauses} pause${p.pauses === 1 ? "" : "s"} (${Math.round( p.pauseMinutes )} min, not counted as work)` );
    if( p.resets ) parts.push( "timer stats were reset by changing the timer too often" );
    return parts.join( ", " );
}
