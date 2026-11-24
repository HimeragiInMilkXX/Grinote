/**
 * AI review score for a completed task (input `aiScore` of the reward formula).
 *
 * PLACEHOLDER: there is no AI review yet, so this always returns `{ score: null, source: "none" }`
 * and the AI factor is exactly 1. The UI shows it as 準備中, never as a real score.
 * See docs/ai-review-integration.md for how to replace this with the real review.
 */

export type AiReviewSource = "none" | "ai";

export interface AiReviewContext {
    projectId: string;
    recordId: number;
    nodeId: string;
}

export interface AiReviewResult {
    /** 0..REWARD_CONFIG.aiScoreMax, or null when no review is available. */
    score: number | null;
    source: AiReviewSource;
}

export async function getAiReviewScore( _ctx: AiReviewContext ): Promise<AiReviewResult> {

    return { score: null, source: "none" };

}
