"use server";

import { createClient } from "@/utils/supabase/server";
import { updateResource } from "./character/serverActions";

export const updateTutorialProgress = async ( project_id: string, index: number ) => {

    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();

    // Check if the desired update progress is already completed
    const { data: previousProgress, error: previousProgressError } = await supabase
        .from( "projects" )
        .select( "tutorial_progress" )
        .eq( "user_id", user?.id )
        .eq( "id", project_id )
        .single()

    if( previousProgressError ) throw previousProgressError.message;

    if( previousProgress.tutorial_progress[index] ) return false;

    // Check if the previous is done, then update
    const newProgress = previousProgress.tutorial_progress;

    if( !( newProgress[ index - 1 ] || index - 1 < 0 ) ) return false;

    newProgress[index] = true;

    const { error: updateError } = await supabase
        .from( "projects" )
        .update({ tutorial_progress: newProgress })
        .eq( "user_id", user?.id )
        .eq( "id", project_id )

    if( updateError ) throw updateError?.message;

    if( newProgress[newProgress.length - 1] )
        await updateResource( project_id, {"1": 1, "2": 1, "3": 1} )

    return true

}
