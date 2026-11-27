import { describe, expect, it } from "vitest";
import { buildCandidates } from "./candidates";
import { fixture } from "./test-fixtures";
import { normalizeNextAction, validateManualPlan } from "./normalize";
import type { ScheduleContext } from "./schedule";

// c1 = a2, c2 = b1 (one-time), c3 = p (loop)
const candidates = buildCandidates( fixture );

const schedule: ScheduleContext = { todayKey: "2026-11-27", todayIsWorkDay: true, remainingMs: 600_000, nextWorkDay: "2026-11-30", goalKey: null };
const ctx = { intent: null, schedule };

const base = { kind: "progress", progress_key: "c2", practice_key: "", when: "today", progress_reason: "理由", practice_reason: "", message: "がんばりましょう" };

describe( "normalizeNextAction", () => {

    it( "maps keys to node ids", () => {
        const r = normalizeNextAction( base, candidates, ctx );
        expect( r ).toEqual( { ok: true, value: expect.objectContaining( { kind: "progress", progressNodeId: "b1", practiceNodeId: null, scheduledFor: "2026-11-27" } ) } );
    } );

    it( "accepts loose key formats", () => {
        for( const key of [ "C2", " c2 ", "[c2]", "c2: b1" ] ) {
            const r = normalizeNextAction( { ...base, progress_key: key }, candidates, ctx );
            expect( r.ok && r.value.progressNodeId ).toBe( "b1" );
        }
    } );

    it( "builds a practice + progress plan", () => {
        const r = normalizeNextAction( { ...base, kind: "practice_progress", practice_key: "c3", practice_reason: "練習" }, candidates, ctx );
        expect( r.ok && r.value ).toMatchObject( { kind: "practice_progress", progressNodeId: "b1", practiceNodeId: "p", practiceReason: "練習" } );
    } );

    it( "swaps a loop put in the main slot", () => {
        const r = normalizeNextAction( { ...base, kind: "practice_progress", progress_key: "c3", practice_key: "c1", progress_reason: "loop", practice_reason: "one" }, candidates, ctx );
        expect( r.ok && r.value ).toMatchObject( { kind: "practice_progress", progressNodeId: "a2", practiceNodeId: "p", progressReason: "one", practiceReason: "loop" } );
    } );

    it( "drops a practice that isn't a loop, or the same task", () => {
        const r1 = normalizeNextAction( { ...base, kind: "practice_progress", practice_key: "c1" }, candidates, ctx );
        expect( r1.ok && r1.value ).toMatchObject( { kind: "progress", practiceNodeId: null } );
        const r2 = normalizeNextAction( { ...base, kind: "progress", practice_key: "c3" }, candidates, ctx );
        expect( r2.ok && r2.value ).toMatchObject( { kind: "progress", practiceNodeId: null } );
    } );

    it( "rejects unknown keys and a lone loop when one-time tasks exist", () => {
        expect( normalizeNextAction( { ...base, progress_key: "c9" }, candidates, ctx ).ok ).toBe( false );
        expect( normalizeNextAction( { ...base, progress_key: "c3" }, candidates, ctx ).ok ).toBe( false );
        expect( normalizeNextAction( "nope", candidates, ctx ).ok ).toBe( false );
    } );

    it( "allows a loop as the main task when it's the only kind left", () => {
        const loops = candidates.filter( c => c.isLoop ).map( ( c, i ) => ( { ...c, key: `c${i + 1}` } ) );
        const r = normalizeNextAction( { ...base, progress_key: "c1" }, loops, ctx );
        expect( r.ok && r.value ).toMatchObject( { kind: "progress", progressNodeId: "p" } );
    } );

    it( "follows the user's intent for the day and clamps texts", () => {
        const r = normalizeNextAction( { ...base, message: "あ".repeat( 999 ) }, candidates, { intent: "next_work_day", schedule } );
        expect( r.ok && r.value.scheduledFor ).toBe( "2026-11-30" );
        expect( r.ok && r.value.message.length ).toBe( 300 );
    } );

    it( "doesn't mutate the raw answer", () => {
        const raw = { ...base, progress_key: "", practice_key: "c2", practice_reason: "x" };
        normalizeNextAction( raw, candidates, ctx );
        expect( raw.progress_key ).toBe( "" );
    } );

} );

describe( "validateManualPlan", () => {

    it( "accepts a startable task, optionally with a loop practice", () => {
        expect( validateManualPlan( { progressNodeId: "a2" }, candidates ) ).toEqual( { ok: true, kind: "progress", practiceNodeId: null } );
        expect( validateManualPlan( { progressNodeId: "a2", practiceNodeId: "p" }, candidates ) ).toEqual( { ok: true, kind: "practice_progress", practiceNodeId: "p" } );
    } );

    it( "rejects blocked, non-loop or duplicate picks", () => {
        expect( validateManualPlan( { progressNodeId: "b" }, candidates ).ok ).toBe( false );
        expect( validateManualPlan( { progressNodeId: "a2", practiceNodeId: "b1" }, candidates ).ok ).toBe( false );
        expect( validateManualPlan( { progressNodeId: "p", practiceNodeId: "p" }, candidates ).ok ).toBe( false );
    } );

} );
