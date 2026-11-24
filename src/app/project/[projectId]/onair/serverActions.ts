"use server";

import { Task } from "@/types/flow";
import { OnAirRecord } from "@/types/records";
import { createActionClient } from "@/utils/supabase/actions";
import { createJournalSnapshot, type JournalNodeSnapshot } from "@/lib/journey/journal-db";
import { createClient, requireUser } from "@/utils/supabase/server";
import { intervalToDurationObject } from "@/utils/utils";
import { redirect } from "next/navigation";

export const getActiveTask = async ( project_id: string ): Promise<OnAirRecord | null> => {

    const supabase = await createClient();

    const { data: activeTask, error } = await supabase.from("records").select("*, nodes ( * )").eq("project_id", project_id).in( 'status', ["paused", "active"] );

    if( error ) throw error.message

    if( activeTask.length > 1 ) throw new Error("More than one task is active");

    if( activeTask.length < 1 ) return null;

    const task = activeTask[0];

    return {

        ...task,
        node: {

            ...task.nodes,
            time_limit: intervalToDurationObject( task.nodes.time_limit )

        }

    }

}

/** The record whose report is still pending (timer stopped with 完成, no XP yet), if any. */
export const getPendingReport = async ( project_id: string ): Promise<{ id: number; node_id: string } | null> => {

    const supabase = await createClient();

    const { data, error } = await supabase.from( "records" ).select( "id, node_id" ).eq( "project_id", project_id ).eq( "status", "reviewing" ).limit( 1 );

    if( error ) throw error.message;

    return data?.[0] ?? null;

}

export const getTaskFromNode = async ( node_id: string, project_id: string ): Promise<Task> => {

    const supabase = await createClient();

    const { data: taskFromNode, error } = await supabase.from("nodes").select("*").eq("project_id", project_id).eq("id", node_id).single();

    if( error ) throw error.message;
    const task: Task = {

        ...taskFromNode,
        time_limit: intervalToDurationObject(taskFromNode.time_limit),

    }

    return task;

}

export const startTask = async ( node_id: string, project_id: string ): Promise<OnAirRecord> => {

    const supabase = await createActionClient();

    const user = await requireUser( supabase );

    if( await getPendingReport( project_id ) ) throw new Error( "Finish the pending task report first" );

    const requestedTask = await getTaskFromNode( node_id, project_id );

    if( !requestedTask.isAction ) throw new Error("The requested task isn't an Action")
    if( requestedTask.isCompleted ) throw new Error( "The requested task is already completed" )

    const { data: childrenNodes, error: childrenNodesError } = await supabase
        .from("nodes")
        .select("isCompleted")
        .eq("project_id", project_id).eq("parent_node_id", node_id);

    if( childrenNodesError ) throw childrenNodesError.message

    childrenNodes?.forEach( node => {

        if( !node.isCompleted ) throw new Error( "Complete all the children tasks first!")

    })

    const { data: task, error } = await supabase.from('records').insert([{

        user_id: user.id,
        node_id: node_id,
        project_id: project_id,

    }]).select("*, nodes ( * )").single();

    if( error ) throw error.message;

    return {

        ...task,
        nodes: {

            ...task.nodes,
            time_limit: intervalToDurationObject( task.nodes.time_limit )

        }

    }

}

export const abandonTask = async ( record_id: number, node_id: string, project_id: string ) => {

    const supabase = await createActionClient();

    const { error } = await supabase.from("records").update({ status: "abandoned" }).eq("node_id", node_id).eq("project_id", project_id).eq("id", record_id).in( "status", [ "active", "paused" ] );

    if( error ) throw error.message;

    redirect(`/project/${project_id}/dashboard`)

}

export const pauseTask = async ( record_id: number, node_id: string, project_id: string, duration: number ): Promise<OnAirRecord> => {

    const supabase = await createActionClient();

    const { data: task, error } = await supabase.from("records").update({ status: "paused", duration }).eq("status", "active").eq("id", record_id).eq("node_id", node_id).eq("project_id", project_id).select("*, nodes ( * )").single();

    if( error ) throw error.message;

    return {

        ...task,
        node: {

            ...task.nodes,
            time_limit: intervalToDurationObject( task.nodes.time_limit )

        }

    }

}

export const resumeTask = async ( record_id: number, node_id: string, project_id: string ): Promise<OnAirRecord> => {

    const supabase = await createActionClient();

    const { data: task, error } = await supabase.from("records").update({ status: "active" }).eq("status", "paused").eq("id", record_id).eq("node_id", node_id).eq("project_id", project_id).select("*, nodes ( * )").single();

    if( error ) throw error.message;

    return {

        ...task,
        node: {

            ...task.nodes,
            time_limit: intervalToDurationObject( task.nodes.time_limit )

        }

    }

}

/**
 * Stops the timer for good (完成) and moves the record to 'reviewing'. No XP yet: the user writes
 * the task report first, then confirms the AI analysis on the report page, which awards the XP
 * (Reward Engine v1.0 + journey system, docs/journey-system.md).
 */
export const finishTask = async ( record_id: number, project_id: string, duration: number ) => {

    const supabase = await createActionClient();

    const user = await requireUser( supabase );

    const safeDuration = Math.max( 0, Math.round( Number.isFinite( duration ) ? duration : 0 ) );

    const { data, error } = await supabase
        .from( "records" )
        .update( { status: "reviewing", duration: safeDuration, ended_at: new Date().toISOString() } )
        .eq( "id", record_id ).eq( "project_id", project_id )
        .in( "status", [ "active", "paused" ] )
        .select( "id, node_id, nodes ( task_name, description, time_limit )" );

    if( error ) throw error.message;

    if( !data?.length ) {
        // a double click or a second tab: fine if it is already waiting for its report
        const { data: current } = await supabase.from( "records" ).select( "status" ).eq( "id", record_id ).eq( "project_id", project_id ).maybeSingle();
        if( current?.status !== "reviewing" ) throw new Error( "This task is not in progress" );
    }
    else {
        // the report's task snapshot (its estimate is what the reward uses); kept after 作業に戻る
        const row = data[0] as unknown as { node_id: string; nodes: JournalNodeSnapshot | JournalNodeSnapshot[] | null };
        const node = Array.isArray( row.nodes ) ? row.nodes[0] ?? null : row.nodes;
        await createJournalSnapshot( supabase, { recordId: record_id, projectId: project_id, userId: user.id, nodeId: row.node_id, node } );
    }

    redirect( `/project/${project_id}/task_report?recordId=${record_id}` )

}
