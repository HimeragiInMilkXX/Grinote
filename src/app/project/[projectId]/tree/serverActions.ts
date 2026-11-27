"use server";

import { TableTaskRow, TableTaskRows, TaskNodeType } from "@/types/flow";
import { createActionClient } from "@/utils/supabase/actions";
import { createClient, requireUser } from "@/utils/supabase/server";
import { durationObjectToInterval, intervalToDurationObject } from "@/utils/utils";
import { Edge, ReactFlowJsonObject } from "@xyflow/react";
import { randomUUID } from "node:crypto";
import { applyIdMap, remapNodeIds, sanitizeGraphIds, type IdMap } from "@/lib/tree/ids";
import { removeRecordsEvidence } from "@/lib/journey/evidence-db";
import type { SupabaseClient } from "@supabase/supabase-js";

const convertToTableFormat = ( rawData: ReactFlowJsonObject<TaskNodeType, Edge>, project_id: string ) => {

    const convertedTasks: TableTaskRows = {};

    rawData.nodes.forEach( node => {

        convertedTasks[node.id] = {

            id: node.id,
            parent_node_id: null,
            project_id: project_id,
            pos_x: node.position.x,
            pos_y: node.position.y,
            ...node.data.task,

        }

    })

    return convertedTasks;

}

/** Columns the app controls (on air / task completion). The tree editor never writes them. */
const SYSTEM_COLUMNS = [ "isRoot", "isCompleted", "repetitions_completed" ] as const;

/** Postgres unique_violation on nodes.id, e.g. `Key (id)=(...) already exists.` */
const conflictingIdFrom = ( error: { code?: string, details?: string | null, message?: string } ): string | null => {
    if( error.code !== "23505" ) return null;
    const match = /\(id\)=\(([0-9a-f-]{36})\)/i.exec( `${error.details ?? ""} ${error.message ?? ""}` );
    return match?.[1] ?? null;
}

const MAX_INSERT_ATTEMPTS = 3;

/**
 * Save the canvas to `nodes`. Returns `idMap` (canvas id -> saved id) for nodes that had to get a
 * new id because their id was invalid, duplicated, or already used by a row outside this project.
 * The client applies it to its canvas.
 */
/** Records of these nodes that have evidence files (read before the delete cascades their journals). */
async function recordsWithEvidence( supabase: SupabaseClient, project_id: string, nodeIds: string[] ): Promise<number[]> {

    const { data, error } = await supabase.from( "task_journals" ).select( "record_id, evidence" ).eq( "project_id", project_id ).in( "node_id", nodeIds );

    if( error ) { console.warn( "[tree] evidence lookup", error.message ); return []; }

    return ( data ?? [] ).filter( j => Array.isArray( j.evidence ) && j.evidence.length > 0 ).map( j => Number( j.record_id ) );

}

