"use server"

import { OnAirRecord } from "@/types/records";
import { createClient } from "@/utils/supabase/server"
import { updateResource, updateXp } from "../character/serverActions";

export const getRecord = async ( record_id: number, project_id: string ): Promise<OnAirRecord> => {

    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();

    const { data: record, error } = await supabase.from("records").select( "*, nodes ( * ), projects ( *, characters ( * ) )" ).eq( "id", record_id ).eq( "project_id", project_id ).eq( "user_id", user?.id ).single();

    if( error ) throw error.message;

    if( record.status !== 'completed' ) throw new Error( "Task is not completed yet" );

    return record;

}

export const redeemReward = async ( record_id: number, project_id: string, currentXP: number ) => {

    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();

    const { data: record, error: updateBoolError } = await
        supabase
        .from( "records" )
        .update( { reward_redeemed: true } )
        .eq( "id", record_id )
        .eq( "project_id", project_id )
        .eq( "user_id", user?.id )
        .eq( "status", "completed" )
        .eq( "reward_redeemed", false )
        .select( "xp_change, resource_gained" ).single();

    if( updateBoolError ) throw updateBoolError.message;

    await updateXp( project_id, currentXP + record.xp_change );
    await updateResource( project_id, record.resource_gained )

}