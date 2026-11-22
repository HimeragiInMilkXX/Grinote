import { getProject } from "@/lib/projects";
import { createClient } from "@/utils/supabase/server";
import type { Material } from "@/types/materials";

/** Server-side reads shared by the material tools. Ownership is checked with getProject (throws if not the user's project). */
export async function loadProjectMaterials( project_id: string ) {

    await getProject( project_id );

    const supabase = await createClient();

    const [ materialsRes, linksRes, nodesRes ] = await Promise.all( [
        supabase.from( "materials" ).select( "*" ).eq( "project_id", project_id ).order( "updated_at", { ascending: false } ),
        supabase.from( "material_nodes" ).select( "material_id, node_id" ).eq( "project_id", project_id ),
        supabase.from( "nodes" ).select( "id, task_name, isRoot" ).eq( "project_id", project_id ),
    ] );

    if( materialsRes.error ) throw new Error( materialsRes.error.message );
    if( linksRes.error ) throw new Error( linksRes.error.message );
    if( nodesRes.error ) throw new Error( nodesRes.error.message );

    const materials = ( materialsRes.data ?? [] ) as Material[];
    const links = ( linksRes.data ?? [] ).map( l => ( { material_id: Number( l.material_id ), node_id: String( l.node_id ) } ) );
    const nodeNames = Object.fromEntries( ( nodesRes.data ?? [] ).map( n => [ String( n.id ), String( n.task_name ) ] ) );

    const rootIds = new Set( ( nodesRes.data ?? [] ).filter( n => n.isRoot ).map( n => String( n.id ) ) );

    return { materials, links, nodeNames, rootIds };

}

/** Only real external URLs are shown to the model; storage paths are internal. */
export const publicLink = ( m: Pick<Material, "type" | "link"> ) =>
    m.link && /^https?:\/\//i.test( m.link ) ? m.link : null;
