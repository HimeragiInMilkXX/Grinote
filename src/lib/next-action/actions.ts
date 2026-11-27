"use server";

/**
 * Server actions of the AI suggested next action (docs/next-action.md). Shared by the task
 * complete page, the goal tree, the project dashboard and the calendar.
 *
 * Draft flow: start (first generation) → up to NEXT_ACTION_MAX_REVISIONS revisions → save (as is
 * or edited) / reject. Saving makes the draft the project's current plan (older saved rows become
 * 'replaced'). The user can also make a plan by hand without the AI.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createActionClient } from "@/utils/supabase/actions";
import { requireUser } from "@/utils/supabase/server";
import { NEXT_ACTION_MAX_GENERATIONS, NEXT_ACTION_TEXT_LIMITS, PLAN_INTENTS, PLAN_ORIGINS, type PlanIntent, type PlanOrigin } from "./config";
import { buildCandidates, type PlanCandidate } from "./candidates";
import { loadDraftRow, loadPlanContext, loadPlanNodes, loadPlanProject, loadSavedRow, todayKeyNow, scheduleContextOf, type PlanContext, type PlanProject } from "./data";
import { runNextActionGeneration } from "./generate";
import { validateManualPlan } from "./normalize";
import type { PlanRevision } from "./prompt";
import { planHighlights, resolvePlan, shouldAskForPlan } from "./resolve";
import { isPickableDay } from "./schedule";
import { loadScheduleGate } from "@/lib/schedule/data";
import type { NextActionRow, NextActionView } from "./types";

export interface PlanCandidateOption {
    id: string;
    name: string;
    path: string[];
    isLoop: boolean;
    estimateMinutes: number;
    repetitionsCompleted: number;
    repetitionsRequired: number;
}

export interface NextActionState {
    saved: NextActionView | null;
    /** the open draft's suggestion (null while it has none, e.g. after a failed first run) */
    draft: NextActionView | null;
    draftId: string | null;
    /** generations left for the open draft */
    draftRemaining: number;
    candidates: PlanCandidateOption[];
    todayKey: string;
    nextWorkDay: string | null;
    goalKey: string | null;
}

export type NextActionResult = { ok: true; state: NextActionState } | { ok: false; message: string; state?: NextActionState };

export interface PlanEdits {
    progressNodeId: string;
    practiceNodeId?: string | null;
    scheduledFor: string;
}

const MESSAGES = {
    notFound: "プロジェクトが見つかりません。",
    noCandidates: "今始められるタスクがありません。ゴールツリーにタスクを追加してください。",
    noDraft: "このおすすめはもう確定済みです。画面を更新してください。",
    limit: "再生成の回数を使い切りました。保存するか却下してください。",
    conflict: "ほかの画面で同時に更新されました。もう一度お試しください。",
    stale: "おすすめのタスクが今は始められません（ツリーが変更されました）。再生成するか自分で選んでください。",
    badDay: "日付は今日から目標日までの間で選んでください。",
    unknown: "次のアクションを処理できませんでした。時間をおいて再試行してください。",
} as const;

const errorText = ( e: unknown ) => e instanceof Error ? e.message : String( e );

function describeError( e: unknown ): string {

    const text = errorText( e );
    if( text.includes( "next_action_foreign_node" ) ) return MESSAGES.stale;
    if( text.includes( "next_actions_one_draft_idx" ) || text.includes( "duplicate key" ) ) return MESSAGES.conflict;
    return MESSAGES.unknown;

}

const toOption = ( c: PlanCandidate ): PlanCandidateOption => ( {
    id: c.id,
    name: c.name,
    path: c.path,
    isLoop: c.isLoop,
    estimateMinutes: c.estimateMinutes,
    repetitionsCompleted: c.repetitionsCompleted,
    repetitionsRequired: c.repetitionsRequired,
} );

async function session( projectId: string ) {

    const supabase = await createActionClient();
    const user = await requireUser( supabase );
    const project = await loadPlanProject( supabase, projectId, user.id );

    return { supabase, user, project };

}