export const saveGraphToNodes = async ( rawData: ReactFlowJsonObject<TaskNodeType, Edge>, project_id: string ): Promise<{ idMap: IdMap }> => {

    const supabase = await createActionClient();

    // the canvas is read-only while a task runs or its report is pending (a stale tab must not
    // delete or change the node of that record)
    const { count: openRecords, error: openRecordsError } = await supabase
        .from( "records" )
        .select( "id", { count: "exact", head: true } )
        .eq( "project_id", project_id )
        .in( "status", [ "active", "paused", "reviewing" ] );

    if( openRecordsError ) throw openRecordsError;
    if( ( openRecords ?? 0 ) > 0 ) throw new Error( "行動中・レポート提出前は目標ツリーを保存できません" );

    const { data: previousRowsArray, error: previousNodesIdError } = await supabase.from('nodes').select('*').eq( 'project_id', project_id );

    if( previousNodesIdError ) throw previousNodesIdError;

    const previousRows = new Map<string, TableTaskRow & { time_limit: string }>( ( previousRowsArray ?? [] ).map( row => [ row.id, row ] ) );

    // ---------- ID GUARDS ----------
    const idMap: IdMap = {};
    const recordRemap = ( map: IdMap ) => {
        for( const [ from, to ] of Object.entries( map ) ) {
            // Chain remaps so the client gets canvas id -> final id
            const original = Object.keys( idMap ).find( k => idMap[k] === from );
            idMap[original ?? from] = to;
        }
    };

    // Every node id must be a UUID and unique in the payload, and edges must point at payload nodes
    const sanitized = sanitizeGraphIds( { nodes: rawData.nodes, edges: rawData.edges } );
    let graph = sanitized.graph;
    recordRemap( sanitized.idMap );

    // Ids new to this project must not belong to a row of another project. Rows of the user's other
    // projects are visible here and an upsert would MOVE them into this project; rows of other users
    // are hidden by RLS and are caught by the plain insert below (unique violation).
    const newIds = graph.nodes.map( n => n.id ).filter( id => !previousRows.has( id ) );

    if( newIds.length > 0 ) {
        const { data: elsewhere, error: elsewhereError } = await supabase.from( "nodes" ).select( "id" ).in( "id", newIds );
        if( elsewhereError ) throw elsewhereError;
        const usedElsewhere = ( elsewhere ?? [] ).map( row => row.id as string );
        if( usedElsewhere.length > 0 ) {
            const remapped = remapNodeIds( graph, usedElsewhere, new Set( [ ...previousRows.keys(), ...usedElsewhere ] ) );
            graph = remapped.graph;
            recordRemap( remapped.idMap );
        }
    }

    const convertedTasks: TableTaskRows = convertToTableFormat( { ...rawData, ...graph }, project_id );

    // Root and completed rows are locked: only their canvas position may change, and they are never deleted
    const lockedIds = new Set( Array.from( previousRows.values() ).filter( row => row.isRoot || row.isCompleted ).map( row => row.id ) );

    const previousNodesId = new Set( previousRows.keys() );

    const toRow = ( id: string ) => {

        const node = convertedTasks[id];
        const previous = previousRows.get( id );

        if( previous && lockedIds.has( id ) ) {
            return { ...previous, pos_x: node.pos_x, pos_y: node.pos_y };
        }

        const time_limit = durationObjectToInterval( node.time_limit );

        // System columns always come from the database (or defaults for new rows), so a stale canvas
        // cannot undo progress recorded elsewhere, and the editor cannot create another root.
        const systemColumns = {
            isRoot: false,
            isCompleted: previous?.isCompleted ?? false,
            repetitions_completed: previous?.repetitions_completed ?? 0,
        };

        const row: Record<string, unknown> = { ...node };
        SYSTEM_COLUMNS.forEach( column => delete row[column] );

        return { ...row, ...systemColumns, id, project_id, parent_node_id: null, time_limit }

    }

    // UPDATE rows that already belong to this project (so the upsert can only hit this project's rows)
    const existingRows = Object.keys( convertedTasks ).filter( id => previousRows.has( id ) ).map( toRow );

    if( existingRows.length > 0 ) {
        const { error: upsertError } = await supabase.from( "nodes" ).upsert( existingRows, { onConflict: "id" } );
        if( upsertError ) throw upsertError;
    }

    // INSERT new rows. Never upsert them: a conflict must fail, not overwrite. If the id is taken by a
    // row hidden by RLS, give that node a fresh id and retry.
    for( let attempt = 1; ; attempt++ ) {

        const insertIds = Object.keys( convertedTasks ).filter( id => !previousRows.has( id ) );
        if( insertIds.length === 0 ) break;

        const { error: insertError } = await supabase.from( "nodes" ).insert( insertIds.map( toRow ) );
        if( !insertError ) break;

        const conflictId = conflictingIdFrom( insertError );
        if( !conflictId || !convertedTasks[conflictId] || previousRows.has( conflictId ) || attempt >= MAX_INSERT_ATTEMPTS ) throw insertError;

        const fresh = randomUUID();
        convertedTasks[fresh] = { ...convertedTasks[conflictId], id: fresh };
        delete convertedTasks[conflictId];
        graph = applyIdMap( graph, { [conflictId]: fresh } );
        recordRemap( { [conflictId]: fresh } );

    }

    const currentNodesId = new Set( Object.keys( convertedTasks ) );

    // DELETE (never locked rows)
    const nodesIdPendingDelete = Array.from( previousNodesId.difference( currentNodesId ) ).filter( id => !lockedIds.has( id ) );

    if( nodesIdPendingDelete.length > 0 ) {

        // the node's records (and journals) cascade, their evidence files don't
        const evidenceRecords = await recordsWithEvidence( supabase, project_id, nodesIdPendingDelete );

        const { error: deleteError } = await supabase.from( "nodes" ).delete().in('id', nodesIdPendingDelete).eq( "project_id", project_id );

        if( deleteError ) throw deleteError;

        if( evidenceRecords.length > 0 ) {
            const user = await requireUser( supabase );
            await removeRecordsEvidence( supabase, user.id, project_id, evidenceRecords );
        }

    }

    // SAVE PARENTAL RELATIONS (locked rows keep their saved parent; both ends must be nodes of this save,
    // so parent_node_id never points outside the project)
    const edgesToSave = graph.edges.filter( edge => !lockedIds.has( edge.target ) && currentNodesId.has( edge.source ) && currentNodesId.has( edge.target ) );

    if( edgesToSave.length > 0 ) {

        const updatePromises = edgesToSave.map(edge =>
            supabase
                .from("nodes")
                .update({ parent_node_id: edge.source })
                .eq("id", edge.target)
                .eq("project_id", project_id)
        );

        const results = await Promise.all(updatePromises);

        const failedUpdate = results.find(result => result.error);
        if (failedUpdate?.error) throw failedUpdate.error;

    }

    return { idMap };

}

