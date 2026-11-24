"use server";

import { getProject } from "@/lib/projects";
import { computeJourneyStats, loadJourneyEntries, type JourneyEntry, type JourneyStats } from "@/lib/journey/history";
import { normalizeWorkDays } from "@/lib/projects/work-days";
import { createClient } from "@/utils/supabase/server";

export interface JourneyData {
    stats: JourneyStats;
    entries: JourneyEntry[];
    /** record id of a finished task whose report is still pending */
    pendingReportId: number | null;
}

export const getJourney = async ( projectId: string ): Promise<JourneyData> => {

    // ownership check (redirects to /login without a user)
    const project: Project = await getProject( projectId );

    const supabase = await createClient();

    const [ entries, pending ] = await Promise.all( [
        loadJourneyEntries( supabase, projectId ),
        supabase.from( "records" ).select( "id" ).eq( "project_id", projectId ).eq( "status", "reviewing" ).limit( 1 ),
    ] );

    if( pending.error ) throw new Error( pending.error.message );

    return {
        stats: computeJourneyStats( entries, { created_at: new Date( project.created_at ).toISOString(), work_days: normalizeWorkDays( project.work_days ) } ),
        entries,
        pendingReportId: pending.data?.[0]?.id ?? null,
    };

};
