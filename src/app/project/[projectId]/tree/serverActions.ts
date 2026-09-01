"use server";

import { TableTaskRow, TableTaskRows, TaskNodeType } from "@/types/flow";
import { createActionClient } from "@/utils/supabase/actions";
import { createClient } from "@/utils/supabase/server";
import { durationObjectToInterval, intervalToDurationObject } from "@/utils/utils";
import { Edge, Node, ReactFlowJsonObject } from "@xyflow/react";

const convertToTableFormat = ( rawData: ReactFlowJsonObject<TaskNodeType, Edge>, project_id: string ) => {

    const convertedTasks: TableTaskRows = {};

    rawData.nodes.forEach( node => {

        convertedTasks[node.id] = {

            id: node.id,
            parent_node_id: null,
            project_id: project_id,
            ...node.data.task,

        }

    })

    return convertedTasks;

}

export const saveGraphToNodes = async ( rawData: ReactFlowJsonObject<TaskNodeType, Edge>, project_id: string ) => {

    const convertedTasks: TableTaskRows = convertToTableFormat( rawData, project_id );

    const supabase = await createActionClient();

    const { data: previousNodesIdArray, error: previousNodesIdError } = await supabase.from('nodes').select('id').eq( 'project_id', project_id );

    if( previousNodesIdError ) throw previousNodesIdError;

    const currentNodesId = new Set( Object.keys( convertedTasks ) );
    const previousNodesId = new Set( previousNodesIdArray?.map((node) => node.id) ?? [] );

    // UPSERT(UPDATE AND INSERT)
    const nodesToUpsert = Array.from(currentNodesId).map( id => {

        const node = convertedTasks[id];

        if( !node ) { return { id, project_id, parent_node_id: null }}

        const time_limit = durationObjectToInterval( node.time_limit );

        return {...node, id, project_id, parent_node_id: null, time_limit }

    })

    const { error: upsertError } = await supabase.from( "nodes" ).upsert( nodesToUpsert, { onConflict: "id" } );

    if( upsertError ) throw upsertError;

    // DELETE
    const nodesIdPendingDelete = Array.from( previousNodesId.difference( currentNodesId ) );

    if( nodesIdPendingDelete.length > 0 ) {

        const { error: deleteError } = await supabase.from( "nodes" ).delete().in('id', nodesIdPendingDelete);

        if( deleteError ) throw deleteError;

    }

    // SAVE PARENTAL RELATIONS
    if( rawData.edges.length > 0 ) {

        const updatePromises = rawData.edges.map(edge =>
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
}

const convertToRfFormat = ( tableTaskRows: ({ time_limit: string } & TableTaskRow)[] ) => {

    const convertedNodes: TaskNodeType[] = [];
    const convertedEdges: Edge[] = [];

    tableTaskRows.forEach( row => {

        convertedNodes.push( {

            id: row.id,
            position: { x: 0, y: 0 },
            connectable: !row.isCompleted && !row.isRoot,
            selectable: !row.isCompleted && !row.isRoot,
            draggable: !row.isCompleted && !row.isRoot,
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

    const { data: { user } } = await supabase.auth.getUser();

    const { data: nodes, error: nodesError } = await supabase.from('nodes').select('*').eq( "project_id", project_id );

    if( nodesError ) throw nodesError;

    return convertToRfFormat( nodes );

}