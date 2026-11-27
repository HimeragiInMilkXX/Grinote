import { ReactFlowProvider } from "@xyflow/react";
import { OnAirRecord } from "@/types/records";
import { getActiveTask, getPendingReport } from "../onair/serverActions";
import FlowClient from "@/components/flow/flow-client";
import { fetchGraph, saveGraphToNodes } from "./serverActions";
import { loadNextActionSummary } from "@/lib/next-action/data";
import { planHighlights } from "@/lib/next-action/resolve";
import { loadTodayScheduleHighlights } from "@/lib/schedule/data";
import { createClient } from "@/utils/supabase/server";

type Props = {

    searchParams: Promise<{ [ key: string ]: string | undefined }>;
    params: Promise<{ projectId: string }>

}

const ProjectPageTree = async ( { searchParams, params }: Props ) => {

    const query = await searchParams;

    let isInitialEditMode = query.isInitialEditMode == null ? true : ( query.isInitialEditMode === "true" );

    const { projectId } = await params;

    const activeTask: OnAirRecord | null = await getActiveTask( projectId );
    // the node of a finished task must stay as it is until its report is confirmed
    const pendingReport = await getPendingReport( projectId );

    if( activeTask || pendingReport ) {

        isInitialEditMode = false;

    }

    const { nodes, edges } = await fetchGraph(projectId);

    const supabase = await createClient();
    const [ nextAction, scheduleHighlights ] = await Promise.all( [
        loadNextActionSummary( supabase, projectId ),
        loadTodayScheduleHighlights( supabase, projectId ),
    ] );

    return (
        <ReactFlowProvider>
            <FlowClient hasActiveTask={!!activeTask || !!pendingReport} saveGraphToNodes={saveGraphToNodes} isInitialEditMode={isInitialEditMode} initialNodes={nodes} initialEdges={edges} project_id={projectId} nextActionHighlights={planHighlights( nextAction.saved )} scheduleHighlights={scheduleHighlights}/>
        </ReactFlowProvider>
    )
}

export default ProjectPageTree
