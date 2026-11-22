"use server"

import { MaterialCreateFormOutput } from "@/components/material/create/material-create-panel";
import { MaterialEditFormOutput } from "@/components/material/edit/material-edit-panel";
import { Material, MaterialArrangableColumns, MaterialFilterableColumns, MaterialPagination, MaterialSummary } from "@/types/materials";
import { MATERIAL_PIN_LIMIT } from "@/lib/materials/config";
import type { PickerNode } from "@/lib/materials/node-order";
import { createClient, requireUser } from "@/utils/supabase/server";

export const getMaterial = async ( project_id: string, material_id: number ): Promise<Material> => {

    const supabase = await createClient();

    const { data, error } = await supabase.from("materials").select("*").eq("project_id", project_id).eq("id", material_id).single();

    if( error ) throw error.message;

    return data;

}

export const getProjectMaterials = async ( project_id: string, query: string = "", page: number = 1, pageSize: number = 10, orderList: Partial<Record<MaterialArrangableColumns, boolean>> = { updated_at: false }, filterList: Partial<Record<MaterialFilterableColumns, string>> = {}, options: { favouriteOnly?: boolean } = {} ): Promise<MaterialPagination> => {

    const supabase = await createClient();

    // range from <= index < to
    const from = ( page - 1 ) * pageSize;
    const to = from + pageSize - 1

    // Pinned materials are always listed separately (getPinnedMaterials), so they're excluded here
    let request = supabase.from("materials").select("*", { count: "exact" }).range( from, to ).eq("project_id", project_id).is("pinned_at", null);

    if( options.favouriteOnly ) request = request.eq("is_favourite", true);


    // Query
    if( query.trim().length > 0 ) {

        // Escape % and _ so user input isn't treated as wildcards
        const safe = query.replace(/[%_]/g, "\\$&");

        request = request.or( `label.ilike.%${safe}%, name.ilike.%${safe}%, content.ilike.%${safe}%`)

    }

    // Order
    Object.entries(orderList).forEach( ( [ column, ascending ] ) => request.order( column, { ascending } ) );

    // Filter
    Object.entries(filterList).forEach( ([ column, value ]) => request.eq( column, value ))


    const { data, error, count } = await request;

    if( error ) throw error.message;

    return {

        materials: ( data ?? [] ) as Material[],
        total: count ?? 0,
        totalPages: Math.max(1, Math.ceil((count ?? 0) / pageSize)),

    }

}

export const getMaterialsExistingFilterableColumnValues = async ( project_id: string ): Promise<Record<MaterialFilterableColumns, string[]>> => {

    const supabase = await createClient();

    let filterableColumnValue: Record<MaterialFilterableColumns, string[]> = { color: [], label: [], type: [] }

    const { data: materials, error: getMaterialsError } = await supabase.from("materials").select("type, color, label").eq("project_id", project_id);

    if( getMaterialsError ) throw getMaterialsError.message;

    filterableColumnValue.color = [ ...new Set( materials.map( mat => mat.color ) ) ];
    filterableColumnValue.type = [ ...new Set( materials.map( mat => mat.type ) ) ];
    filterableColumnValue.label = [ ...new Set( materials.map( mat => mat.label ) ) ];

    return filterableColumnValue

}

export const saveMaterial = async ( project_id: string, data: MaterialCreateFormOutput, extra: { content?: string } = {} ): Promise<Material> => {

    const supabase = await createClient();

    await requireUser( supabase );

    // Link and File can't exist at the same time
    if( data?.link && data?.file ) throw new Error("Link and file shouldn't exist at the same time");

    // insert Data
    const row = {
        project_id,
        type: data.type,
        name: data.name,
        label: data.label ?? "",
        color: data.color ?? "#000000",
        description: data.description ?? "",
        link: data.link ?? "",
        ...( extra.content !== undefined ? { content: extra.content } : {} ),
    };

    const { data: materialData, error: insertError } = await supabase.from("materials").insert( row ).select("*").single();

    if( insertError ) throw insertError.message;

    // Upload file and upload link column
    if( data.file ) {

        const filePath = `materials/${materialData.id}/${materialData.id}.${data.file.name.split(".").pop()}`;
        const { error: fileUploadError } = await supabase.storage.from("materials_media").upload( filePath, data.file );

        if( fileUploadError ) {
            // don't leave a row without its file behind
            await supabase.from("materials").delete().eq("id", materialData.id);
            throw fileUploadError.message;
        }

        const { error: updateLinkError } = await supabase.from("materials").update( { link: filePath } ).eq("id", materialData.id );

        if( updateLinkError ) throw updateLinkError.message;

        materialData.link = filePath;

    }

    return materialData;

}

