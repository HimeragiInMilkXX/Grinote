import { describe, expect, it } from "vitest";
import { isReflectionComplete, isReflectionEmpty, REFLECTION_MAX_LENGTH, toReflectionDraft, validateClarificationAnswers, validateReflection, validateReport } from "./reflection";

describe( "validateReflection", () => {

    it( "accepts three answers and trims them", () => {
        const r = validateReflection( { learned: "  用語が分かった  ", difficult: "図が難しかった", next: "解説を探す" } );
        expect( r ).toEqual( { ok: true, value: { learned: "用語が分かった", difficult: "図が難しかった", next: "解説を探す" } } );
    });

    it( "requires every answer", () => {
        const r = validateReflection( { learned: "用語が分かった", difficult: "   ", next: "" } );
        expect( r.ok ).toBe( false );
        if( !r.ok ) {
            expect( Object.keys( r.errors ).sort() ).toEqual( [ "difficult", "next" ] );
        }
    });

    it( "rejects too short and too long answers", () => {
        expect( validateReflection( { learned: "ok", difficult: "図が難しかった", next: "解説を探す" } ).ok ).toBe( false );
        expect( validateReflection( { learned: "あ".repeat( REFLECTION_MAX_LENGTH + 1 ), difficult: "図が難しかった", next: "解説を探す" } ).ok ).toBe( false );
    });

    it( "rejects non-objects", () => {
        expect( validateReflection( null ).ok ).toBe( false );
        expect( validateReflection( { learned: 1, difficult: 2, next: 3 } ).ok ).toBe( false );
    });

});

describe( "validateReport", () => {

    it( "needs every answer without evidence", () => {
        expect( validateReport( { learned: "", difficult: "", next: "" }, { hasEvidence: false } ).ok ).toBe( false );
    });

    it( "makes the answers optional with evidence, but keeps the max length", () => {
        expect( validateReport( { learned: " ", difficult: "", next: "" }, { hasEvidence: true } ) ).toEqual( { ok: true, value: { learned: "", difficult: "", next: "" } } );
        expect( validateReport( { learned: "ok", difficult: "", next: "" }, { hasEvidence: true } ).ok ).toBe( true );
        expect( validateReport( { learned: "あ".repeat( REFLECTION_MAX_LENGTH + 1 ), difficult: "", next: "" }, { hasEvidence: true } ).ok ).toBe( false );
        expect( validateReport( null, { hasEvidence: true } ).ok ).toBe( false );
    });

    it( "tells empty and complete reflections apart", () => {
        expect( isReflectionEmpty( { learned: " ", difficult: "", next: "" } ) ).toBe( true );
        expect( isReflectionEmpty( { learned: "a", difficult: "", next: "" } ) ).toBe( false );
        expect( isReflectionComplete( { learned: "用語が分かった", difficult: "図が難しかった", next: "解説を探す" } ) ).toBe( true );
        expect( isReflectionComplete( { learned: "用語が分かった", difficult: "", next: "解説を探す" } ) ).toBe( false );
    });

});

describe( "toReflectionDraft", () => {

    it( "keeps strings, drops other values and caps the length", () => {
        expect( toReflectionDraft( { learned: "a", difficult: 3 } ) ).toEqual( { learned: "a", difficult: "", next: "" } );
        expect( toReflectionDraft( null ).learned ).toBe( "" );
        expect( toReflectionDraft( { next: "x".repeat( REFLECTION_MAX_LENGTH + 10 ) } ).next.length ).toBe( REFLECTION_MAX_LENGTH );
    });

});

describe( "validateClarificationAnswers", () => {

    it( "needs one non-empty answer per question", () => {
        expect( validateClarificationAnswers( [ "q1", "q2" ], [ " a ", "b" ] ) ).toEqual( { ok: true, value: [ "a", "b" ] } );
        expect( validateClarificationAnswers( [ "q1", "q2" ], [ "a" ] ).ok ).toBe( false );
        expect( validateClarificationAnswers( [ "q1" ], [ "  " ] ).ok ).toBe( false );
        expect( validateClarificationAnswers( [ "q1" ], "a" ).ok ).toBe( false );
    });

});
