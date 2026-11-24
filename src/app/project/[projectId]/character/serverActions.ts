"use server";

import { createClient, requireUser } from "@/utils/supabase/server";
import { createActionClient } from "@/utils/supabase/actions";
import { addProjectXp } from "@/lib/rewards/award-task";

/** Adds XP (e.g. from feeding a resource). The new level is derived on the server from total XP. */
export const addCharacterXp = async ( project_id: string, xp: number ): Promise<{ totalXp: number, level: number }> => {

    const supabase = await createActionClient();

    const user = await requireUser( supabase );

    return addProjectXp( supabase, { projectId: project_id, userId: user.id, xp } );

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

export const updateResource = async ( project_id: string, resource_gained: Record<string, number> ) => {

    const supabase = await createClient();

    const projectResources: ProjectResource[] = await getProjectResources( project_id );

    // MAKE THE LIST FOR UPSERT, ADD QUANTITY TO EXISTING, RETURN NEW OBJECT FOR NONEXISTING
    const resourceUpsertList = Object.entries( resource_gained ).map( ( [ resource_id, quantity ] ) => {

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

    const { error } = await
        supabase.from("project_resources")
        .upsert(
            resourceUpsertList,
            { onConflict: 'project_id, resource_id' }
        )

    if( error ) throw error.message;

}
