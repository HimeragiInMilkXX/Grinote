import { fetchGraph, saveGraphToNodes } from "../serverActions";
import { getLayoutedElements } from "../clientActions";
import { ReactFlowProvider } from "@xyflow/react";
import FlowClient from "@/components/flow/flow-client";

const ProjectPageTreePick = async ( { params }: { params: any } ) => {

    const { projectId } = await params;

    const { nodes, edges } = await fetchGraph(projectId);

    return (
        <ReactFlowProvider>
            <FlowClient initialNodes={nodes} initialEdges={edges} getLayoutedElements={getLayoutedElements} saveGraphToNodes={saveGraphToNodes} project_id={projectId}/>
        </ReactFlowProvider>
    )
}

export default ProjectPageTreePick