/** State for the dialog/card. `ctx` avoids reloading the tree when the caller already has it. */
async function buildState( supabase: SupabaseClient, project: PlanProject, ctx?: Pick<PlanContext, "rows" | "candidates" | "schedule"> ): Promise<NextActionState> {

    const projectId = project.id;

    const [ savedRow, draftRow, rows ] = await Promise.all( [
        loadSavedRow( supabase, projectId ),
        loadDraftRow( supabase, projectId ),
        ctx ? Promise.resolve( ctx.rows ) : loadPlanNodes( supabase, projectId ),
    ] );

    const todayKey = todayKeyNow();
    const candidates = ctx?.candidates ?? buildCandidates( rows );

    const schedule = ctx?.schedule ?? scheduleContextOf( project, todayKey, 0 );

    return {
        saved: savedRow ? resolvePlan( savedRow, rows, todayKey ) : null,
        draft: draftRow ? resolvePlan( draftRow, rows, todayKey ) : null,
        draftId: draftRow?.id ?? null,
        draftRemaining: draftRow ? Math.max( 0, NEXT_ACTION_MAX_GENERATIONS - draftRow.generation_count ) : NEXT_ACTION_MAX_GENERATIONS,
        candidates: candidates.map( toOption ),
        todayKey,
        nextWorkDay: schedule.nextWorkDay,
        goalKey: schedule.goalKey,
    };

}

const describeSuggestion = ( row: NextActionRow ): string => {

    const parts = [ `main task「${row.progress_task_name ?? "?"}」` ];
    if( row.kind === "practice_progress" ) parts.push( `practice「${row.practice_task_name ?? "?"}」` );
    parts.push( `on ${row.scheduled_for ?? "?"}` );

    return parts.join( ", " );

};

/**
 * One generation into an open draft. The generation is counted before the model runs (a double
 * click can't go over the limit) and given back when the model fails.
 */
async function generateInto( supabase: SupabaseClient, ctx: PlanContext, draft: NextActionRow, revisions: PlanRevision[] ): Promise<NextActionResult> {

    if( draft.generation_count >= NEXT_ACTION_MAX_GENERATIONS ) return { ok: false, message: MESSAGES.limit, state: await buildState( supabase, ctx.project, ctx ) };

    const used = draft.generation_count;

    const { data: reserved, error: reserveError } = await supabase
        .from( "next_actions" )
        .update( { generation_count: used + 1 } )
        .eq( "id", draft.id ).eq( "status", "draft" ).eq( "generation_count", used )
        .select( "id" );

    if( reserveError ) throw new Error( reserveError.message );
    if( !reserved?.length ) return { ok: false, message: MESSAGES.conflict, state: await buildState( supabase, ctx.project, ctx ) };

    const run = await runNextActionGeneration( {
        prompt: { ...ctx.promptBase, origin: draft.origin, intent: draft.intent, revisions },
        candidates: ctx.candidates,
        intent: draft.intent,
        schedule: ctx.schedule,
    } );

    if( !run.ok ) {

        await supabase.from( "next_actions" ).update( { generation_count: used } ).eq( "id", draft.id ).eq( "generation_count", used + 1 );

        return { ok: false, message: run.message, state: await buildState( supabase, ctx.project, ctx ) };

    }

    const s = run.suggestion;
    const nameOf = ( id: string | null ) => id ? ctx.candidates.find( c => c.id === id )?.name ?? null : null;

    const { error } = await supabase
        .from( "next_actions" )
        .update( {
            kind: s.kind,
            source: "ai",
            progress_node_id: s.progressNodeId,
            practice_node_id: s.practiceNodeId,
            progress_task_name: nameOf( s.progressNodeId ),
            practice_task_name: nameOf( s.practiceNodeId ),
            progress_reason: s.progressReason,
            practice_reason: s.practiceReason || null,
            message: s.message,
            scheduled_for: s.scheduledFor,
            model: run.model,
            history: revisions,
        } )
        .eq( "id", draft.id ).eq( "status", "draft" );

    if( error ) throw new Error( error.message );

    return { ok: true, state: await buildState( supabase, ctx.project, ctx ) };

}

