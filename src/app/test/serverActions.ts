"use server";

import { createClient } from "@/utils/supabase/server";

export const getProjectGoal = async ( project_id: string ): Promise<string> => {

    const supabase = await createClient();

    const { data, error } = await supabase.from("projects").select("final_goal").eq( "id", project_id ).single();

    if( error ) throw error.message;

    return data.final_goal;

}