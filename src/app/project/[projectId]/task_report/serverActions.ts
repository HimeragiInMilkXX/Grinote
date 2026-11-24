"use server";

/**
 * Task report (journey system, docs/journey-system.md): after 完成 the record is 'reviewing'.
 * The user writes the three reflections, the AI analyses them (or asks for clarification), the
 * user confirms, and confirmReport awards the XP with the AI score.
 *
 * Journal status: draft → analyzing → needs_clarification | analyzed | failed → confirmed.
 * - At most MAX_ANALYSIS_RUNS analyses per record, whatever happens in between (作業に戻る too).
 * - Once analysed, the record always keeps a usable analysis: a failed or clarifying re-analysis
 *   and 作業に戻る keep the previous one, so the user can never get stuck.
 * - The analysis stores the reflections it was made from; confirming writes them back, so the
 *   journey always shows the text the score was computed from.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { asJourneyAnalysis } from "@/lib/journey/analysis";
import { runJourneyAnalysis } from "@/lib/journey/analyze";
import { loadJourneyEntries, toHistorySummary } from "@/lib/journey/history";
import {
    MAX_ANALYSIS_RUNS, MAX_CLARIFICATION_ROUNDS, pendingQuestionsOf, asClarifications, recoveredStatus, settledClarifications, settlePendingClarifications,
    toJournalView, type JournalView, type TaskJournalRow,
} from "@/lib/journey/journal";
import { createJournalSnapshot, loadJournal, recoverStaleJournal, updateJournal } from "@/lib/journey/journal-db";
import { toReflectionDraft, validateClarificationAnswers, validateReflection, type Reflection, type ReflectionKey } from "@/lib/journey/reflection";
import { awardTaskCompletion } from "@/lib/rewards/award-task";
import { intervalToMinutes, msToMinutes } from "@/lib/rewards/breakdown";
import { createActionClient } from "@/utils/supabase/actions";
import { createClient, requireUser } from "@/utils/supabase/server";
import { errorMessage } from "@/utils/utils";

const HISTORY_LIMIT = 5;

export interface ReportTask {
    name: string;
    description: string | null;
    estimatedMinutes: number;
    isLoop: boolean;
    repetitionsCompleted: number;
    repetitionsRequired: number;
}

export interface ReportState {
    recordId: number;
    projectId: string;
    nodeId: string;
    durationMs: number;
    endedAt: string | null;
    task: ReportTask;
    journal: JournalView | null;
    limits: { maxRuns: number; maxRounds: number };
}

export type ReportActionResult =
    | { ok: true; journal: JournalView }
    | { ok: false; message: string; errors?: Partial<Record<ReflectionKey, string>>; journal?: JournalView };

type NodeRow = { task_name: string; description: string | null; time_limit: string | null; isLoop: boolean; repetitions_completed: number | null; repetitions_required: number | null };

type RecordRow = {
    id: number;
    status: string;
    node_id: string;
    duration: number | string | null;
    ended_at: string | null;
    nodes: NodeRow | NodeRow[] | null;
};

const RECORD_SELECT = "id, status, node_id, duration, ended_at, nodes ( task_name, description, time_limit, isLoop, repetitions_completed, repetitions_required )";

const MESSAGES = {
    notReviewing: "このタスクはレポート待ちではありません。",
    confirmed: "このレポートはすでに確定しています。",
    runLimit: `AIの分析は${MAX_ANALYSIS_RUNS}回までです。現在の分析で確定してください。`,
    conflict: "別の画面でレポートが更新されました。ページを再読み込みしてください。",
    analyzing: "AIが分析中です。終わるまでお待ちください。",
    notReady: "AIの分析が終わってから確定してください。",
    invalidReflection: "振り返りを確認してください。",
    unknown: "エラーが発生しました。もう一度お試しください。",
} as const;

const nodeOf = ( record: RecordRow ) => Array.isArray( record.nodes ) ? record.nodes[0] ?? null : record.nodes;

function toTask( record: RecordRow, journal: TaskJournalRow | null ): ReportTask {

    const node = nodeOf( record );

    return {
        name: journal?.task_name || node?.task_name || "",
        description: journal?.task_description ?? node?.description ?? null,
        // the snapshot taken at 完成 is what the reward uses
        estimatedMinutes: journal?.estimated_minutes != null ? Number( journal.estimated_minutes ) : intervalToMinutes( node?.time_limit ),
        isLoop: !!node?.isLoop,
        repetitionsCompleted: node?.repetitions_completed ?? 0,
        repetitionsRequired: node?.repetitions_required ?? 1,
    };

}

async function loadRecord( supabase: SupabaseClient, recordId: number, projectId: string, userId: string ): Promise<RecordRow | null> {

    const { data, error } = await supabase
        .from( "records" )
        .select( RECORD_SELECT )
        .eq( "id", recordId ).eq( "project_id", projectId ).eq( "user_id", userId )
        .maybeSingle();

    if( error ) throw new Error( error.message );

    return data as unknown as RecordRow | null;

}

/** The journal of a reviewing record (created at 完成; created here for records finished before that). */
async function ensureJournal( supabase: SupabaseClient, record: RecordRow, projectId: string, userId: string ): Promise<TaskJournalRow> {

    const existing = await recoverStaleJournal( supabase, await loadJournal( supabase, record.id ) );
    if( existing ) return existing;

    const node = nodeOf( record );
    await createJournalSnapshot( supabase, { recordId: record.id, projectId, userId, nodeId: record.node_id, node } );

    const created = await loadJournal( supabase, record.id );
    if( !created ) throw new Error( "journal was not created" );

    return created;

}

