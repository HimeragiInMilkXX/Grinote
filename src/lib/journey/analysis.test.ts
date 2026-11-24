import { describe, expect, it } from "vitest";
import { asJourneyAnalysis, clampRubric, normalizeAnalysis, parseLooseJson } from "./analysis";

const NOW = new Date( "2026-11-24T03:00:00Z" );

const full = {
    decision: "analyze",
    clarifying_questions: [],
    did: "教科書の第1章を読んだ",
    achieved: "用語を理解した",
    struggles: "図の読み方",
    next_actions: [ { kind: "break_down", detail: "第2章を節ごとに分ける" }, { kind: "nonsense", detail: "続ける" }, { kind: "review", detail: "" } ],
    conclusion: "よく頑張りました。",
    relevance: 25,
    relevance_reason: "タスクに沿っている",
    attempt: 38.6,
    attempt_reason: "難しくても挑戦した",
    seriousness: 99,
    seriousness_reason: "具体的に書いている",
};

const opts = { canClarify: true, hasEvidence: false, model: "gemma4:12b", now: NOW };

describe( "normalizeAnalysis", () => {

    it( "sums the clamped rubric in code and sets self_report", () => {
        const r = normalizeAnalysis( full, opts );
        expect( r.kind ).toBe( "analysis" );
        if( r.kind !== "analysis" ) return;
        expect( r.analysis.rubric.relevance.score ).toBe( 25 );
        expect( r.analysis.rubric.attempt.score ).toBe( 39 );
        expect( r.analysis.rubric.seriousness.score ).toBe( 30 );
        expect( r.analysis.score ).toBe( 94 );
        expect( r.analysis.verification ).toBe( "self_report" );
        expect( r.analysis.forcedFinal ).toBe( false );
        expect( r.analysis.analyzedAt ).toBe( NOW.toISOString() );
    });

    it( "maps unknown action kinds to continue and drops empty ones", () => {
        const r = normalizeAnalysis( full, opts );
        if( r.kind !== "analysis" ) throw new Error( "expected analysis" );
        expect( r.analysis.nextActions ).toEqual( [ { kind: "break_down", detail: "第2章を節ごとに分ける" }, { kind: "continue", detail: "続ける" } ] );
    });

    it( "never goes below 0 or takes non-numbers", () => {
        const r = normalizeAnalysis( { ...full, relevance: -5, attempt: "abc", seriousness: "12" }, opts );
        if( r.kind !== "analysis" ) throw new Error( "expected analysis" );
        expect( r.analysis.score ).toBe( 12 );
    });

    it( "returns questions when clarifying is allowed", () => {
        const r = normalizeAnalysis( { ...full, decision: "clarify", clarifying_questions: [ " 何ページ読んだ？ ", "", "どこで止まった？", "三つ目" ] }, opts );
        expect( r ).toEqual( { kind: "clarify", questions: [ "何ページ読んだ？", "どこで止まった？" ] } );
    });

    it( "uses the analysis when it may not clarify", () => {
        const r = normalizeAnalysis( { ...full, decision: "clarify", clarifying_questions: [ "q" ] }, { ...opts, canClarify: false } );
        expect( r.kind ).toBe( "analysis" );
        if( r.kind === "analysis" ) expect( r.analysis.forcedFinal ).toBe( true );
    });

    it( "is invalid when it must judge but only asked", () => {
        const r = normalizeAnalysis( { decision: "clarify", clarifying_questions: [ "q" ], did: "", conclusion: "" }, { ...opts, canClarify: false } );
        expect( r.kind ).toBe( "invalid" );
    });

    it( "is invalid without did/conclusion or for non-objects", () => {
        expect( normalizeAnalysis( { ...full, conclusion: "  " }, opts ).kind ).toBe( "invalid" );
        expect( normalizeAnalysis( null, opts ).kind ).toBe( "invalid" );
        expect( normalizeAnalysis( "text", opts ).kind ).toBe( "invalid" );
    });

    it( "marks evidence verification only when evidence exists", () => {
        const r = normalizeAnalysis( full, { ...opts, hasEvidence: true } );
        if( r.kind === "analysis" ) expect( r.analysis.verification ).toBe( "evidence" );
    });

});

describe( "clampRubric", () => {
    it( "rounds and clamps", () => {
        expect( clampRubric( 31, 30 ) ).toBe( 30 );
        expect( clampRubric( 2.4, 30 ) ).toBe( 2 );
        expect( clampRubric( NaN, 30 ) ).toBe( 0 );
        expect( clampRubric( undefined, 30 ) ).toBe( 0 );
    });
});

describe( "asJourneyAnalysis", () => {
    it( "accepts a stored analysis and rejects other shapes", () => {
        const r = normalizeAnalysis( full, opts );
        if( r.kind !== "analysis" ) throw new Error( "expected analysis" );
        expect( asJourneyAnalysis( JSON.parse( JSON.stringify( r.analysis ) ) ) ).not.toBeNull();
        expect( asJourneyAnalysis( { score: 3 } ) ).toBeNull();
        expect( asJourneyAnalysis( null ) ).toBeNull();
    });
});

describe( "parseLooseJson", () => {
    it( "parses plain, fenced and wrapped JSON", () => {
        expect( parseLooseJson( "{\"a\":1}" ) ).toEqual( { a: 1 } );
        expect( parseLooseJson( "```json\n{\"a\":1}\n```" ) ).toEqual( { a: 1 } );
        expect( parseLooseJson( "<think>hmm {x}</think>Here: {\"a\":1} done" ) ).toEqual( { a: 1 } );
        expect( parseLooseJson( "no json" ) ).toBeUndefined();
        expect( parseLooseJson( "" ) ).toBeUndefined();
    });
});
