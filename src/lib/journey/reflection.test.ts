import { describe, expect, it } from "vitest";
import { REFLECTION_MAX_LENGTH, toReflectionDraft, validateClarificationAnswers, validateReflection } from "./reflection";

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
