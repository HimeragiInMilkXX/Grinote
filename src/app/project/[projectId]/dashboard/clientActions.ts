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
        // the completion day (ended_at since 4.0); records from before the reward engine have no completed_at
        .or( `and(completed_at.gte.${todayStart},completed_at.lt.${todayEnd}),and(completed_at.is.null,updated_at.gte.${todayStart},updated_at.lt.${todayEnd})` )
        .eq( "project_id", project_id )
        .eq("status", "completed")

    if( error ) throw error.message;

    return data;

}