export const updateMaterial = async ( project_id: string, material_id: number, data: MaterialEditFormOutput ) => {

    const supabase = await createClient();

    const { error: updateError } = await supabase.from("materials").update( { ...data } ).eq("id", material_id).eq("project_id", project_id);

    if( updateError ) throw updateError.message;

}

export const deleteMaterial = async ( material: Material ) => {

    const supabase = await createClient();

    // Delete row data
    const { error: deleteDataError } = await supabase.from( "materials" ).delete().eq("id", material.id).eq("project_id", material.project_id);

    if( deleteDataError ) throw deleteDataError.message;

    // Delete file
    if( material.type === "memos" ) return;
    if( !material.link.includes("materials/") ) return;

    const { error: deleteFileError } = await supabase.storage.from("materials_media").remove([material.link]);

    if( deleteFileError ) throw deleteFileError.message;

}

// for "contents"
const memoImageFolder = ( material_id: number ) => `materials/${material_id}/memo`;

export const uploadEmbeddedImage = async ( material_id: number, file: File ): Promise<string> => {

    const supabase = await createClient();

    await requireUser( supabase );

    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
    const filePath = `${memoImageFolder( material_id )}/${fileName}`;

    const { data, error } = await supabase.storage.from("materials_media").upload(filePath, file);

    if( error ) throw error.message;

    const { data: { publicUrl } } = supabase.storage.from("materials_media").getPublicUrl( data.path );

    return publicUrl;

}

// Only touches the memo image folder, never the material's main file in materials/{id}/
export const clearUnusedImages = async ( material_id: number, current_paths: string[] ) => {

    const supabase = await createClient();

    const { data, error: fetchError } = await supabase.storage.from("materials_media").list( memoImageFolder( material_id ), {
        limit: 1000,
        sortBy: { column: 'created_at', order: 'desc' },
    })

    if( fetchError ) throw fetchError.message;

    // get paths of media that exist in the storage
    // StoragePath: Path in the storage
    // PublicUrl: the whole src link
    const oldPaths = data.map( item => {

        const storagePath = `${memoImageFolder( material_id )}/${item.name}`
        const { data: { publicUrl } } = supabase.storage.from("materials_media").getPublicUrl(storagePath);

        return { storagePath, publicUrl };

    })

    // get paths of media that no longer exists in current version
    // entries without an id are folders/placeholders
    const pendingRemoveImages = oldPaths.filter( ( img, i ) => data[i].id && !current_paths.includes( img.publicUrl ) );

    if( pendingRemoveImages.length <= 0 ) return;

    const pendingRemovePaths = pendingRemoveImages.map( img => img.storagePath );

    // remove unused media
    const { error: removeError } = await supabase.storage.from("materials_media").remove(pendingRemovePaths);

    if( removeError ) throw removeError.message;

}

export const updateHTMLContent = async ( project_id: string, material_id: number, htmlContent: string, imgPaths: string[] ): Promise<string> => {

    const supabase = await createClient();

    const { data, error: updateError } = await supabase.from("materials").update({ content: htmlContent }).eq( "id", material_id ).eq( "project_id", project_id ).select("content").single();

    if( updateError ) throw updateError.message;

    await clearUnusedImages( material_id, imgPaths )

    return data.content;

}

// for readonlys
export const fetchReadonlyMaterial = async ( material: Material ): Promise<{ url: string, ext: string }> => {

    const supabase = await createClient();

    if( material.type !== "readonlys" ) throw new Error("Requested material isn't a readonly");

    const { data: { publicUrl } } = supabase.storage.from("materials_media").getPublicUrl( material.link );

    return { url: publicUrl, ext: publicUrl.split(".").pop()! };

}

export const uploadReadonlyMaterial = async ( material_id: number, file: File ) => {

    const supabase = await createClient();

    const filePath = `materials/${material_id}/${file.name}`;

    const { error } = await supabase.storage.from("materials_media").upload(filePath, file, { upsert: true });

    if( error ) throw error.message

}

// for playables
export const fetchPlayableMaterial = async ( material: Material ): Promise<{ url: string, ext: string | undefined }> => {

    const supabase = await createClient();

    if( material.type !== "playables" ) throw new Error("Requested material isn't a playable");

    if( !material.link.includes("materials") ) return { url: material.link, ext: undefined };

    const { data: { publicUrl } } = supabase.storage.from("materials_media").getPublicUrl( material.link );

    return { url: publicUrl, ext: publicUrl.split(".").pop()! };

}

