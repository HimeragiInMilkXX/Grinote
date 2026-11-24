import { describe, expect, it } from "vitest";
import { asClarifications, pendingQuestionsOf, recoveredStatus, settledClarifications, settlePendingClarifications } from "./journal";

const entries = [
    { round: 1, question: "何ページ？", answer: "10ページ", skipped: false },
    { round: 2, question: "どこで止まった？", answer: "", skipped: false },
    { round: 2, question: "何分休んだ？", answer: "", skipped: false },
];

describe( "clarifications", () => {

    it( "parses stored jsonb and drops broken entries", () => {
        expect( asClarifications( [ { round: "2", question: "q", answer: 3 }, { question: "" }, null, "x" ] ) )
            .toEqual( [ { round: 2, question: "q", answer: "", skipped: false } ] );
        expect( asClarifications( null ) ).toEqual( [] );
    });

    it( "lists the pending questions of the latest round only while clarifying", () => {
        expect( pendingQuestionsOf( "needs_clarification", entries, 2 ) ).toEqual( [ "どこで止まった？", "何分休んだ？" ] );
        expect( pendingQuestionsOf( "analyzed", entries, 2 ) ).toEqual( [] );
    });

    it( "fills answers in order or marks the round skipped", () => {
        const answered = settlePendingClarifications( entries, 2, [ "3ページ目", "5分" ] );
        expect( answered.map( c => c.answer ) ).toEqual( [ "10ページ", "3ページ目", "5分" ] );
        const skipped = settlePendingClarifications( entries, 2, null );
        expect( skipped.map( c => c.skipped ) ).toEqual( [ false, true, true ] );
        expect( settledClarifications( skipped ) ).toHaveLength( 3 );
        expect( settledClarifications( entries ) ).toHaveLength( 1 );
    });

});

describe( "recoveredStatus", () => {

    const now = new Date( "2026-11-24T10:00:00Z" );

    it( "recovers only stale analyzing journals", () => {
        expect( recoveredStatus( { analysis_status: "analyzing", analysis: {}, ai_score: 70, updated_at: "2026-11-24T09:50:00Z" }, now ) ).toBe( "analyzed" );
        expect( recoveredStatus( { analysis_status: "analyzing", analysis: null, ai_score: null, updated_at: "2026-11-24T09:50:00Z" }, now ) ).toBe( "failed" );
        expect( recoveredStatus( { analysis_status: "analyzing", analysis: null, ai_score: null, updated_at: "2026-11-24T09:58:00Z" }, now ) ).toBeNull();
        expect( recoveredStatus( { analysis_status: "analyzed", analysis: {}, ai_score: 70, updated_at: "2026-11-24T09:00:00Z" }, now ) ).toBeNull();
    });

});
