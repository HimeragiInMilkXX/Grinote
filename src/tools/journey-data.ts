import "server-only";

import { getProject } from "@/lib/projects";
import { computeJourneyStats, loadJourneyEntries, type JourneyEntry } from "@/lib/journey/history";
import { normalizeWorkDays } from "@/lib/projects/work-days";
import { REWARD_DAY_TIMEZONE } from "@/lib/rewards/config";
import { dateKeyInZone } from "@/lib/rewards/streaks";
import { createClient } from "@/utils/supabase/server";

/** Completed journey entries + stats of a project the user owns (getProject checks access). */
export async function loadJourney( project_id: string ) {

    const project: Project = await getProject( project_id );
    const supabase = await createClient();
    const entries = await loadJourneyEntries( supabase, project_id );

    const stats = computeJourneyStats( entries, { created_at: new Date( project.created_at ).toISOString(), work_days: normalizeWorkDays( project.work_days ) } );

    return { entries, stats };

}

export const dayKey = ( iso: string ) => dateKeyInZone( new Date( iso ), REWARD_DAY_TIMEZONE );

export const minutes = ( m: number ) => Math.round( m * 10 ) / 10;

export const cut = ( text: string | null | undefined, limit: number ) => {

    if( !text ) return null;
    return text.length > limit ? text.slice( 0, limit ) + "..." : text;

};

/** AI review fields of an entry. Evidence is never sent: it is only used for scoring at completion. */
export function entryAiFields( entry: JourneyEntry ) {

    const a = entry.journal?.analysis ?? null;

    return {
        ai_score: entry.journal?.aiScore ?? null,
        verification: a?.verification ?? null,
        conclusion: a?.conclusion ?? null,
        struggles: a?.struggles || null,
        next_actions: a?.nextActions.map( n => ( { kind: n.kind, detail: n.detail } ) ) ?? [],
    };

}