export async function getNextActionState( projectId: string ): Promise<NextActionResult> {

    try {

        const { supabase, project } = await session( projectId );
        if( !project ) return { ok: false, message: MESSAGES.notFound };

        return { ok: true, state: await buildState( supabase, project ) };

    } catch( e ) {

        console.error( "[next-action] getNextActionState", errorText( e ) );
        return { ok: false, message: describeError( e ) };

    }

}

/** Opens a new draft (an older open draft expires) and runs the first generation. */
export async function startNextActionDraft( projectId: string, origin: PlanOrigin, intent: PlanIntent | null ): Promise<NextActionResult> {

    try {

        if( !PLAN_ORIGINS.includes( origin ) ) return { ok: false, message: MESSAGES.unknown };
        const cleanIntent = intent && PLAN_INTENTS.includes( intent ) ? intent : null;

        const { supabase, project } = await session( projectId );
        if( !project ) return { ok: false, message: MESSAGES.notFound };

        const ctx = await loadPlanContext( supabase, project );
        if( ctx.candidates.length === 0 ) return { ok: false, message: MESSAGES.noCandidates, state: await buildState( supabase, project, ctx ) };

        const { error: expireError } = await supabase.from( "next_actions" ).update( { status: "expired" } ).eq( "project_id", projectId ).eq( "status", "draft" );
        if( expireError ) throw new Error( expireError.message );

        const { data: draft, error } = await supabase
            .from( "next_actions" )
            .insert( { project_id: projectId, origin, intent: cleanIntent, status: "draft" } )
            .select( "*" )
            .single();

        if( error ) throw new Error( error.message );

        return await generateInto( supabase, ctx, draft as NextActionRow, [] );

    } catch( e ) {

        console.error( "[next-action] startNextActionDraft", errorText( e ) );
        return { ok: false, message: describeError( e ) };

    }

}

/** Regenerate (empty feedback) or revise with the user's feedback. */
export async function reviseNextAction( projectId: string, draftId: string, feedback: string ): Promise<NextActionResult> {

    try {

        const { supabase, project } = await session( projectId );
        if( !project ) return { ok: false, message: MESSAGES.notFound };

        const draft = await loadDraftRow( supabase, projectId );
        if( !draft || draft.id !== draftId ) return { ok: false, message: MESSAGES.noDraft, state: await buildState( supabase, project ) };
        if( draft.generation_count >= NEXT_ACTION_MAX_GENERATIONS ) return { ok: false, message: MESSAGES.limit, state: await buildState( supabase, project ) };

        const ctx = await loadPlanContext( supabase, project );
        if( ctx.candidates.length === 0 ) return { ok: false, message: MESSAGES.noCandidates, state: await buildState( supabase, project, ctx ) };

        const previous = Array.isArray( draft.history ) ? draft.history : [];
        // a draft whose first run failed has nothing to revise yet
        const revisions = draft.kind
            ? [ ...previous, { round: previous.length + 1, suggestion: describeSuggestion( draft ), feedback: ( typeof feedback === "string" ? feedback : "" ).trim().slice( 0, NEXT_ACTION_TEXT_LIMITS.feedback ) } ]
            : previous;

        return await generateInto( supabase, ctx, draft, revisions );

    } catch( e ) {

        console.error( "[next-action] reviseNextAction", errorText( e ) );
        return { ok: false, message: describeError( e ) };

    }

}

function checkEdits( edits: PlanEdits, candidates: readonly PlanCandidate[], todayKey: string, goalKey: string | null ) {

    const plan = validateManualPlan( { progressNodeId: edits.progressNodeId, practiceNodeId: edits.practiceNodeId ?? null }, candidates );
    if( !plan.ok ) return plan;
    if( !isPickableDay( edits.scheduledFor, todayKey, goalKey ) ) return { ok: false as const, message: MESSAGES.badDay };

    return plan;

}

