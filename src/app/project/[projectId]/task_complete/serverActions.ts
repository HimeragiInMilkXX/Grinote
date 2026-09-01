"use server"

import { OnAirRecord } from "@/types/records";
import { createClient } from "@/utils/supabase/server"

export const getRecord = async ( record_id: string, project_id: string ): Promise<OnAirRecord> => {

    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();

    const { data: record, error } = await supabase.from("records").select( "*, nodes ( * )" ).eq( "id", record_id ).eq( "project_id", project_id ).eq( "user_id", user?.id ).single();

    if( error ) throw error.message;

    if( record.status !== 'completed' ) throw new Error( "Task is not completed yet" );

    return record;

}