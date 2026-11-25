import "server-only";

/**
 * Server-side timer settings. A scheduled break that runs over its countdown by at most this
 * long isn't counted as break: the next session starts at the scheduled end. Beyond it, the
 * whole overrun counts as break time. Override with TIMER_BREAK_OVERRUN_GRACE_MS.
 */
export const TIMER_BREAK_OVERRUN_GRACE_MS = ( () => {

    const raw = Number( process.env.TIMER_BREAK_OVERRUN_GRACE_MS );
    return Number.isFinite( raw ) && raw >= 0 ? raw : 10_000;

} )();
