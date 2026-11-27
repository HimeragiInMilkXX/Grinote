import "server-only";

import { generateText, NoObjectGeneratedError, NoOutputGeneratedError, Output } from "ai";
import { describeChatError } from "@/lib/ai/errors";
import { getModelWithFallback } from "@/lib/ai/provider";
import { getJourneyModelId } from "@/lib/journey/analyze";
import { parseLooseJson } from "@/lib/journey/analysis";
import type { PlanIntent } from "./config";
import type { PlanCandidate } from "./candidates";
import { normalizeNextAction, type PlanSuggestion } from "./normalize";
import { buildNextActionPrompt, NEXT_ACTION_SYSTEM_PROMPT, type NextActionPromptInput } from "./prompt";
import { modelNextActionSchema } from "./schema";
import type { ScheduleContext } from "./schedule";

const TIMEOUT_MS = 90_000;
const MAX_ATTEMPTS = 2;

export const NEXT_ACTION_INVALID_MESSAGE = "AIのおすすめを読み取れませんでした。もう一度お試しいただくか、自分で選んでください。";

export type NextActionRun = { ok: true; model: string; suggestion: PlanSuggestion } | { ok: false; model: string; message: string };

export interface NextActionRunInput {
    prompt: NextActionPromptInput;
    candidates: readonly PlanCandidate[];
    intent: PlanIntent | null;
    schedule: ScheduleContext;
}

/**
 * Asks the model for a next action (same model chain as the report analysis). Never throws:
 * provider errors and unusable answers come back as `{ ok: false, message }` in Japanese.
 */
export async function runNextActionGeneration( input: NextActionRunInput ): Promise<NextActionRun> {

    const selectedModelId = getJourneyModelId();
    let modelId = selectedModelId;
    const model = getModelWithFallback( selectedModelId, {
        structured: true,
        localCallOptions: { temperature: 0 },
        onModel: id => { modelId = id; },
    } );
    const basePrompt = buildNextActionPrompt( input.prompt );

    let note = "";

    for( let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++ ) {

        let raw: unknown;

        try {

            const result = await generateText( {
                model,
                system: NEXT_ACTION_SYSTEM_PROMPT,
                prompt: basePrompt + note,
                output: Output.object( { schema: modelNextActionSchema } ),
                maxOutputTokens: 4096,
                maxRetries: 1,
                abortSignal: AbortSignal.timeout( TIMEOUT_MS ),
            } );

            try {
                raw = result.output;
            } catch( outputError ) {
                if( !NoOutputGeneratedError.isInstance( outputError ) ) throw outputError;
                raw = parseLooseJson( result.text );
                console.warn( "[next-action] no structured output", { attempt, model: modelId, finishReason: result.finishReason } );
            }

        } catch( error ) {

            if( NoObjectGeneratedError.isInstance( error ) ) {
                raw = parseLooseJson( error.text );
                if( raw === undefined ) console.warn( "[next-action] unparseable output", { attempt, model: modelId } );
            }
            else {
                console.error( "[next-action] generation failed", error );
                return { ok: false, model: modelId, message: describeChatError( error, modelId ) };
            }

        }

        const normalized = normalizeNextAction( raw, input.candidates, { intent: input.intent, schedule: input.schedule } );

        if( normalized.ok ) return { ok: true, model: modelId, suggestion: normalized.value };

        console.warn( "[next-action] invalid output", { attempt, reason: normalized.reason } );

        note = `\n\nYour previous answer could not be used (${normalized.reason}). Return ONLY the JSON object with every key filled in, using candidate keys only.`;

    }

    return { ok: false, model: modelId, message: NEXT_ACTION_INVALID_MESSAGE };

}
