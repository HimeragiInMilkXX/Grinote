import "server-only";

import { getProject } from "@/lib/projects";
import { loadScheduleView, type ScheduleView } from "@/lib/schedule/data";
import { createClient } from "@/utils/supabase/server";

/** The project's schedule for the assistant tools (checks that the project is the user's). */
export async function loadToolSchedule( project_id: string ): Promise<ScheduleView> {

    await getProject( project_id ); // throws when the project isn't the signed-in user's

    const supabase = await createClient();
    const view = await loadScheduleView( supabase, project_id );

    if( !view ) throw new Error( `Project ${project_id} was not found.` );

    return view;

}