// ---------- Favourite / Pin ----------

export const getPinnedMaterials = async ( project_id: string ): Promise<Material[]> => {

    const supabase = await createClient();

    const { data, error } = await supabase.from("materials").select("*").eq("project_id", project_id).not("pinned_at", "is", null).order("pinned_at", { ascending: true });

    if( error ) throw error.message;

    return ( data ?? [] ) as Material[];

}

export const setMaterialFavourite = async ( project_id: string, material_id: number, is_favourite: boolean ) => {

    const supabase = await createClient();

    await requireUser( supabase );

    const { error } = await supabase.from("materials").update({ is_favourite }).eq("id", material_id).eq("project_id", project_id);

    if( error ) throw error.message;

}

/** Returns { ok: false, message } when the pin limit is reached instead of throwing, so the UI can show it. */
export const setMaterialPinned = async ( project_id: string, material_id: number, pinned: boolean ): Promise<{ ok: boolean, message?: string }> => {

    const supabase = await createClient();

    await requireUser( supabase );

    if( pinned ) {

        const { count, error: countError } = await supabase.from("materials").select("id", { count: "exact", head: true }).eq("project_id", project_id).not("pinned_at", "is", null).neq("id", material_id);

        if( countError ) throw countError.message;

        if( ( count ?? 0 ) >= MATERIAL_PIN_LIMIT ) return { ok: false, message: `ピン留めは最大${MATERIAL_PIN_LIMIT}件までです` };

    }

    const { error } = await supabase.from("materials").update({ pinned_at: pinned ? new Date().toISOString() : null }).eq("id", material_id).eq("project_id", project_id);

    if( error ) throw error.message;

    return { ok: true };

}

// ---------- Pickers ----------

export const listMaterialsForPicker = async ( project_id: string ): Promise<MaterialSummary[]> => {

    const supabase = await createClient();

    const { data, error } = await supabase.from("materials").select("id, name, type, label, color, is_favourite, pinned_at").eq("project_id", project_id).order("updated_at", { ascending: false });

    if( error ) throw error.message;

    return ( data ?? [] ) as MaterialSummary[];

}

export const listProjectNodes = async ( project_id: string ): Promise<PickerNode[]> => {

    const supabase = await createClient();

    await requireUser( supabase );

    const { data, error } = await supabase.from("nodes").select(`id, task_name, parent_node_id, isRoot, isCompleted`).eq("project_id", project_id);

    if( error ) throw error.message;

    return ( data ?? [] ).map( n => ( { ...n, isRoot: !!n.isRoot, isCompleted: !!n.isCompleted } ) ) as PickerNode[];

}

// ---------- Material <-> Node links ----------

export const getMaterialLinks = async ( project_id: string, material_id: number ): Promise<{ id: string, task_name: string }[]> => {

    const supabase = await createClient();

    const { data, error } = await supabase.from("material_nodes").select("node_id, nodes(id, task_name)").eq("project_id", project_id).eq("material_id", material_id);

    if( error ) throw error.message;

    return ( data ?? [] ).flatMap( row => {
        const node = row.nodes as unknown as { id: string, task_name: string } | null;
        return node ? [ node ] : [];
    } );

}

export const getNodeLinks = async ( project_id: string, node_id: string ): Promise<MaterialSummary[]> => {

    const supabase = await createClient();

    const { data, error } = await supabase.from("material_nodes").select("material_id, materials(id, name, type, label, color, is_favourite, pinned_at)").eq("project_id", project_id).eq("node_id", node_id);

    if( error ) throw error.message;

    const materials = ( data ?? [] ).flatMap( row => {
        const m = row.materials as unknown as MaterialSummary | null;
        return m ? [ m ] : [];
    } );

    // pinned first, then favourites, then name
    return materials.sort( ( a, b ) =>
        Number( !!b.pinned_at ) - Number( !!a.pinned_at ) ||
        Number( b.is_favourite ) - Number( a.is_favourite ) ||
        a.name.localeCompare( b.name ) );

}

/** Whether the node row exists in this project (unsaved canvas nodes can't be linked yet). */
export const nodeExists = async ( project_id: string, node_id: string ) => {

    const supabase = await createClient();

    const { count, error } = await supabase.from("nodes").select("id", { count: "exact", head: true }).eq("project_id", project_id).eq("id", node_id);

    if( error ) throw error.message;

    return ( count ?? 0 ) > 0;

}

