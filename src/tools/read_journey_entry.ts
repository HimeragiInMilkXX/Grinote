import { tool } from "ai";
import { z } from "zod";
import { settledClarifications } from "@/lib/journey/journal";
import { dayKey, entryAiFields, loadJourney, minutes } from "./journey-data";

export const readJourneyEntry = tool({
    description:
        "Read the full report of one completed task from the journey: the user's three reflections (what they did/learned/felt, what was difficult, " +
        "what they think comes next), the AI's clarifying questions with the answers, and the AI review (what they did, achieved, struggled with, " +
        "next actions, conclusion, effort score with reasons). Read-only. Get record_id from list_journey.",
    inputSchema: z.object({
        project_id: z.string().describe("The exact active project_id from the system prompt."),
        record_id: z.number().int().describe("record_id of a completed task, from list_journey."),
    }),
    execute: async ({ project_id, record_id }) => {

        const { entries } = await loadJourney( project_id );
        const entry = entries.find( e => e.recordId === record_id );

        if( !entry ) throw new Error( `Journey entry ${record_id} does not exist in this project. Call list_journey for valid record ids.` );

        const journal = entry.journal;
        const analysis = journal?.analysis ?? null;

        return {
            record_id: entry.recordId,
            date: dayKey( entry.completedAt ),
            task_name: entry.taskName,
            task_description: entry.taskDescription,
            estimated_minutes: entry.estimatedMinutes > 0 ? minutes( entry.estimatedMinutes ) : null,
            actual_minutes: minutes( entry.actualMinutes ),
            xp: entry.xp,
            level_before: entry.breakdown?.before.level ?? null,
            level_after: entry.breakdown?.after.level ?? null,
            reflection: journal?.reflection ?? null,
            clarifications: journal ? settledClarifications( journal.clarifications ).map( c => ( { question: c.question, answer: c.skipped ? null : c.answer } ) ) : [],
            review: analysis ? {
                did: analysis.did,
                achieved: analysis.achieved,
                rubric: analysis.rubric,
            } : null,
            ...entryAiFields( entry ),
            note: journal ? null : "Completed before the journey system: no reflections or AI review.",
        };

    },
});
