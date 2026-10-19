"use client";

import { OnAirRecord } from "@/types/records";
import { createClient } from "@/utils/supabase/client";
import { startOfDay, addDays } from "date-fns";

export const getRecordsOfDay = async ( project_id: string, date: Date ): Promise<OnAirRecord[]> => {

    const supabase = await createClient();

    const todayStart = startOfDay( date ).toISOString();
    const todayEnd = startOfDay( addDays( date, 1 ) ).toISOString();

    const { data, error } = await
        supabase.from("records")
        .select( "*, nodes ( * )" )
        .gte( "updated_at", todayStart )
        .lt( "updated_at", todayEnd )
        .eq( "project_id", project_id )
        .eq("status", "completed")

    if( error ) throw error.message;

    return data;

}