/** Ids of saved nodes that can hold materials: every node except the root goal. */
const linkableNodeIds = async ( project_id: string ) =>
    new Set( ( await listProjectNodes( project_id ) ).filter( n => !n.isRoot ).map( n => n.id ) );

const ROOT_LINK_ERROR = "ルート（最終目標）ノードにはマテリアルをリンクできません";

/** Replace all node links of a material. */
export const setMaterialNodeLinks = async ( project_id: string, material_id: number, node_ids: string[] ) => {

    const supabase = await createClient();

    await requireUser( supabase );

    const { data: current, error: fetchError } = await supabase.from("material_nodes").select("node_id").eq("project_id", project_id).eq("material_id", material_id);

    if( fetchError ) throw fetchError.message;

    const linkable = await linkableNodeIds( project_id );

    if( node_ids.some( id => !linkable.has( id ) ) ) throw new Error( ROOT_LINK_ERROR );

    const wanted = new Set( node_ids );
    const existing = new Set( ( current ?? [] ).map( r => r.node_id as string ) );

    await addLinks( supabase, project_id, [ ...wanted ].filter( id => !existing.has( id ) ).map( node_id => ( { material_id, node_id } ) ) );
    await removeLinks( supabase, project_id, [ ...existing ].filter( id => !wanted.has( id ) ).map( node_id => ( { material_id, node_id } ) ) );

}

/** Replace all material links of a node. */
export const setNodeMaterialLinks = async ( project_id: string, node_id: string, material_ids: number[] ) => {

    const supabase = await createClient();

    await requireUser( supabase );

    if( !( await nodeExists( project_id, node_id ) ) ) throw new Error( "ツリーを保存してからリンクしてください" );

    if( !( await linkableNodeIds( project_id ) ).has( node_id ) ) throw new Error( ROOT_LINK_ERROR );

    const { data: current, error: fetchError } = await supabase.from("material_nodes").select("material_id").eq("project_id", project_id).eq("node_id", node_id);

    if( fetchError ) throw fetchError.message;

    const wanted = new Set( material_ids );
    const existing = new Set( ( current ?? [] ).map( r => Number( r.material_id ) ) );

    await addLinks( supabase, project_id, [ ...wanted ].filter( id => !existing.has( id ) ).map( material_id => ( { material_id, node_id } ) ) );
    await removeLinks( supabase, project_id, [ ...existing ].filter( id => !wanted.has( id ) ).map( material_id => ( { material_id, node_id } ) ) );

}

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;
type LinkPair = { material_id: number, node_id: string };

const addLinks = async ( supabase: SupabaseServer, project_id: string, pairs: LinkPair[] ) => {

    if( pairs.length === 0 ) return;

    const { error } = await supabase.from("material_nodes").upsert( pairs.map( p => ( { ...p, project_id } ) ), { onConflict: "material_id,node_id", ignoreDuplicates: true } );

    if( error ) throw error.message;

}

const removeLinks = async ( supabase: SupabaseServer, project_id: string, pairs: LinkPair[] ) => {

    for( const p of pairs ) {

        const { error } = await supabase.from("material_nodes").delete().eq("project_id", project_id).eq("material_id", p.material_id).eq("node_id", p.node_id);

        if( error ) throw error.message;

    }

}

// ---------- AI proposal ----------

export type AcceptedMaterialProposal = {
    create_external: { name: string, url: string, description?: string, label?: string, node_ids: string[] }[],
    link: LinkPair[],
    unlink: LinkPair[],
}

/** Writes an accepted AI material proposal. Returns ids of created materials. */
export const applyMaterialProposal = async ( project_id: string, accepted: AcceptedMaterialProposal ): Promise<{ created: number[] }> => {

    const supabase = await createClient();

    await requireUser( supabase );

    const validNodes = await linkableNodeIds( project_id );
    const created: number[] = [];

    for( const item of accepted.create_external ) {

        if( !/^https?:\/\//i.test( item.url ) ) continue;

        const { data, error } = await supabase.from("materials").insert({
            project_id,
            type: "externals",
            name: item.name.slice( 0, 200 ),
            description: item.description ?? "",
            label: item.label ?? "",
            color: "#000000",
            link: item.url,
        }).select("id").single();

        if( error ) throw error.message;

        created.push( data.id );

        await addLinks( supabase, project_id, item.node_ids.filter( id => validNodes.has( id ) ).map( node_id => ( { material_id: data.id, node_id } ) ) );

    }

    await addLinks( supabase, project_id, accepted.link.filter( p => validNodes.has( p.node_id ) ) );
    await removeLinks( supabase, project_id, accepted.unlink );

    return { created };

}
