/**
 * Turns the model's loose answer into a valid plan (pure, unit-tested). Only existing startable
 * candidates can be picked; everything else is fixed or rejected here, in code.
 */

import { NEXT_ACTION_TEXT_LIMITS, type PlanIntent, type PlanKind } from "./config";
import type { PlanCandidate } from "./candidates";
import { resolveScheduledFor, type PlanWhen, type ScheduleContext } from "./schedule";

export interface PlanSuggestion {
    kind: PlanKind;
    progressNodeId: string;
    practiceNodeId: string | null;
    progressReason: string;
    practiceReason: string;
    message: string;
    when: PlanWhen;
    scheduledFor: string;
}

export type NormalizeResult = { ok: true; value: PlanSuggestion } | { ok: false; reason: string };

const clean = ( v: unknown, limit: number ) => typeof v === "string" ? v.replace( /\s+/g, " " ).trim().slice( 0, limit ) : "";

/** "c2", "C2", " c2 ", "[c2]", "c2: name" → "c2" */
const toKey = ( v: unknown ) => {
    if( typeof v !== "string" ) return "";
    const m = v.match( /c\s*(\d+)/i );
    return m ? `c${Number( m[1] )}` : "";
};

export function normalizeNextAction(
    raw: unknown,
    candidates: readonly PlanCandidate[],
    ctx: { intent: PlanIntent | null; schedule: ScheduleContext },
): NormalizeResult {

    if( !raw || typeof raw !== "object" ) return { ok: false, reason: "not a JSON object" };
    if( candidates.length === 0 ) return { ok: false, reason: "no candidates" };

    const r = { ...( raw as Record<string, unknown> ) };
    const byKey = new Map( candidates.map( c => [ c.key, c ] ) );

    let progress = byKey.get( toKey( r.progress_key ) );
    let practice = byKey.get( toKey( r.practice_key ) );
    const wantsPractice = typeof r.kind === "string" && r.kind.toLowerCase().includes( "practice" );

    if( !progress ) {
        // the model only gave a practice task: keep it as the plan when it's the only thing it picked
        if( practice ) { progress = practice; practice = undefined; r.progress_reason ||= r.practice_reason; }
        else return { ok: false, reason: `progress_key must be one of ${candidates.map( c => c.key ).join( ", " )}` };
    }

    const oneTime = candidates.filter( c => !c.isLoop );
    // set when the model put the repeating task in the main slot and we moved it to practice
    let movedToPractice = false;
    let progressReason = r.progress_reason;
    let practiceReason = r.practice_reason;

    // the main task is a one-time task whenever one exists
    if( progress.isLoop && oneTime.length > 0 ) {
        if( practice && !practice.isLoop ) {
            // swapped by the model
            [ progress, practice ] = [ practice, progress ];
            [ progressReason, practiceReason ] = [ practiceReason, progressReason ];
        }
        else if( !practice ) {
            return { ok: false, reason: "progress_key must be a non-repeating task when one exists (a repeating task goes in practice_key)" };
        }
        else return { ok: false, reason: "progress_key must be a non-repeating task when one exists" };
        movedToPractice = true;
    }

    // practice: a different repeating task next to a one-time main task
    if( practice && ( !practice.isLoop || practice.id === progress.id || progress.isLoop ) ) practice = undefined;

    const kind: PlanKind = practice && ( wantsPractice || movedToPractice ) ? "practice_progress" : "progress";
    if( kind === "progress" ) practice = undefined;

    const { when, key } = resolveScheduledFor( ctx.intent, typeof r.when === "string" ? r.when.trim().toLowerCase() : null, ctx.schedule );

    return {
        ok: true,
        value: {
            kind,
            progressNodeId: progress.id,
            practiceNodeId: practice?.id ?? null,
            progressReason: clean( progressReason, NEXT_ACTION_TEXT_LIMITS.reason ),
            practiceReason: practice ? clean( practiceReason, NEXT_ACTION_TEXT_LIMITS.reason ) : "",
            message: clean( r.message, NEXT_ACTION_TEXT_LIMITS.message ),
            when,
            scheduledFor: key,
        },
    };

}

export interface ManualPlanInput {
    progressNodeId: string;
    practiceNodeId?: string | null;
}

/** Checks a plan the user picked by hand (or edited). Same node rules as the AI's plan. */
export function validateManualPlan( input: ManualPlanInput, candidates: readonly PlanCandidate[] ): { ok: true; kind: PlanKind; practiceNodeId: string | null } | { ok: false; message: string } {

    const byId = new Map( candidates.map( c => [ c.id, c ] ) );
    const progress = byId.get( input.progressNodeId );

    if( !progress ) return { ok: false, message: "選んだタスクは今は始められません。ツリーを確認してください。" };

    if( !input.practiceNodeId ) return { ok: true, kind: "progress", practiceNodeId: null };

    const practice = byId.get( input.practiceNodeId );

    if( !practice ) return { ok: false, message: "選んだ練習タスクは今は始められません。" };
    if( !practice.isLoop ) return { ok: false, message: "練習タスクには繰り返しタスクを選んでください。" };
    if( practice.id === progress.id ) return { ok: false, message: "練習タスクと進捗タスクは別のタスクにしてください。" };

    return { ok: true, kind: "practice_progress", practiceNodeId: practice.id };

}