async function replaceOlderSaved( supabase: SupabaseClient, projectId: string, keepId: string ) {

    const { error } = await supabase.from( "next_actions" ).update( { status: "replaced" } ).eq( "project_id", projectId ).eq( "status", "saved" ).neq( "id", keepId );
    if( error ) console.error( "[next-action] replace older plans", error.message );

}

/** Saves the draft as the current plan, as suggested or with the user's edits. */
export async function saveNextAction( projectId: string, draftId: string, edits?: PlanEdits | null ): Promise<NextActionResult> {

    try {

        const { supabase, project } = await session( projectId );
        if( !project ) return { ok: false, message: MESSAGES.notFound };

        const draft = await loadDraftRow( supabase, projectId );
        if( !draft || draft.id !== draftId ) return { ok: false, message: MESSAGES.noDraft, state: await buildState( supabase, project ) };

        const rows = await loadPlanNodes( supabase, projectId );
        const candidates = buildCandidates( rows );
        const todayKey = todayKeyNow();
        const schedule = scheduleContextOf( project, todayKey, 0 );
        const nameOf = ( id: string | null | undefined ) => id ? candidates.find( c => c.id === id )?.name ?? null : null;

        let patch: Record<string, unknown>;

        if( edits ) {

            const checked = checkEdits( edits, candidates, todayKey, schedule.goalKey );
            if( !checked.ok ) return { ok: false, message: checked.message };

            const changed = edits.progressNodeId !== draft.progress_node_id
                || ( checked.practiceNodeId ?? null ) !== ( draft.practice_node_id ?? null )
                || edits.scheduledFor !== draft.scheduled_for;

            patch = {
                kind: checked.kind,
                progress_node_id: edits.progressNodeId,
                practice_node_id: checked.practiceNodeId,
                progress_task_name: nameOf( edits.progressNodeId ),
                practice_task_name: nameOf( checked.practiceNodeId ),
                scheduled_for: edits.scheduledFor,
                ...( changed ? {
                    source: "user",
                    // the AI's reasons only stay for the items the user kept
                    progress_reason: edits.progressNodeId === draft.progress_node_id ? draft.progress_reason : null,
                    practice_reason: checked.practiceNodeId && checked.practiceNodeId === draft.practice_node_id ? draft.practice_reason : null,
                } : {} ),
            };

        } else {

            if( !draft.kind || !draft.progress_node_id ) return { ok: false, message: MESSAGES.stale };

            const view = resolvePlan( draft, rows, todayKey );
            if( !view || view.stale ) return { ok: false, message: MESSAGES.stale, state: await buildState( supabase, project ) };

            // a day that passed while the dialog was open moves to today
            patch = draft.scheduled_for && draft.scheduled_for < todayKey ? { scheduled_for: todayKey } : {};

        }

        const { data: saved, error } = await supabase
            .from( "next_actions" )
            .update( { ...patch, status: "saved", saved_at: new Date().toISOString() } )
            .eq( "id", draft.id ).eq( "status", "draft" )
            .select( "id" );

        if( error ) throw new Error( error.message );
        if( !saved?.length ) return { ok: false, message: MESSAGES.noDraft, state: await buildState( supabase, project ) };

        await replaceOlderSaved( supabase, projectId, draft.id );

        return { ok: true, state: await buildState( supabase, project ) };

    } catch( e ) {

        console.error( "[next-action] saveNextAction", errorText( e ) );
        return { ok: false, message: describeError( e ) };

    }

}

