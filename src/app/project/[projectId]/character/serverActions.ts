"use server";

import { createClient } from "@/utils/supabase/server";

export const saveCharacterProgress = async ( project_id: string, new_level: number, new_xp: number ) => {

    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();

    const { data: project, error: updateCharError } = await
        supabase.from( "projects" ).update( { character_xp: new_xp, character_level: new_level } ).eq( "id", project_id ).eq( "user_id", user?.id )
        .select( "*" ).single();
    
    if( updateCharError ) throw updateCharError.message;

}

export const getProjectResources = async ( project_id: string ): Promise<ProjectResource[]> => {

    const supabase = await createClient();

    const { data: project_resource, error } = await
        supabase.from( "project_resources" ).select("*, resources (*)").eq( "project_id", project_id )

    if( error ) throw error.message;

    return project_resource;

}

export const saveResourceConsumedInformation = async ( projectResource: ProjectResource, quantity: number ) => {

    const supabase = await createClient();

    const { error } = await
        supabase.from( "project_resources" ).update( { quantity: quantity } ).eq( "id", projectResource.id ).eq( "project_id", projectResource.project_id );

    if( error ) throw error.message;

}

export const getResourceFromId = async ( resource_id: number ): Promise<ProjectResource> => {

    const supabase = await createClient();

    const { data, error } = await
        supabase.from("resources").select("*").eq( "id", resource_id ).single();

    if( error ) throw error.message;

    return data;

}

export const updateXp = async ( project_id: string, newXP: number ) => {

    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();

    const { error: updateCharError } = await
        supabase.from( "projects" ).update( { character_xp: newXP } ).eq( "id", project_id ).eq( "user_id", user?.id )

    if( updateCharError ) throw updateCharError.message;

}

export const updateResource = async ( project_id: string, resource_gained: Record<string, number> ) => {

    const supabase = await createClient();

    const projectResources: ProjectResource[] = await getProjectResources( project_id );

    // MAKE THE LIST FOR UPSERT, ADD QUANTITY TO EXISTING, RETURN NEW OBJECT FOR NONEXISTING
    const resourceUpsertList = Object.entries( resource_gained ).map( ( [ resource_id, quantity ], index ) => {

        const existingRow = projectResources.find( res => res.resource_id == Number(resource_id) )

        if( existingRow ) {

            return {

                project_id: existingRow.project_id,
                resource_id: Number( resource_id ),
                quantity: existingRow.quantity + quantity

            }

        }

        return {

            project_id,
            resource_id: Number(resource_id),
            quantity

        }

    })

    console.log( resourceUpsertList )

    const { error } = await
        supabase.from("project_resources")
        .upsert(
            resourceUpsertList,
            { onConflict: 'project_id, resource_id' }
        )

    if( error ) throw error.message;

}
