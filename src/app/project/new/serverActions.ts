"use server"

import { NewProjectInformation } from "@/atoms/new_project_atom";
import { createActionClient } from "@/utils/supabase/actions";
import { randomUUID } from "node:crypto";

export async function createNewProject( data: NewProjectInformation, work_days: boolean[], daily_time_goal: string ) {

    const supabase = await createActionClient();

    const { data: { user } } = await supabase.auth.getUser();

    if( !user ) {
        throw new Error( "User not logged in" );
    }

    const { data: returnData, error } = await supabase.from( 'projects' ).insert([ {

        user_id: user?.id,
        ...data,
        work_days: work_days,
        daily_time_goal: daily_time_goal,

    }]).select().single();

    if( error ) throw error;

    await addRootNode( returnData );

    return returnData;

}

export async function addRootNode( project: Project ) {

    const supabase = await createActionClient();

    const { error } = await supabase.from("nodes").insert({

        id: randomUUID(),
        project_id: project.id,
        task_name: project.final_goal,
        description: project.description,
        isRoot: true,

    })

    if( error ) throw error.message;

}