const reflectionColumns = ( r: Reflection ) => ( { reflection_learned: r.learned, reflection_difficult: r.difficult, reflection_next: r.next } );

const storedReflection = ( j: TaskJournalRow ) => toReflectionDraft( { learned: j.reflection_learned, difficult: j.reflection_difficult, next: j.reflection_next } );

const hasUsableAnalysis = ( j: TaskJournalRow ) => j.ai_score != null && asJourneyAnalysis( j.analysis ) != null;

/** For the report page. Redirects when the record isn't waiting for its report. */
export const getReport = async ( recordId: number, projectId: string ): Promise<ReportState> => {

    const supabase = await createClient();
    const user = await requireUser( supabase );

    const record = await loadRecord( supabase, recordId, projectId, user.id );

    if( !record ) redirect( `/project/${projectId}/dashboard` );
    if( record.status === "completed" ) redirect( `/project/${projectId}/task_complete?recordId=${recordId}` );
    if( record.status === "active" || record.status === "paused" ) redirect( `/project/${projectId}/onair` );
    if( record.status !== "reviewing" ) redirect( `/project/${projectId}/dashboard` );

    const journal = await loadJournal( supabase, recordId );

    // an interrupted run shows as what it recovers to; the next action writes it
    const view = journal ? toJournalView( { ...journal, analysis_status: recoveredStatus( journal ) ?? journal.analysis_status } ) : null;

    return {
        recordId,
        projectId,
        nodeId: record.node_id,
        durationMs: Number( record.duration ) || 0,
        endedAt: record.ended_at,
        task: toTask( record, journal ),
        journal: view,
        limits: { maxRuns: MAX_ANALYSIS_RUNS, maxRounds: MAX_CLARIFICATION_ROUNDS },
    };

};

/** Saves unvalidated reflections while the user writes the first report (draft / failed only). */
export const saveReflectionDraft = async ( recordId: number, projectId: string, draft: Partial<Reflection> ): Promise<ReportActionResult> => {

    try {

        const supabase = await createActionClient();
        const user = await requireUser( supabase );

        const record = await loadRecord( supabase, recordId, projectId, user.id );
        if( !record || record.status !== "reviewing" ) return { ok: false, message: MESSAGES.notReviewing };

        const journal = await ensureJournal( supabase, record, projectId, user.id );

        if( journal.confirmed_at ) return { ok: false, message: MESSAGES.confirmed };
        // analysed / clarifying / running reports change only through 分析 (the text goes with the run)
        if( journal.analysis_status !== "draft" && journal.analysis_status !== "failed" ) return { ok: true, journal: toJournalView( journal ) };

        const updated = await updateJournal( supabase, journal, reflectionColumns( toReflectionDraft( draft ) ) );
        if( !updated ) return { ok: false, message: MESSAGES.conflict };

        return { ok: true, journal: toJournalView( updated ) };

    } catch( e ) {

        console.error( "[journey] saveReflectionDraft", errorMessage( e ) );
        return { ok: false, message: MESSAGES.unknown };

    }

};

/**
 * Runs the AI analysis of the report. `answers` fill the pending clarifying questions;
 * `skip` (これ以上書けない) skips them and makes the AI judge now.
 */
