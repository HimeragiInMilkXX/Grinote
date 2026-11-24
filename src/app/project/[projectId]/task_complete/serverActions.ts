"use server"

import { OnAirRecord } from "@/types/records";
import { createClient, requireUser } from "@/utils/supabase/server"
import { createActionClient } from "@/utils/supabase/actions";

export const getRecord = async ( record_id: number, project_id: string ): Promise<OnAirRecord> => {

    const supabase = await createClient();

    const user = await requireUser( supabase );

    const { data: record, error } = await supabase.from("records").select( "*, nodes ( * ), projects ( *, characters ( * ) )" ).eq( "id", record_id ).eq( "project_id", project_id ).eq( "user_id", user.id ).single();

    if( error ) throw error.message;

    if( record.status !== 'completed' ) throw new Error( "Task is not completed yet" );

    return record;

}

/**
 * Marks the reward animation as shown. XP and resources were already awarded at completion
 * (complete_task_with_reward), so this writes nothing else.
 */
export const markRewardShown = async ( record_id: number, project_id: string ) => {

    const supabase = await createActionClient();

    const user = await requireUser( supabase );

    const { error } = await supabase
        .from( "records" )
        .update( { reward_redeemed: true } )
        .eq( "id", record_id )
        .eq( "project_id", project_id )
        .eq( "user_id", user.id )
        .eq( "status", "completed" )
        .eq( "reward_redeemed", false );

    if( error ) throw error.message;

}
