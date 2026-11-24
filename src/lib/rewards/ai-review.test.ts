import { describe, expect, it } from "vitest";
import { normalizeAnalysis } from "@/lib/journey/analysis";
import { journalToAiReview, NO_AI_REVIEW } from "./ai-review";

const analysis = ( () => {
    const r = normalizeAnalysis( {
        decision: "analyze", clarifying_questions: [], did: "読んだ", achieved: "理解", struggles: "図", next_actions: [],
        conclusion: "よく頑張りました。".repeat( 40 ), relevance: 20, relevance_reason: "", attempt: 30, attempt_reason: "", seriousness: 20, seriousness_reason: "",
    }, { canClarify: false, hasEvidence: false, model: "m", now: new Date( "2026-11-24T00:00:00Z" ) } );
    if( r.kind !== "analysis" ) throw new Error( "fixture" );
    return r.analysis;
} )();

describe( "journalToAiReview", () => {

    it( "uses the analysed score with a short summary", () => {
        const r = journalToAiReview( { analysis_status: "analyzed", ai_score: 70, analysis, model: "gemma4:12b" } );
        expect( r ).toMatchObject( { score: 70, source: "ai", model: "gemma4:12b", verification: "self_report", reviewedAt: "2026-11-24T00:00:00.000Z" } );
        expect( r.evidenceSummary!.length ).toBeLessThanOrEqual( 200 );
    });

    it( "gives no review without an analysed journal", () => {
        expect( journalToAiReview( null ) ).toEqual( NO_AI_REVIEW );
        expect( journalToAiReview( { analysis_status: "failed", ai_score: null, analysis: null, model: null } ) ).toEqual( NO_AI_REVIEW );
        expect( journalToAiReview( { analysis_status: "draft", ai_score: 50, analysis, model: null } ) ).toEqual( NO_AI_REVIEW );
        expect( journalToAiReview( { analysis_status: "analyzed", ai_score: 50, analysis: { broken: true }, model: null } ) ).toEqual( NO_AI_REVIEW );
    });

    it( "clamps the stored score", () => {
        expect( journalToAiReview( { analysis_status: "analyzed", ai_score: 150, analysis, model: null } ).score ).toBe( 100 );
    });

});
