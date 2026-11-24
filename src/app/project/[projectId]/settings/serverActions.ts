"use server";

import { buildSettingsPatch, describeProjectSettingsError, type ProjectSettingsInput, type SettingsField } from "@/lib/projects/settings";
import { createActionClient } from "@/utils/supabase/actions";
import { requireUser } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "materials_media";

export type UpdateSettingsResult =
    | { ok: true; changed: string[] }
    | { ok: false; message: string; errors?: Partial<Record<SettingsField, string>> };

const SETTINGS_COLUMNS = "id, name, description, achieve_date_goal, daily_time_goal, work_days, character_given_name, character_name_changed_at";

async function hasActiveTask( supabase: SupabaseClient, project_id: string ) {

    const { count, error } = await supabase
        .from( "records" )
        .select( "id", { count: "exact", head: true } )
        .eq( "project_id", project_id )
        .in( "status", [ "active", "paused", "reviewing" ] );

    if( error ) throw error.message;

    return ( count ?? 0 ) > 0;

}

const ACTIVE_TASK_MESSAGE = describeProjectSettingsError( "project_active_task" );

export const updateProjectSettings = async ( project_id: string, input: ProjectSettingsInput ): Promise<UpdateSettingsResult> => {

    const supabase = await createActionClient();

    const user = await requireUser( supabase );

    const { data: current, error: loadError } = await supabase
        .from( "projects" )
        .select( SETTINGS_COLUMNS )
        .eq( "id", project_id )
        .eq( "user_id", user.id )
        .single();

    if( loadError || !current ) return { ok: false, message: "プロジェクトが見つかりません。" };

    if( await hasActiveTask( supabase, project_id ) ) return { ok: false, message: ACTIVE_TASK_MESSAGE };

    const result = buildSettingsPatch( current, input );

    if( !result.ok ) return { ok: false, message: "入力内容を確認してください。", errors: result.errors };

    const changed = Object.keys( result.patch );

    if( changed.length === 0 ) return { ok: true, changed };

    const { error } = await supabase
        .from( "projects" )
        .update( result.patch )
        .eq( "id", project_id )
        .eq( "user_id", user.id );

    if( error ) return { ok: false, message: describeProjectSettingsError( error.message ) };

    revalidatePath( `/project/${project_id}`, "layout" );

    return { ok: true, changed };

}

export const resetProjectProgress = async ( project_id: string ): Promise<{ ok: true } | { ok: false; message: string }> => {

    const supabase = await createActionClient();

    await requireUser( supabase );

    if( await hasActiveTask( supabase, project_id ) ) return { ok: false, message: ACTIVE_TASK_MESSAGE };

    const { error } = await supabase.rpc( "reset_project_progress", { p_project_id: project_id } );

    if( error ) return { ok: false, message: describeProjectSettingsError( error.message ) };

    revalidatePath( `/project/${project_id}`, "layout" );

    return { ok: true };

}

/** Every storage path under `materials/{id}/` and `materials/{id}/memo/`. */
async function listMaterialFiles( supabase: SupabaseClient, material_id: number ) {

    const paths: string[] = [];

    for( const folder of [ `materials/${material_id}`, `materials/${material_id}/memo` ] ) {

        for( let offset = 0; ; offset += 1000 ) {

            const { data, error } = await supabase.storage.from( BUCKET ).list( folder, { limit: 1000, offset } );

            if( error ) throw error.message;

            // folders (e.g. "memo") come back with id === null
            for( const item of data ?? [] ) if( item.id ) paths.push( `${folder}/${item.name}` );

            if( !data || data.length < 1000 ) break;

        }

    }

    return paths;

}

export const deleteProject = async ( project_id: string, confirmName: string ): Promise<{ ok: true } | { ok: false; message: string }> => {

    const supabase = await createActionClient();

    const user = await requireUser( supabase );

    const { data: project, error: loadError } = await supabase
        .from( "projects" )
        .select( "id, name" )
        .eq( "id", project_id )
        .eq( "user_id", user.id )
        .single();

    if( loadError || !project ) return { ok: false, message: "プロジェクトが見つかりません。" };

    if( confirmName.trim() !== project.name.trim() ) return { ok: false, message: "プロジェクト名が一致しません。" };

    if( await hasActiveTask( supabase, project_id ) ) return { ok: false, message: ACTIVE_TASK_MESSAGE };

    // Storage first: its RLS checks materials -> projects, so files must go before the rows do.
    const { data: materials, error: materialsError } = await supabase
        .from( "materials" )
        .select( "id" )
        .eq( "project_id", project_id );

    if( materialsError ) return { ok: false, message: materialsError.message };

    try {

        const paths = ( await Promise.all( ( materials ?? [] ).map( m => listMaterialFiles( supabase, m.id ) ) ) ).flat();

        for( let i = 0; i < paths.length; i += 100 ) {

            const { error } = await supabase.storage.from( BUCKET ).remove( paths.slice( i, i + 100 ) );
            if( error ) throw error.message;

        }

    } catch( e ) {

        return { ok: false, message: `ファイルの削除に失敗しました: ${String( e )}` };

    }

    // nodes, records, materials, material_nodes and project_resources cascade
    const { error } = await supabase.from( "projects" ).delete().eq( "id", project_id ).eq( "user_id", user.id );

    if( error ) return { ok: false, message: describeProjectSettingsError( error.message ) };

    // No revalidatePath here: revalidating inside an action re-renders the current (now deleted)
    // project page, whose getProject() then fails. /dashboard is dynamic, so the client's
    // router.replace("/dashboard") already gets a fresh list.
    return { ok: true };

}
