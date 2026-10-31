import { ReactFlowProvider } from "@xyflow/react";
import { OnAirRecord } from "@/types/records";
import { redirect } from "next/navigation";
import { getActiveTask } from "../onair/serverActions";
import FlowClient from "@/components/flow/flow-client";
import { fetchGraph, saveGraphToNodes } from "./serverActions";
import { getLayoutedElements } from "./clientActions";

type Props = {

    searchParams: Promise<{ [ key: string ]: string | undefined }>;
    params: any

}

const ProjectPageTree = async ( { searchParams, params }: Props ) => {

    const query = await searchParams;

    const isInitialEditMode = ( query.isInitialEditMode == null || query.isInitialEditMode == undefined ) ? true : ( query.isInitialEditMode === "true" );

    const { projectId } = await params;

    let activeTask: OnAirRecord | null = await getActiveTask( projectId );

    if( activeTask ) {

        redirect(`/project/${projectId}/onair`)

    }

    const { nodes, edges } = await fetchGraph(projectId);

    return (
        <ReactFlowProvider>
            <FlowClient saveGraphToNodes={saveGraphToNodes} isInitialEditMode={isInitialEditMode} initialNodes={nodes} initialEdges={edges} getLayoutedElements={getLayoutedElements} project_id={projectId}/>
        </ReactFlowProvider>
    )
}

export default ProjectPageTree