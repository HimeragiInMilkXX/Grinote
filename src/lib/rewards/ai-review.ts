/**
 * AI review score of a completed task (input `aiScore` of the reward formula).
 *
 * The score comes from the task report analysis (journey system, docs/journey-system.md): the
 * AI rates the user's reflections for effort (relevance 30 + attempt 40 + seriousness 30) and the
 * user confirms it before XP is awarded. Without an analysed report (the analysis failed and the
 * user claimed without AI) this returns `{ score: null, source: "none" }` and the factor is 1.
 * A score is never simulated.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { asJourneyAnalysis, type Verification } from "@/lib/journey/analysis";
import { REWARD_CONFIG } from "./config";

export type AiReviewSource = "none" | "ai";

export interface AiReviewContext {
    supabase: SupabaseClient;
    projectId: string;
    recordId: number;
}

export interface AiReviewResult {
    /** 0..REWARD_CONFIG.aiScoreMax, or null when no review is available. */
    score: number | null;
    source: AiReviewSource;
    /** Model that produced the review. */
    model?: string;
    /** Short conclusion of the review (no raw report or evidence). */
    evidenceSummary?: string;
    reviewedAt?: string;
    /** How the work was verified (self-reported reflections, later uploaded evidence). */
    verification?: Verification;
}

export const NO_AI_REVIEW: AiReviewResult = { score: null, source: "none" };

const SUMMARY_LIMIT = 200;

/** Maps a journal row to the review stored in the reward snapshot (pure, unit-tested). */
export function journalToAiReview( row: { analysis_status: string; ai_score: number | null; analysis: unknown; model: string | null } | null ): AiReviewResult {

    if( !row || row.analysis_status !== "analyzed" || row.ai_score === null ) return NO_AI_REVIEW;

    const analysis = asJourneyAnalysis( row.analysis );
    if( !analysis ) return NO_AI_REVIEW;

    const score = Math.min( REWARD_CONFIG.aiScoreMax, Math.max( 0, Math.round( row.ai_score ) ) );
    if( !Number.isFinite( score ) ) return NO_AI_REVIEW;

    return {
        score,
        source: "ai",
        model: row.model ?? analysis.model,
        evidenceSummary: analysis.conclusion.slice( 0, SUMMARY_LIMIT ),
        reviewedAt: analysis.analyzedAt,
        verification: analysis.verification,
    };

}

export async function getAiReviewScore( { supabase, projectId, recordId }: AiReviewContext ): Promise<AiReviewResult> {

    const { data, error } = await supabase
        .from( "task_journals" )
        .select( "analysis_status, ai_score, analysis, model" )
        .eq( "record_id", recordId ).eq( "project_id", projectId )
        .maybeSingle();

    if( error ) throw new Error( error.message );

    return journalToAiReview( data );

}
