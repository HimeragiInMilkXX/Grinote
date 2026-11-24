import "server-only";

import { generateText, NoObjectGeneratedError, NoOutputGeneratedError, Output } from "ai";
import { describeChatError, modelNotFoundMessage } from "@/lib/ai/errors";
import { getDefaultModelId, getModelWithFallback } from "@/lib/ai/provider";
import { modelAnalysisSchema, normalizeAnalysis, parseLooseJson, type JourneyAnalysis } from "./analysis";
import { ANALYSIS_SYSTEM_PROMPT, buildAnalysisPrompt, type AnalysisPromptInput } from "./prompt";

const TIMEOUT_MS = 120_000;
const MAX_ATTEMPTS = 2;

export const INVALID_OUTPUT_MESSAGE = "AIの分析結果を読み取れませんでした。もう一度お試しください。";
export const MODEL_MISSING_MESSAGE = "分析用のAIモデルが見つかりません。時間をおいて再試行するか、AIなしで経験値を受け取ってください。";

/** Model used for report analysis. `JOURNEY_AI_MODEL` overrides the default chat model (Gemini falls back to the local models). */
export function getJourneyModelId(): string {

    return process.env.JOURNEY_AI_MODEL?.trim() || getDefaultModelId();

}

export type JourneyAnalysisRun =
    | { ok: true; model: string; result: { kind: "clarify"; questions: string[] } | { kind: "analysis"; analysis: JourneyAnalysis } }
    | { ok: false; model: string; message: string };

/**
 * Runs the report analysis once (plus one retry for unusable output). Never throws: provider
 * errors and bad output come back as `{ ok: false, message }` in Japanese.
 */
export async function runJourneyAnalysis( input: AnalysisPromptInput ): Promise<JourneyAnalysisRun> {

    const selectedModelId = getJourneyModelId();
    // the model that actually answered (a fallback when Gemini failed) is the one recorded
    let modelId = selectedModelId;
    const model = getModelWithFallback( selectedModelId, {
        structured: true,
        // Gemini keeps its default temperature; the local models stay deterministic
        localCallOptions: { temperature: 0 },
        onModel: id => { modelId = id; },
    } );
    const basePrompt = buildAnalysisPrompt( input );

    let note = "";

    for( let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++ ) {

        let raw: unknown;

        try {

            const result = await generateText( {
                model,
                system: ANALYSIS_SYSTEM_PROMPT,
                prompt: basePrompt + note,
                output: Output.object( { schema: modelAnalysisSchema } ),
                maxOutputTokens: 8192,
                maxRetries: 1,
                abortSignal: AbortSignal.timeout( TIMEOUT_MS ),
            } );

            try {
                raw = result.output;
            } catch( outputError ) {
                // empty or cut-off answer (e.g. a thinking model spent its tokens): salvage the text, else retry
                if( !NoOutputGeneratedError.isInstance( outputError ) ) throw outputError;
                raw = parseLooseJson( result.text );
                console.warn( "[journey] no structured output", { attempt, model: modelId, finishReason: result.finishReason } );
            }

        } catch( error ) {

            if( NoObjectGeneratedError.isInstance( error ) ) {
                // schema validation failed: try to salvage the text (ranges are checked by normalizeAnalysis)
                raw = parseLooseJson( error.text );
                if( raw === undefined ) console.warn( "[journey] unparseable analysis output", { attempt, model: modelId } );
            }
            else {
                console.error( "[journey] analysis failed", error );
                const message = describeChatError( error, modelId );
                // the report page has no model picker (the chat message says to choose another model)
                return { ok: false, model: modelId, message: message === modelNotFoundMessage( modelId ) ? MODEL_MISSING_MESSAGE : message };
            }

        }

        const normalized = normalizeAnalysis( raw, { canClarify: input.canClarify, hasEvidence: input.hasEvidence, model: modelId } );

        if( normalized.kind !== "invalid" ) return { ok: true, model: modelId, result: normalized };

        console.warn( "[journey] invalid analysis output", { attempt, reason: normalized.reason } );

        note = `\n\nYour previous answer could not be used (${normalized.reason}). Return ONLY the JSON object with every key filled in${input.canClarify ? "" : ", decision \"analyze\""}.`;

    }

    return { ok: false, model: modelId, message: INVALID_OUTPUT_MESSAGE };

}
