import { fetchGraph, saveGraphToNodes } from "../serverActions";
import { getLayoutedElements } from "../clientActions";
import { ReactFlowProvider } from "@xyflow/react";
import FlowReadOnlyClient from "@/components/flow/flow-read-only-client";
import { OnAirRecord } from "@/types/records";
import { getActiveTask } from "../../onair/serverActions";
import { redirect } from "next/navigation";

const ProjectPageTreeEdit = async ( { params }: { params: any } ) => {

    const { projectId } = await params;

    let activeTask: OnAirRecord | null = await getActiveTask( projectId );

    if( activeTask ) {

        console.log("There is another ongoing task")
        redirect(`/project/${projectId}/onair`)

    }

    const { nodes, edges } = await fetchGraph(projectId);

    return (
        <ReactFlowProvider>
            <FlowReadOnlyClient initialNodes={nodes} initialEdges={edges} getLayoutedElements={getLayoutedElements} saveGraphToNodes={saveGraphToNodes} project_id={projectId}/>
        </ReactFlowProvider>
    )
}

export default ProjectPageTreeEdit
