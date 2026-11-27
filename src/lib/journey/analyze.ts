import "server-only";

import { generateText, NoObjectGeneratedError, NoOutputGeneratedError, Output, type FilePart, type LanguageModel, type UserContent } from "ai";
import { describeChatError, modelNotFoundMessage } from "@/lib/ai/errors";
import { getDefaultModelId, getModelWithFallback, getStructuredModel } from "@/lib/ai/provider";
import { evidenceKey, modelAnalysisSchema, modelEvidenceAnalysisSchema, normalizeAnalysis, parseLooseJson, type EvidenceInput, type JourneyAnalysis } from "./analysis";
import { analysisSystemPrompt, buildAnalysisPrompt, type AnalysisPromptInput } from "./prompt";
import { isReflectionEmpty } from "./reflection";

const TIMEOUT_MS = 120_000;
/** Whole run, evidence uploads and fallback included (well under ANALYZING_STALE_MS). */
export const RUN_BUDGET_MS = 5 * 60_000;
const MAX_ATTEMPTS = 2;

export const INVALID_OUTPUT_MESSAGE = "AIの分析結果を読み取れませんでした。もう一度お試しください。";
export const MODEL_MISSING_MESSAGE = "分析用のAIモデルが見つかりません。時間をおいて再試行するか、AIなしで経験値を受け取ってください。";
export const EVIDENCE_FAILED_MESSAGE = "証拠のファイルをAIが分析できませんでした。時間をおいて再試行するか、振り返りを書いてから分析してください。";

/** Model used for report analysis. `JOURNEY_AI_MODEL` overrides the default chat model (Gemini falls back to the local models). */
export function getJourneyModelId(): string {

    return process.env.JOURNEY_AI_MODEL?.trim() || getDefaultModelId();

}

export type JourneyAnalysisRun =
    | { ok: true; model: string; result: { kind: "clarify"; questions: string[] } | { kind: "analysis"; analysis: JourneyAnalysis } }
    | { ok: false; model: string; message: string };

/** Evidence ready for the multimodal model (`parts[i]` null = file i couldn't be given). */
export interface EvidenceForRun {
    modelId: string;
    parts: readonly ( FilePart | null )[];
}

type Attempt =
    | JourneyAnalysisRun
    | { ok: false; model: string; message: string; providerError: true };

/**
 * Runs the attempts against one model (plus one retry for unusable output). Provider errors come
 * back with `providerError` so the caller can fall back.
 */
async function attemptAnalysis( args: {
    model: LanguageModel;
    modelId: () => string;
    system: string;
    content: ( note: string ) => string | UserContent;
    withEvidence: boolean;
    input: AnalysisPromptInput;
    evidence: readonly EvidenceInput[];
    signal: AbortSignal;
} ): Promise<Attempt> {

    const { input } = args;
    let note = "";

    for( let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++ ) {

        let raw: unknown;

        try {

            const content = args.content( note );

            const result = await generateText( {
                model: args.model,
                system: args.system,
                ...( typeof content === "string" ? { prompt: content } : { messages: [ { role: "user" as const, content } ] } ),
                output: Output.object( { schema: args.withEvidence ? modelEvidenceAnalysisSchema : modelAnalysisSchema } ),
                maxOutputTokens: 8192,
                maxRetries: 1,
                abortSignal: AbortSignal.any( [ args.signal, AbortSignal.timeout( TIMEOUT_MS ) ] ),
            } );

            try {
                raw = result.output;
            } catch( outputError ) {
                // empty or cut-off answer (e.g. a thinking model spent its tokens): salvage the text, else retry
                if( !NoOutputGeneratedError.isInstance( outputError ) ) throw outputError;
                raw = parseLooseJson( result.text );
                console.warn( "[journey] no structured output", { attempt, model: args.modelId(), finishReason: result.finishReason } );
            }

        } catch( error ) {

            if( NoObjectGeneratedError.isInstance( error ) ) {
                // schema validation failed: try to salvage the text (ranges are checked by normalizeAnalysis)
                raw = parseLooseJson( error.text );
                if( raw === undefined ) console.warn( "[journey] unparseable analysis output", { attempt, model: args.modelId() } );
            }
            else {
                const modelId = args.modelId();
                console.error( "[journey] analysis failed", modelId, error );
                const message = describeChatError( error, modelId );
                // the report page has no model picker (the chat message says to choose another model)
                return { ok: false, model: modelId, message: message === modelNotFoundMessage( modelId ) ? MODEL_MISSING_MESSAGE : message, providerError: true };
            }

        }

        const normalized = normalizeAnalysis( raw, { canClarify: input.canClarify, evidence: args.evidence, model: args.modelId() } );

        if( normalized.kind !== "invalid" ) return { ok: true, model: args.modelId(), result: normalized };

        console.warn( "[journey] invalid analysis output", { attempt, reason: normalized.reason } );

        note = `\n\nYour previous answer could not be used (${normalized.reason}). Return ONLY the JSON object with every key filled in${input.canClarify ? "" : ", decision \"analyze\""}.`;

    }

    return { ok: false, model: args.modelId(), message: INVALID_OUTPUT_MESSAGE };

}

