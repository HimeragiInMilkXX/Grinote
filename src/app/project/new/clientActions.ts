"use client"

import { clearNewProjectAtomValue, getNewProjectValueAtomValue, isCompleteProjectInformation, updateNewProjectAtomValue } from "@/atoms/new_project_atom"
import { newProjectDetailsFormSchema } from "@/components/project/new/new-project-details-form"
import { newProjectGoalFormSchema } from "@/components/project/new/new-project-goal-form"
import { redirect } from "next/navigation"
import z from "zod/v4"
import { createNewProject } from "./serverActions"
import { createClient } from "@/utils/supabase/client"

export async function handlePickCharacter( pickedId: number ) {

    console.log( pickedId )

    updateNewProjectAtomValue( { character_id: pickedId } )
    redirect( "/project/new/details" )

}

export async function handleGoalDef( data: z.infer<typeof newProjectGoalFormSchema> ) {

    if( data.goal ) {

        updateNewProjectAtomValue( { final_goal: data.goal } )
        redirect( "/project/new/character" )

    }

}

export async function handleDetailsDef( data: z.infer<typeof newProjectDetailsFormSchema> ) {

    if( data ) {

        updateNewProjectAtomValue( data );

    }

}

export async function handleCreateProject() {

    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();

    if( !user ) {
        clearNewProjectAtomValue();
        redirect( "/login" )
    }

    const data = getNewProjectValueAtomValue();

    if( !isCompleteProjectInformation( data ) ) {
        clearNewProjectAtomValue();
        throw new Error( "Incomplete project data" );
    }

    const work_days: boolean[] = Array.from( { length: 7 }, ( _, i ) => {

        return data.work_days.includes( i+1 );

    })

    const { hours, minutes, seconds } = data.daily_time_goal;

    const daily_time_goal = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

    const returnData = await createNewProject( data, work_days, daily_time_goal );

    clearNewProjectAtomValue();

    return returnData;

}