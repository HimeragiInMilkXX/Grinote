"use server"

import { MaterialCreateFormOutput } from "@/components/material/create/material-create-panel";
import { Material, MaterialArrangableColumns, MaterialFilterableColumns, MaterialPagination } from "@/types/materials";
import { createClient } from "@/utils/supabase/server";

export const getMaterial = async ( project_id: string, material_id: number ): Promise<Material> => {

    const supabase = await createClient();

    const { data, error } = await supabase.from("materials").select("*").eq("project_id", project_id).eq("id", material_id).single();

    console.log( data )

    if( error ) throw error.message;

    return data;

}

export const getProjectMaterials = async ( project_id: string, query: string = "", page: number = 1, pageSize: number = 10, orderList: Partial<Record<MaterialArrangableColumns, boolean>> = { updated_at: false }, filterList: Partial<Record<MaterialFilterableColumns, string>> = {} ): Promise<MaterialPagination> => {

    const supabase = await createClient();

    // range from <= index < to
    const from = ( page - 1 ) * pageSize;
    const to = from + pageSize - 1

    let request = supabase.from("materials").select("*", { count: "exact" }).range( from, to ).eq("project_id", project_id);


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

export const saveMaterial = async ( project_id: string, data: MaterialCreateFormOutput, material_id?: number ): Promise<Material> => {

    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();

    if( !user ) throw new Error("not logged in")

    // Link and File can't exist at the same time
    if( data?.link && data?.file ) throw new Error("Link and file shouldn't exist at the same time");

    // Upsert Data
    const row = {
        ...( material_id ? {id: material_id} : {}),
        project_id,
        type: data.type,
        name: data.name,
        label: data.label ?? "",
        color: data.color ?? "#000000",
        description: data.description ?? "",
        link: data.link ?? "",
    };

    const { data: materialData, error: upsertError } = await supabase.from("materials").upsert( row, { onConflict: "id" } ).select("*").single();

    if( upsertError ) throw upsertError.message;

    // Upload file and upload link column
    if( data.file ) {

        const filePath = `materials/${materialData.id}/${materialData.id}.${data.file.name.split(".").pop()}`;
        const { error: fileUploadError } = await supabase.storage.from("materials_media").upload( filePath, data.file );

        if( fileUploadError ) throw fileUploadError.message;

        const { error: updateLinkError } = await supabase.from("materials").update( { link: filePath } ).eq("id", materialData.id );

        if( updateLinkError ) throw updateLinkError.message;

    }

    return materialData;

}

// for "contents"
export const uploadEmbeddedImage = async ( file: File ): Promise<string> => {

    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();

    if( !user ) throw new Error("not logged in")

    const material_id = 1;

    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
    const filePath = `materials/${material_id}/${fileName}`;

    const { data, error } = await supabase.storage.from("materials_media").upload(filePath, file);

    if( error ) throw error.message;

    const { data: { publicUrl } } = supabase.storage.from("materials_media").getPublicUrl( data.path );

    return publicUrl;

}

export const clearUnusedImages = async ( material_id: number, current_paths: string[] ) => {

    const supabase = await createClient();

    const { data, error: fetchError } = await supabase.storage.from("materials_media").list(`materials/${material_id}`, {
        limit: 100,
        sortBy: { column: 'created_at', order: 'desc' },
    })

    if( fetchError ) throw fetchError.message;

    // get paths of media that exist in the storage
    // StoragePath: Path in the storage
    // PublicUrl: the whole src link
    const oldPaths = data.map( item => {

        const storagePath = `materials/${material_id}/${item.name}`
        const { data: { publicUrl } } = supabase.storage.from("materials_media").getPublicUrl(storagePath);

        return { storagePath, publicUrl };

    })

    // get paths of media that no longer exists in current version
    const pendingRemoveImages = oldPaths.filter( img => !current_paths.includes( img.publicUrl ) );

    if( pendingRemoveImages.length <= 0 ) return;

    const pendingRemovePaths = pendingRemoveImages.map( img => img.storagePath );

    // remove unused media
    const { data: test, error: removeError } = await supabase.storage.from("materials_media").remove(pendingRemovePaths);

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

    const { data, error } = await supabase.storage.from("materials_media").upload(filePath, file, { upsert: true });

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