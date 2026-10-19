import "server-only"
import { cache } from "react"
import { createClient } from "@/utils/supabase/server"

export const getProject = cache( async ( projectId: string ) => {

    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();

    const { data: project, error } = await supabase.from("projects").select("*, characters ( * )").eq( "id", projectId ).eq( "user_id", user?.id ).single();

    if( error ) throw error;

    return project;

})