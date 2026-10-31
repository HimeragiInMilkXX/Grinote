import { redirect } from "next/navigation";
import { getActiveTask, startTask } from "./serverActions";
import { OnAirRecord } from "@/types/records";
import OnAirTimer from "@/components/project/onair/onair-timer";
import OnAirCharacter from "@/components/project/character/onair-character";
import { getProject } from "@/lib/projects";

type Props = {

    searchParams: Promise<{ [ key: string ]: string | undefined }>;
    params: any

}

const ProjectPageOnAir = async ( { searchParams, params }: Props ) => {

    const query = await searchParams;

    const nodeId = query.nodeId;

    const { projectId } = await params;

    let activeTask: OnAirRecord | null = await getActiveTask( projectId );
    const project: Project = await getProject( projectId );

    const tryStartTask = async () => {

        if( activeTask ) {

            redirect(`/project/${projectId}/onair`)

        } else {

            try {

                activeTask = await startTask( nodeId!, projectId );

            } catch( e: any ) {

                console.log( e.message );
                redirect(`/project/${projectId}/tree?isInitialEditMode=false`)

            }

        }

    }

    if( nodeId ) await tryStartTask();

    if( !activeTask ) {

        redirect(`/project/${projectId}/tree?isInitialEditMode=false`)

    }

    return (
        <>
            {

                activeTask && (

                    <div className="flex gap-3">
                        <OnAirCharacter project={project}/>
                        <OnAirTimer activeTask={activeTask}/>
                    </div>

                )

            }
        </>
    )
}

export default ProjectPageOnAir
