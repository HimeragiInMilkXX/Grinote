/**
 * What the model fills for a next action. Kept flat and loose on purpose (small local models):
 * keys, kinds and days are checked in `normalizeNextAction`, never trusted.
 * Keep the `.describe()` texts consistent with NEXT_ACTION_SYSTEM_PROMPT (prompt.ts).
 */

import { z } from "zod";

export const modelNextActionSchema = z.object( {
    kind: z.string().describe( "\"progress\" (one task) or \"practice_progress\" (one repeating task + one task)" ),
    progress_key: z.string().describe( "key of the main task from the candidate list, e.g. \"c2\"" ),
    practice_key: z.string().describe( "practice_progress only: key of a repeating candidate; empty string for progress" ),
    when: z.string().describe( "\"today\" or \"next_work_day\"" ),
    progress_reason: z.string().describe( "Japanese, 1-2 sentences: why this task is the right next step" ),
    practice_reason: z.string().describe( "Japanese, 1 sentence: why this practice helps; empty string for progress" ),
    message: z.string().describe( "Japanese, 1-2 short encouraging sentences to the user about the plan" ),
} );

export type ModelNextAction = z.infer<typeof modelNextActionSchema>;
