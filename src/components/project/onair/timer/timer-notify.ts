"use client"

import { toast } from "sonner";

/** Asks once for browser notifications (optional: the in-app toast and sound always work). */
export function requestTimerNotificationPermission() {
    try {
        if( typeof Notification !== "undefined" && Notification.permission === "default" ) void Notification.requestPermission();
    } catch { /* unsupported (e.g. plain http on some browsers) */ }
}

let audioCtx: AudioContext | null = null;

/** Two short beeps, no audio files needed. */
function beep() {
    try {
        const Ctx = window.AudioContext ?? ( window as unknown as { webkitAudioContext?: typeof AudioContext } ).webkitAudioContext;
        if( !Ctx ) return;
        audioCtx ??= new Ctx();
        const ctx = audioCtx;
        [ 0, 0.25 ].forEach( offset => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = "sine";
            osc.frequency.value = 880;
            gain.gain.setValueAtTime( 0.0001, ctx.currentTime + offset );
            gain.gain.exponentialRampToValueAtTime( 0.2, ctx.currentTime + offset + 0.02 );
            gain.gain.exponentialRampToValueAtTime( 0.0001, ctx.currentTime + offset + 0.2 );
            osc.connect( gain ).connect( ctx.destination );
            osc.start( ctx.currentTime + offset );
            osc.stop( ctx.currentTime + offset + 0.22 );
        } );
    } catch { /* autoplay blocked */ }
}

/** Toast + sound, plus a system notification when the tab is in the background. */
export function notifyTimer( title: string, body?: string, opts: { sound?: boolean } = {} ) {

    toast( title, { description: body } );
    if( opts.sound !== false ) beep();

    try {
        if( typeof Notification !== "undefined" && Notification.permission === "granted" && document.visibilityState === "hidden" ) {
            new Notification( title, { body, tag: "grinote-timer" } );
        }
    } catch { /* some browsers only allow notifications from a service worker */ }

}
