import { redirect } from "next/navigation";
import { getActiveTask, getPendingReport, startTask } from "./serverActions";
import { OnAirRecord } from "@/types/records";
import OnAirTimer from "@/components/project/onair/onair-timer";
import OnAirCharacter from "@/components/project/character/onair-character";
import { getProject } from "@/lib/projects";
import { errorMessage } from "@/utils/utils";
import { getNodeLinks } from "../materials/serverActions";
import OnAirLinkedMaterials from "@/components/project/onair/onair-linked-materials";
import { MaterialSummary } from "@/types/materials";

const ProjectPageOnAir = async ( { searchParams, params }: PageProps<"/project/[projectId]/onair"> ) => {

    const query = await searchParams;

    const nodeId = typeof query.nodeId === "string" ? query.nodeId : undefined;

    const { projectId } = await params;

    // a finished task waits for its report before anything else can start
    const pendingReport = await getPendingReport( projectId );
    if( pendingReport ) redirect( `/project/${projectId}/task_report?recordId=${pendingReport.id}` );

    let activeTask: OnAirRecord | null = await getActiveTask( projectId );
    const project: Project = await getProject( projectId );

    const tryStartTask = async ( nodeId: string ) => {

        if( activeTask ) {

            redirect(`/project/${projectId}/onair`)

        } else {

            try {

                activeTask = await startTask( nodeId, projectId );

            } catch( e ) {

                console.error( errorMessage( e ) );
                redirect(`/project/${projectId}/tree?isInitialEditMode=false`)

            }

        }

    }

    if( nodeId ) await tryStartTask( nodeId );

    if( !activeTask ) {

        redirect(`/project/${projectId}/tree?isInitialEditMode=false`)

    }

    // node_id is reliable; the joined node key differs between getActiveTask (node) and startTask (nodes)
    const linkedMaterials: MaterialSummary[] = activeTask ? await getNodeLinks( projectId, activeTask.node_id ).catch( () => [] ) : [];

    return (
        <>
            {

                activeTask && (

                    <div className="flex flex-col items-center gap-6">
                        <div className="flex gap-3">
                            <OnAirCharacter project={project}/>
                            <OnAirTimer activeTask={activeTask}/>
                        </div>
                        <OnAirLinkedMaterials project_id={projectId} node_id={activeTask.node_id} initialMaterials={linkedMaterials}/>
                    </div>

                )

            }
        </>
    )
}

export default ProjectPageOnAir
