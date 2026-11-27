/**
 * `task_journals` rows (one per record) and the client-safe view of them.
 * Status flow: draft → analyzing → (needs_clarification ↔ analyzing) → analyzed | failed → confirmed | confirmed_without_ai.
 * 'analyzing' is set while the model runs, so the report can't be confirmed with a stale result meanwhile.
 */

import { asJourneyAnalysis, type JourneyAnalysis, type Verification } from "./analysis";
import { asEvidenceItems, type EvidenceItem } from "./evidence";
import type { ClarificationEntry } from "./prompt";
import { toReflectionDraft, type Reflection } from "./reflection";

export const MAX_ANALYSIS_RUNS = 3;
export const MAX_CLARIFICATION_ROUNDS = 2;

/**
 * An 'analyzing' journal older than this was interrupted (the run itself times out well before:
 * about 4 min, and about 5 with evidence uploads to Gemini).
 */
export const ANALYZING_STALE_MS = 8 * 60 * 1000;

export type JournalStatus = "draft" | "analyzing" | "needs_clarification" | "analyzed" | "failed" | "confirmed" | "confirmed_without_ai";

export interface TaskJournalRow {
    record_id: number;
    project_id: string;
    user_id: string;
    node_id: string;
    task_name: string;
    task_description: string | null;
    estimated_minutes: number | string | null;
    reflection_learned: string | null;
    reflection_difficult: string | null;
    reflection_next: string | null;
    clarifications: unknown;
    evidence: unknown;
    verification: Verification;
    analysis: unknown;
    ai_score: number | null;
    model: string | null;
    analysis_status: JournalStatus;
    analysis_runs: number;
    clarification_rounds: number;
    analyzed_at: string | null;
    confirmed_at: string | null;
    created_at: string;
    updated_at: string;
}

export interface JournalView {
    recordId: number;
    status: JournalStatus;
    reflection: Reflection;
    clarifications: ClarificationEntry[];
    /** Questions of the current round still waiting for an answer. */
    pendingQuestions: string[];
    /** Uploaded files (photos / videos / audio); the AI's per-file reports are in `analysis.evidence`. */
    evidence: EvidenceItem[];
    verification: Verification;
    analysis: JourneyAnalysis | null;
    aiScore: number | null;
    model: string | null;
    analysisRuns: number;
    clarificationRounds: number;
    analyzedAt: string | null;
    confirmedAt: string | null;
}

export function asClarifications( value: unknown ): ClarificationEntry[] {

    if( !Array.isArray( value ) ) return [];

    return value
        .filter( ( c ): c is Record<string, unknown> => !!c && typeof c === "object" )
        .map( c => ( {
            round: Number( c.round ) || 1,
            question: typeof c.question === "string" ? c.question : "",
            answer: typeof c.answer === "string" ? c.answer : "",
            skipped: c.skipped === true,
        } ) )
        .filter( c => c.question.length > 0 );

}

/** Questions of the latest round that have neither an answer nor a skip. */
export function pendingQuestionsOf( status: JournalStatus, clarifications: readonly ClarificationEntry[], rounds: number ): string[] {

    if( status !== "needs_clarification" ) return [];

    return clarifications.filter( c => c.round === rounds && !c.skipped && c.answer === "" ).map( c => c.question );

}

/** Answered (or skipped) clarifications only: what the model and the journey show. */
export function settledClarifications( clarifications: readonly ClarificationEntry[] ): ClarificationEntry[] {

    return clarifications.filter( c => c.skipped || c.answer !== "" );

}

/** Fill the pending entries of the latest round with answers, or mark them skipped. */
export function settlePendingClarifications( clarifications: readonly ClarificationEntry[], rounds: number, answers: readonly string[] | null ): ClarificationEntry[] {

    let i = 0;

    return clarifications.map( c => {

        if( c.round !== rounds || c.skipped || c.answer !== "" ) return c;

        const answer = answers ? answers[ i++ ] ?? "" : "";

        return answers && answer ? { ...c, answer } : { ...c, answer: "", skipped: true };

    } );

}

/** The status an interrupted 'analyzing' journal goes back to (null = nothing to recover). */
export function recoveredStatus( row: Pick<TaskJournalRow, "analysis_status" | "analysis" | "ai_score" | "updated_at">, now: Date = new Date() ): JournalStatus | null {

    if( row.analysis_status !== "analyzing" ) return null;
    if( now.getTime() - new Date( row.updated_at ).getTime() < ANALYZING_STALE_MS ) return null;

    return row.analysis != null && row.ai_score != null ? "analyzed" : "failed";

}

export function toJournalView( row: TaskJournalRow ): JournalView {

    const clarifications = asClarifications( row.clarifications );

    return {
        recordId: row.record_id,
        status: row.analysis_status,
        reflection: toReflectionDraft( { learned: row.reflection_learned, difficult: row.reflection_difficult, next: row.reflection_next } ),
        clarifications,
        pendingQuestions: pendingQuestionsOf( row.analysis_status, clarifications, row.clarification_rounds ),
        evidence: asEvidenceItems( row.evidence ),
        verification: row.verification,
        analysis: asJourneyAnalysis( row.analysis ),
        aiScore: row.ai_score,
        model: row.model,
        analysisRuns: row.analysis_runs,
        clarificationRounds: row.clarification_rounds,
        analyzedAt: row.analyzed_at,
        confirmedAt: row.confirmed_at,
    };

}

export const VERIFICATION_LABELS: Record<Verification, string> = {
    self_report: "自己申告",
    evidence: "証拠あり",
};

/**
 * Files uploaded after the current analysis was made (they weren't looked at). Confirming is
 * refused while any exist: the user re-analyses or deletes them. Removed files are fine.
 */
export function evidenceAddedAfterAnalysis( evidence: readonly EvidenceItem[], analysis: JourneyAnalysis | null ): EvidenceItem[] {

    if( !analysis ) return [];

    const seen = new Set( ( analysis.evidence ?? [] ).map( e => e.id ) );

    return evidence.filter( e => !seen.has( e.id ) );

}