/** Number of work records per node, used to warn before deleting nodes (records cascade on delete). */
export const countRecordsForNodes = async ( project_id: string, node_ids: string[] ): Promise<Record<string, number>> => {

    if( node_ids.length === 0 ) return {};

    const supabase = await createClient();

    await requireUser( supabase );

    const { data, error } = await supabase.from( "records" ).select( "node_id" ).eq( "project_id", project_id ).in( "node_id", node_ids );

    if( error ) throw error;

    return ( data ?? [] ).reduce<Record<string, number>>( ( counts, row ) => {
        counts[row.node_id] = ( counts[row.node_id] ?? 0 ) + 1;
        return counts;
    }, {} );

}

const convertToRfFormat = ( tableTaskRows: ({ time_limit: string } & TableTaskRow)[] ) => {

    const convertedNodes: TaskNodeType[] = [];
    const convertedEdges: Edge[] = [];

    tableTaskRows.forEach( row => {

        convertedNodes.push( {

            id: row.id,
            position: { x: row.pos_x, y: row.pos_y },
            connectable: !row.isCompleted && !row.isRoot,
            selectable: !row.isCompleted && !row.isRoot,
            draggable: (row.isCompleted || row.isRoot) ? false : undefined,
            data: {

                label: row.task_name,
                task: {

                    task_name: row.task_name,
                    bg_color: row.bg_color,
                    text_color: row.text_color,
                    description: row.description,
                    time_limit: intervalToDurationObject( row.time_limit ),
                    isAction: row.isAction,
                    isLoop: row.isLoop,
                    isCompleted: row.isCompleted,
                    repetitions_required: row.repetitions_required,
                    repetitions_completed: row.repetitions_completed,
                    isRoot: row.isRoot,

                }

            },
            type: 'taskNode'

        } )

        // Go to next item if current item doesn't need edge
        if( !row.parent_node_id ) return;

        convertedEdges.push( {

            id: `${row.parent_node_id}-${row.id}`,
            source: row.parent_node_id ?? "",
            target: row.id,
            sourceHandle: 'source',
            targetHandle: "target",
            deletable: row.isCompleted ? false : true,
            type: "smoothstep",
            animated: true

        } )

    })

    return { nodes: convertedNodes, edges: convertedEdges };

}

export const fetchGraph = async ( project_id: string ) => {

    const supabase = await createClient();

    await requireUser( supabase );

    const { data: nodes, error: nodesError } = await supabase.from('nodes').select('*').eq( "project_id", project_id );

    if( nodesError ) throw nodesError;

    return convertToRfFormat( nodes );

}
