"use server"

import { createClient, requireUser } from "@/utils/supabase/server";

export const hasDoneIntroduction = async () => {

    const supabase = await createClient();

    const user = await requireUser( supabase );

    const { data: profile, error } = await supabase
        .from("profile")
        .select("introduction_done")
        .eq("user_id", user.id).single()

    if( error ) throw error.message

    return profile.introduction_done;

}

export const completeIntroduction = async () => {

    const supabase = await createClient();

    const user = await requireUser( supabase );

    const { error } = await supabase
        .from("profile")
        .update( { introduction_done: true } )
        .eq( "user_id", user.id )

    if( error ) throw error.message

}