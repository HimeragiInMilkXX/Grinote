import { describe, expect, it, vi } from "vitest";
import type { LanguageModelV4, LanguageModelV4CallOptions, LanguageModelV4StreamPart } from "@ai-sdk/provider";

import { createFallbackModel } from "./fallback";

type Behaviour =
    | { throws: unknown }
    | { parts: LanguageModelV4StreamPart[] };

function mockModel( modelId: string, behaviour: Behaviour ) {

    const calls: LanguageModelV4CallOptions[] = [];

    const model = {
        specificationVersion: "v4",
        provider: "mock",
        modelId,
        supportedUrls: {},
        async doGenerate( options: LanguageModelV4CallOptions ) {
            calls.push( options );
            if( "throws" in behaviour ) throw behaviour.throws;
            return { content: [ { type: "text", text: modelId } ], finishReason: { unified: "stop", raw: "stop" }, usage: {}, warnings: [] };
        },
        async doStream( options: LanguageModelV4CallOptions ) {
            calls.push( options );
            if( "throws" in behaviour ) throw behaviour.throws;
            const parts = behaviour.parts;
            return {
                stream: new ReadableStream<LanguageModelV4StreamPart>( {
                    start( controller ) {
                        for( const part of parts ) controller.enqueue( part );
                        controller.close();
                    },
                } ),
            };
        },
    } as unknown as LanguageModelV4;

    return { model, calls };

}

const options = { prompt: [] } as unknown as LanguageModelV4CallOptions;

const start = { type: "stream-start", warnings: [] } as LanguageModelV4StreamPart;
const text = ( delta: string ) => ( { type: "text-delta", id: "t", delta } ) as LanguageModelV4StreamPart;
const error = ( e: unknown ) => ( { type: "error", error: e } ) as LanguageModelV4StreamPart;

async function readAll( stream: ReadableStream<LanguageModelV4StreamPart> ) {
    const parts: LanguageModelV4StreamPart[] = [];
    const reader = stream.getReader();
    while( true ) {
        const { done, value } = await reader.read();
        if( done ) return parts;
        parts.push( value );
    }
}

describe( "createFallbackModel", () => {

    it( "moves on when a model throws, and remembers the one that worked", async () => {
        const gemini = mockModel( "gemini", { throws: new Error( "401" ) } );
        const local = mockModel( "local", { parts: [ start, text( "hi" ) ] } );
        const onFallback = vi.fn();
        const onModel = vi.fn();

        const model = createFallbackModel( [ { model: gemini.model }, { model: local.model } ], { onFallback, onModel } );

        const first = await model.doStream( options );
        expect( await readAll( first.stream ) ).toEqual( [ start, text( "hi" ) ] );
        expect( onFallback ).toHaveBeenCalledWith( expect.objectContaining( { from: "gemini", to: "local" } ) );
        expect( onModel ).toHaveBeenLastCalledWith( "local" );

        await model.doStream( options );
        expect( gemini.calls ).toHaveLength( 1 );
        expect( local.calls ).toHaveLength( 2 );
    });

    it( "moves on when the first real stream part is an error", async () => {
        const gemini = mockModel( "gemini", { parts: [ start, error( new Error( "quota" ) ) ] } );
        const local = mockModel( "local", { parts: [ text( "ok" ) ] } );

        const model = createFallbackModel( [ { model: gemini.model }, { model: local.model } ] );
        const result = await model.doStream( options );

        expect( await readAll( result.stream ) ).toEqual( [ text( "ok" ) ] );
    });

    it( "never switches once output has started", async () => {
        const gemini = mockModel( "gemini", { parts: [ start, text( "a" ), error( "later" ) ] } );
        const local = mockModel( "local", { parts: [ text( "b" ) ] } );

        const model = createFallbackModel( [ { model: gemini.model }, { model: local.model } ] );
        const result = await model.doStream( options );

        expect( await readAll( result.stream ) ).toEqual( [ start, text( "a" ), error( "later" ) ] );
        expect( local.calls ).toHaveLength( 0 );
    });

    it( "does not fall back after an abort", async () => {
        const controller = new AbortController();
        controller.abort();
        const gemini = mockModel( "gemini", { throws: new Error( "aborted" ) } );
        const local = mockModel( "local", { parts: [ text( "b" ) ] } );

        const model = createFallbackModel( [ { model: gemini.model }, { model: local.model } ] );

        await expect( model.doStream( { ...options, abortSignal: controller.signal } ) ).rejects.toThrow( "aborted" );
        expect( local.calls ).toHaveLength( 0 );
    });

    it( "throws the last error when every model fails", async () => {
        const a = mockModel( "a", { throws: new Error( "a" ) } );
        const b = mockModel( "b", { throws: new Error( "b" ) } );

        const model = createFallbackModel( [ { model: a.model }, { model: b.model } ] );

        await expect( model.doGenerate( options ) ).rejects.toThrow( "b" );
    });

    it( "applies per-model call options", async () => {
        const gemini = mockModel( "gemini", { throws: new Error( "x" ) } );
        const local = mockModel( "local", { parts: [] } );

        const model = createFallbackModel( [ { model: gemini.model }, { model: local.model, callOptions: { temperature: 0 } } ] );
        await model.doGenerate( { ...options, temperature: undefined } );

        expect( gemini.calls[0].temperature ).toBeUndefined();
        expect( local.calls[0].temperature ).toBe( 0 );
    });

});
