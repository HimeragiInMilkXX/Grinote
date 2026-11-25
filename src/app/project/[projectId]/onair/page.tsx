import { redirect } from "next/navigation";
import { getActiveTask, getPendingReport, getTaskFromNode } from "./serverActions";
import { OnAirRecord } from "@/types/records";
import OnAirTimer from "@/components/project/onair/onair-timer";
import OnAirCharacter from "@/components/project/character/onair-character";
import { getProject } from "@/lib/projects";
import { getNodeLinks } from "../materials/serverActions";
import OnAirLinkedMaterials from "@/components/project/onair/onair-linked-materials";
import { MaterialSummary } from "@/types/materials";
import TimerStartPanel from "@/components/project/onair/timer/timer-start-panel";

const ProjectPageOnAir = async ( { searchParams, params }: PageProps<"/project/[projectId]/onair"> ) => {

    const query = await searchParams;

    const nodeId = typeof query.nodeId === "string" ? query.nodeId : undefined;

    const { projectId } = await params;

    // a finished task waits for its report before anything else can start
    const pendingReport = await getPendingReport( projectId );
    if( pendingReport ) redirect( `/project/${projectId}/task_report?recordId=${pendingReport.id}` );

    const activeTask: OnAirRecord | null = await getActiveTask( projectId );

    if( !activeTask ) {

        // started from the tree: pick a timer first (the record is created by startTask)
        if( nodeId ) {

            const task = await getTaskFromNode( nodeId, projectId ).catch( () => null );

            if( task?.isAction && !task.isCompleted ) {

                return (
                    <div className="flex justify-center">
                        <TimerStartPanel projectId={projectId} nodeId={nodeId} taskName={task.task_name}/>
                    </div>
                );

            }

        }

        redirect(`/project/${projectId}/tree?isInitialEditMode=false`)

    }

    // a task is already running: the requested node can't start
    if( nodeId && nodeId !== activeTask.node_id ) redirect( `/project/${projectId}/onair` );

    const project: Project = await getProject( projectId );

    const linkedMaterials: MaterialSummary[] = await getNodeLinks( projectId, activeTask.node_id ).catch( () => [] );

    return (
        <div className="flex flex-col items-center gap-6">
            <div className="flex gap-3">
                <OnAirCharacter project={project}/>
                <OnAirTimer activeTask={activeTask} serverNow={Date.now()}/>
            </div>
            <OnAirLinkedMaterials project_id={projectId} node_id={activeTask.node_id} initialMaterials={linkedMaterials}/>
        </div>
    )
}

export default ProjectPageOnAir