const strip = ( a: Attempt ): JourneyAnalysisRun => a.ok ? a : { ok: false, model: a.model, message: a.message };

/**
 * Runs the report analysis. Never throws: provider errors and bad output come back as
 * `{ ok: false, message }` in Japanese.
 *
 * With evidence: the files go to the multimodal (Gemini) model together with the report. If that
 * model fails before answering, the report is analysed text-only by the usual chain with every
 * file marked "not given" (so the result stays self_report), unless there's no written answer
 * to judge, then the run fails. A file is never reported as checked when the model didn't get it.
 */
export async function runJourneyAnalysis( input: AnalysisPromptInput, evidence?: EvidenceForRun, signal: AbortSignal = AbortSignal.timeout( RUN_BUDGET_MS ) ): Promise<JourneyAnalysisRun> {

    const items = input.evidence ?? [];

    if( evidence && evidence.parts.some( Boolean ) ) {

        const sentInputs = items.map( ( e, i ) => ( { ...e, sent: !!evidence.parts[ i ] } ) );
        const promptInput = { ...input, evidence: sentInputs };
        const base = buildAnalysisPrompt( promptInput );

        const content = ( note: string ): UserContent => [
            ...evidence.parts.flatMap( ( part, i ) => part ? [ { type: "text" as const, text: `Evidence ${evidenceKey( i )}:` }, part ] : [] ),
            { type: "text" as const, text: base + note },
        ];

        const run = await attemptAnalysis( {
            model: getStructuredModel( evidence.modelId ),
            modelId: () => evidence.modelId,
            system: analysisSystemPrompt( { withEvidence: true } ),
            content,
            withEvidence: true,
            input: promptInput,
            evidence: sentInputs,
            signal,
        } );

        if( run.ok || !( "providerError" in run ) ) return strip( run );

        // the multimodal model failed: only a written report can still be analysed (text-only)
        if( isReflectionEmpty( input.reflection ) || signal.aborted ) return { ok: false, model: run.model, message: signal.aborted ? run.message : EVIDENCE_FAILED_MESSAGE };

        console.warn( "[journey] evidence analysis failed, analysing the reflections only" );

    }
    else if( items.length > 0 && isReflectionEmpty( input.reflection ) ) {

        // evidence-only report, but no file could be given to a model
        return { ok: false, model: evidence?.modelId ?? getJourneyModelId(), message: EVIDENCE_FAILED_MESSAGE };

    }

    const textInputs = items.map( e => ( { ...e, sent: false } ) );
    const textInput = { ...input, evidence: textInputs };

    const selectedModelId = getJourneyModelId();
    // the model that actually answered (a fallback when Gemini failed) is the one recorded
    let modelId = selectedModelId;
    const model = getModelWithFallback( selectedModelId, {
        structured: true,
        // Gemini keeps its default temperature; the local models stay deterministic
        localCallOptions: { temperature: 0 },
        onModel: id => { modelId = id; },
    } );
    const base = buildAnalysisPrompt( textInput );

    return strip( await attemptAnalysis( {
        model,
        modelId: () => modelId,
        system: analysisSystemPrompt( { withEvidence: false } ),
        content: note => base + note,
        withEvidence: false,
        input: textInput,
        evidence: textInputs,
        signal,
    } ) );

}