/** The user's own plan, without the AI (an open draft expires). */
export async function createManualNextAction( projectId: string, edits: PlanEdits ): Promise<NextActionResult> {

    try {

        const { supabase, project } = await session( projectId );
        if( !project ) return { ok: false, message: MESSAGES.notFound };

        const rows = await loadPlanNodes( supabase, projectId );
        const candidates = buildCandidates( rows );
        const todayKey = todayKeyNow();
        const schedule = scheduleContextOf( project, todayKey, 0 );

        const checked = checkEdits( edits, candidates, todayKey, schedule.goalKey );
        if( !checked.ok ) return { ok: false, message: checked.message };

        const nameOf = ( id: string | null ) => id ? candidates.find( c => c.id === id )?.name ?? null : null;

        await supabase.from( "next_actions" ).update( { status: "expired" } ).eq( "project_id", projectId ).eq( "status", "draft" );

        const { data, error } = await supabase
            .from( "next_actions" )
            .insert( {
                project_id: projectId,
                status: "saved",
                origin: "manual",
                source: "user",
                kind: checked.kind,
                progress_node_id: edits.progressNodeId,
                practice_node_id: checked.practiceNodeId,
                progress_task_name: nameOf( edits.progressNodeId ),
                practice_task_name: nameOf( checked.practiceNodeId ),
                scheduled_for: edits.scheduledFor,
                saved_at: new Date().toISOString(),
            } )
            .select( "id" )
            .single();

        if( error ) throw new Error( error.message );

        await replaceOlderSaved( supabase, projectId, data.id );

        return { ok: true, state: await buildState( supabase, project ) };

    } catch( e ) {

        console.error( "[next-action] createManualNextAction", errorText( e ) );
        return { ok: false, message: describeError( e ) };

    }

}

export async function rejectNextAction( projectId: string, draftId: string ): Promise<NextActionResult> {

    try {

        const { supabase, project } = await session( projectId );
        if( !project ) return { ok: false, message: MESSAGES.notFound };

        const { error } = await supabase.from( "next_actions" ).update( { status: "rejected" } ).eq( "id", draftId ).eq( "project_id", projectId ).eq( "status", "draft" );
        if( error ) throw new Error( error.message );

        return { ok: true, state: await buildState( supabase, project ) };

    } catch( e ) {

        console.error( "[next-action] rejectNextAction", errorText( e ) );
        return { ok: false, message: describeError( e ) };

    }

}

/** 取り消す on the dashboard: the project has no current plan afterwards. */
export async function clearSavedNextAction( projectId: string ): Promise<NextActionResult> {

    try {

        const { supabase, project } = await session( projectId );
        if( !project ) return { ok: false, message: MESSAGES.notFound };

        const { error } = await supabase.from( "next_actions" ).update( { status: "rejected" } ).eq( "project_id", projectId ).eq( "status", "saved" );
        if( error ) throw new Error( error.message );

        return { ok: true, state: await buildState( supabase, project ) };

    } catch( e ) {

        console.error( "[next-action] clearSavedNextAction", errorText( e ) );
        return { ok: false, message: describeError( e ) };

    }

}

/** After a tree save: should we ask for a new plan, and which nodes to highlight now. */
export async function afterTreeSave( projectId: string ): Promise<{ ask: boolean; highlights: Record<string, "progress" | "practice"> }> {

    try {

        const { supabase, project } = await session( projectId );
        if( !project ) return { ask: false, highlights: {} };

        const rows = await loadPlanNodes( supabase, projectId );
        const candidates = buildCandidates( rows );
        const [ savedRow, gate ] = await Promise.all( [ loadSavedRow( supabase, projectId ), loadScheduleGate( supabase, projectId, rows ) ] );
        const saved = savedRow ? resolvePlan( savedRow, rows, todayKeyNow() ) : null;

        // the user's own schedule comes first: only ask when it leaves a gap
        return { ask: shouldAskForPlan( saved, candidates.length ) && gate.allowed, highlights: planHighlights( saved ) };

    } catch( e ) {

        console.error( "[next-action] afterTreeSave", errorText( e ) );
        return { ask: false, highlights: {} };

    }

}