export const analyzeReport = async ( recordId: number, projectId: string, input: { reflection: unknown; answers?: unknown; skip?: boolean } ): Promise<ReportActionResult> => {

    try {

        const supabase = await createActionClient();
        const user = await requireUser( supabase );

        const record = await loadRecord( supabase, recordId, projectId, user.id );
        if( !record || record.status !== "reviewing" ) return { ok: false, message: MESSAGES.notReviewing };

        const reflection = validateReflection( input.reflection );
        if( !reflection.ok ) return { ok: false, message: MESSAGES.invalidReflection, errors: reflection.errors };

        let journal = await ensureJournal( supabase, record, projectId, user.id );
        if( journal.confirmed_at ) return { ok: false, message: MESSAGES.confirmed };
        if( journal.analysis_status === "analyzing" ) return { ok: false, message: MESSAGES.analyzing, journal: toJournalView( journal ) };

        // the cap holds across re-analysis, clarification rounds and 作業に戻る
        if( journal.analysis_runs >= MAX_ANALYSIS_RUNS ) return { ok: false, message: MESSAGES.runLimit, journal: toJournalView( journal ) };

        const hadAnalysis = hasUsableAnalysis( journal );
        const statusAfterFailure = hadAnalysis ? "analyzed" : "failed";

        // settle the pending clarifying questions (answered or skipped)
        let clarifications = asClarifications( journal.clarifications );
        const pending = pendingQuestionsOf( journal.analysis_status, clarifications, journal.clarification_rounds );
        const skip = input.skip === true;

        if( pending.length > 0 ) {

            if( skip ) clarifications = settlePendingClarifications( clarifications, journal.clarification_rounds, null );
            else {
                const answers = validateClarificationAnswers( pending, input.answers );
                if( !answers.ok ) return { ok: false, message: answers.error, journal: toJournalView( journal ) };
                clarifications = settlePendingClarifications( clarifications, journal.clarification_rounds, answers.value );
            }

        }

        // save what the user wrote and lock the report while the (slow) model runs; confirming
        // meanwhile is refused, and the previous analysis (if any) stays in place
        const saved = await updateJournal( supabase, journal, {
            ...reflectionColumns( reflection.value ),
            clarifications,
            analysis_status: "analyzing",
        } );
        if( !saved ) return { ok: false, message: MESSAGES.conflict };
        journal = saved;

        let run: Awaited<ReturnType<typeof runJourneyAnalysis>>;

        try {

            const [ projectRes, entries ] = await Promise.all( [
                supabase.from( "projects" ).select( "name, final_goal, description" ).eq( "id", projectId ).single(),
                loadJourneyEntries( supabase, projectId, { limit: HISTORY_LIMIT } ),
            ] );

            if( projectRes.error ) throw new Error( projectRes.error.message );

            const task = toTask( record, journal );

            run = await runJourneyAnalysis( {
                project: { name: projectRes.data.name, finalGoal: projectRes.data.final_goal, description: projectRes.data.description },
                task: { name: task.name, description: task.description, estimatedMinutes: task.estimatedMinutes, isLoop: task.isLoop, repetitionsCompleted: task.repetitionsCompleted, repetitionsRequired: task.repetitionsRequired },
                actualMinutes: msToMinutes( Number( record.duration ) || 0 ),
                reflection: reflection.value,
                clarifications: settledClarifications( clarifications ),
                history: entries.map( toHistorySummary ).filter( ( h ): h is NonNullable<typeof h> => !!h ),
                canClarify: !skip && journal.clarification_rounds < MAX_CLARIFICATION_ROUNDS,
                hasEvidence: Array.isArray( journal.evidence ) && journal.evidence.length > 0,
            } );

        } catch( e ) {

            // unlock before giving up
            await updateJournal( supabase, journal, { analysis_status: statusAfterFailure } ).catch( () => null );
            throw e;

        }

        let updated: TaskJournalRow | null;

        if( !run.ok ) {

            // a failed re-analysis keeps the previous analysis; otherwise the no-AI claim opens up
            updated = await updateJournal( supabase, journal, { analysis_status: statusAfterFailure, model: run.model } );

            return { ok: false, message: run.message, journal: toJournalView( updated ?? journal ) };

        }

        if( run.result.kind === "clarify" ) {

            const round = journal.clarification_rounds + 1;

            updated = await updateJournal( supabase, journal, {
                clarifications: [ ...clarifications, ...run.result.questions.map( question => ( { round, question, answer: "", skipped: false } ) ) ],
                clarification_rounds: round,
                analysis_status: "needs_clarification",
                model: run.model,
            } );

        } else {

            const analysis = { ...run.result.analysis, reflection: reflection.value };

            updated = await updateJournal( supabase, journal, {
                analysis,
                ai_score: analysis.score,
                verification: analysis.verification,
                model: run.model,
                analyzed_at: analysis.analyzedAt,
                analysis_runs: journal.analysis_runs + 1,
                analysis_status: "analyzed",
            } );

        }

        if( !updated ) return { ok: false, message: MESSAGES.conflict };

        return { ok: true, journal: toJournalView( updated ) };

    } catch( e ) {

        console.error( "[journey] analyzeReport", errorMessage( e ) );
        return { ok: false, message: MESSAGES.unknown };

    }

};

