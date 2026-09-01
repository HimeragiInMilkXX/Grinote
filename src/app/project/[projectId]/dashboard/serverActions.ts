"use server";

import { OnAirRecord } from "@/types/records";
import { createClient } from "@/utils/supabase/server";

export const getRecords = async ( project_id: string ): Promise<OnAirRecord[]> => {

    const supabase = await createClient();

    const { data, error } = await supabase.from("records").select("*, nodes ( * )").eq( "project_id", project_id ).order('started_at', { ascending: false });

    if( error ) throw error.message;

    return data;

}