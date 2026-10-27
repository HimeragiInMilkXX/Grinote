"use server";

import { TableTaskRow, Task } from "@/types/flow";
import { OnAirRecord } from "@/types/records";
import { createActionClient } from "@/utils/supabase/actions";
import { createClient } from "@/utils/supabase/server";
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

    const { data: { user } } = await supabase.auth.getUser();

    if( !user ) throw new Error("Not logged in");

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

    const { error } = await supabase.from("records").update({ status: "abandoned" }).eq("node_id", node_id).eq("project_id", project_id).eq("id", record_id);

    if( error ) throw error.message;

    redirect(`/project/${project_id}/dashboard`)

}

export const pauseTask = async ( record_id: number, node_id: string, project_id: string, duration: number ): Promise<OnAirRecord> => {

    const supabase = await createActionClient();

    const { data: task, error } = await supabase.from("records").update({ status: "paused", duration }).eq("id", record_id).eq("node_id", node_id).eq("project_id", project_id).select("*, nodes ( * )").single();

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

    const { data: task, error } = await supabase.from("records").update({ status: "active" }).eq("id", record_id).eq("node_id", node_id).eq("project_id", project_id).select("*, nodes ( * )").single();

    if( error ) throw error.message;

    return {

        ...task,
        node: {

            ...task.nodes,
            time_limit: intervalToDurationObject( task.nodes.time_limit )

        }

    }

}

export const completeTask = async ( record_id: number, node: TableTaskRow, project_id: string, duration: number ) => {

    const node_id = node.id;

    const supabase = await createActionClient();

    const xp_change = 10;

    const resource_gained: Record<string, number> = { 1: 1, 2: 1, 3: 1 };

    const { data, error: recordError } = await supabase.from("records").update({ status: "completed", duration, completed_at: new Date(), xp_change: xp_change, resource_gained: resource_gained, reward_redeemed: false }).eq("id", record_id).eq("node_id", node_id).eq("project_id", project_id).in("status", ["active", "paused"]).select("id").single();

    if( recordError ) throw recordError.message;

    if( node.isLoop ) {

        const repetitions_completed = node.repetitions_completed + 1;

        const { error: nodeError } = await supabase.from("nodes").update( { repetitions_completed, isCompleted: repetitions_completed == node.repetitions_required  } ).eq("id", node_id).eq("project_id", project_id);

        if( nodeError ) throw nodeError.message;

    } else {

        const { error: nodeError } = await supabase.from("nodes").update( { isCompleted: true } ).eq("id", node_id).eq("project_id", project_id);

        if( nodeError ) throw nodeError.message;

    }

    redirect( `/project/${project_id}/task_complete?recordId=${data.id}` )

}
