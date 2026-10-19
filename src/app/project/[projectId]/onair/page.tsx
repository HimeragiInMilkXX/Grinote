import { redirect } from "next/navigation";
import { getActiveTask, startTask } from "./serverActions";
import { OnAirRecord } from "@/types/records";
import OnAirTimer from "@/components/project/onair/onair-timer";
import OnAirCharacter from "@/components/project/character/onair-character";
import { getProject } from "@/lib/projects";
import { updateTutorialProgress } from "../serverActions";

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

            console.log("There is another ongoing task")
            redirect(`/project/${projectId}/onair`)

        } else {

            try {

                activeTask = await startTask( nodeId!, projectId );
                await updateTutorialProgress(projectId, 2);

            } catch( e: any ) {

                console.log( e.message );
                redirect(`/project/${projectId}/tree/pick`)

            }

            console.log("Task started");
            console.log( activeTask );

        }

    }

    if( nodeId ) await tryStartTask();

    if( !activeTask ) {

        console.log("No task is on air")
        redirect(`/project/${projectId}/tree/pick`)

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