function describeConfirmError( e: unknown ): string {

    const text = errorMessage( e );

    if( text.includes( "journal_required" ) ) return MESSAGES.notReady;
    if( text.includes( "record_not_active" ) || text.includes( "not waiting for its report" ) ) return MESSAGES.notReviewing;
    if( text.includes( "node_already_completed" ) ) return "このタスクはすでに完了しています。";
    if( text.includes( "xp_conflict" ) ) return "経験値が同時に更新されました。もう一度お試しください。";

    return MESSAGES.unknown;

}

/**
 * The user confirms the AI summary (or, after a failed analysis, claims without AI): awards the
 * XP once and opens the reward page.
 */
export const confirmReport = async ( recordId: number, projectId: string ): Promise<ReportActionResult> => {

    let recordIdOut: number;

    try {

        const supabase = await createActionClient();
        const user = await requireUser( supabase );

        const record = await loadRecord( supabase, recordId, projectId, user.id );
        if( !record ) return { ok: false, message: MESSAGES.notReviewing };

        if( record.status === "completed" ) {

            // double click: already rewarded
            recordIdOut = recordId;

        } else {

            if( record.status !== "reviewing" ) return { ok: false, message: MESSAGES.notReviewing };

            let journal = await recoverStaleJournal( supabase, await loadJournal( supabase, recordId ) );
            if( !journal ) return { ok: false, message: MESSAGES.notReady };
            if( journal.analysis_status === "analyzing" ) return { ok: false, message: MESSAGES.analyzing, journal: toJournalView( journal ) };

            if( journal.analysis_status === "analyzed" ) {

                // keep the text the score was computed from
                const basedOn = asJourneyAnalysis( journal.analysis )?.reflection;

                if( basedOn && JSON.stringify( basedOn ) !== JSON.stringify( storedReflection( journal ) ) ) {
                    journal = await updateJournal( supabase, journal, reflectionColumns( basedOn ) );
                    if( !journal ) return { ok: false, message: MESSAGES.conflict };
                }

            }
            else if( journal.analysis_status === "failed" ) {

                // the no-AI claim still needs a real report
                const reflection = validateReflection( storedReflection( journal ) );
                if( !reflection.ok ) return { ok: false, message: MESSAGES.invalidReflection, errors: reflection.errors, journal: toJournalView( journal ) };

            }
            else return { ok: false, message: MESSAGES.notReady, journal: toJournalView( journal ) };

            recordIdOut = ( await awardTaskCompletion( supabase, { recordId, projectId, userId: user.id } ) ).recordId;

        }

    } catch( e ) {

        console.error( "[journey] confirmReport", errorMessage( e ) );
        return { ok: false, message: describeConfirmError( e ) };

    }

    redirect( `/project/${projectId}/task_complete?recordId=${recordIdOut}` );

};

/**
 * 作業に戻る: back to the paused timer (time kept). Reflections, the analysis and the run count
 * are kept; after finishing again the user can confirm it or re-analyse with the new time.
 */
export const resumeWork = async ( recordId: number, projectId: string ): Promise<ReportActionResult> => {

    try {

        const supabase = await createActionClient();
        const user = await requireUser( supabase );

        const record = await loadRecord( supabase, recordId, projectId, user.id );
        if( !record || record.status !== "reviewing" ) return { ok: false, message: MESSAGES.notReviewing };

        const journal = await recoverStaleJournal( supabase, await loadJournal( supabase, recordId ) );

        if( journal ) {

            if( journal.confirmed_at ) return { ok: false, message: MESSAGES.confirmed };
            if( journal.analysis_status === "analyzing" ) return { ok: false, message: MESSAGES.analyzing, journal: toJournalView( journal ) };

            if( journal.analysis_status === "needs_clarification" ) {

                // unanswered questions are dropped (marked skipped)
                const settled = await updateJournal( supabase, journal, {
                    analysis_status: hasUsableAnalysis( journal ) ? "analyzed" : "draft",
                    clarifications: settlePendingClarifications( asClarifications( journal.clarifications ), journal.clarification_rounds, null ),
                } );

                if( !settled ) return { ok: false, message: MESSAGES.conflict };

            }

        }

        const { data, error } = await supabase
            .from( "records" )
            .update( { status: "paused", ended_at: null } )
            .eq( "id", recordId ).eq( "project_id", projectId ).eq( "status", "reviewing" )
            .select( "id" );

        if( error ) throw new Error( error.message );
        if( !data?.length ) return { ok: false, message: MESSAGES.notReviewing };

    } catch( e ) {

        console.error( "[journey] resumeWork", errorMessage( e ) );
        return { ok: false, message: MESSAGES.unknown };

    }

    redirect( `/project/${projectId}/onair` );

};
