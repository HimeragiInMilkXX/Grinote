import { describe, expect, it } from "vitest";

import { CHAT_ERROR_MESSAGES, describeChatError, modelNotFoundMessage } from "./errors";

describe( "describeChatError", () => {

    it( "reports a connection failure, even when wrapped in cause", () => {
        const error = new TypeError( "fetch failed", { cause: Object.assign( new Error( "connect ECONNREFUSED 127.0.0.1:11434" ), { code: "ECONNREFUSED" } ) } );
        expect( describeChatError( error, "qwen3" ) ).toBe( CHAT_ERROR_MESSAGES.connection );
    });

    it( "reports a missing model from a 404 APICallError-like object", () => {
        const error = { name: "AI_APICallError", message: "Not Found", statusCode: 404 };
        expect( describeChatError( error, "gemma3" ) ).toBe( modelNotFoundMessage( "gemma3" ) );
    });

    it( "reports a missing model from Ollama's message", () => {
        const error = new Error( `model "qwen3:8b" not found, try pulling it first` );
        expect( describeChatError( error, "qwen3:8b" ) ).toBe( modelNotFoundMessage( "qwen3:8b" ) );
    });

    it( "follows RetryError.lastError", () => {
        const error = { name: "AI_RetryError", message: "Failed after 3 attempts", lastError: new Error( "Request timed out" ) };
        expect( describeChatError( error, "m" ) ).toBe( CHAT_ERROR_MESSAGES.timeout );
    });

    it( "reports a context overflow", () => {
        const error = { message: "Bad Request", statusCode: 400, responseBody: "{\"error\":\"the input exceeds the maximum context length\"}" };
        expect( describeChatError( error, "m" ) ).toBe( CHAT_ERROR_MESSAGES.context );
    });

    it( "reports an invalid Gemini API key", () => {
        const error = { name: "AI_APICallError", message: "API key not valid. Please pass a valid API key.", statusCode: 400 };
        expect( describeChatError( error, "gemini-4-hydrogen" ) ).toBe( CHAT_ERROR_MESSAGES.apiKey );
        expect( describeChatError( { name: "AI_LoadAPIKeyError", message: "Google Generative AI API key is missing." }, "gemini-4-hydrogen" ) ).toBe( CHAT_ERROR_MESSAGES.apiKey );
    });

    it( "reports a Gemini quota error", () => {
        const error = { name: "AI_RetryError", message: "Failed after 3 attempts", lastError: { message: "Resource has been exhausted", statusCode: 429, responseBody: "{\"error\":{\"status\":\"RESOURCE_EXHAUSTED\"}}" } };
        expect( describeChatError( error, "gemini-4-hydrogen" ) ).toBe( CHAT_ERROR_MESSAGES.quota );
    });

    it( "falls back to a generic message", () => {
        expect( describeChatError( new Error( "boom" ), "m" ) ).toBe( CHAT_ERROR_MESSAGES.fallback );
        expect( describeChatError( undefined, "m" ) ).toBe( CHAT_ERROR_MESSAGES.fallback );
    });

});
