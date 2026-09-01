import { redirect } from "next/navigation";
import { getActiveTask, pauseTask, resumeTask, startTask } from "./serverActions";
import { OnAirRecord } from "@/types/records";
import OnAirTimer from "@/components/project/display/onair/onair-timer";

type Props = {

    searchParams: Promise<{ [ key: string ]: string | undefined }>;
    params: any

}

const ProjectPageOnAir = async ( { searchParams, params }: Props ) => {

    const query = await searchParams;

    const nodeId = query.nodeId;

    const { projectId } = await params;

    let activeTask: OnAirRecord | null = await getActiveTask( projectId );

    const tryStartTask = async () => {

        if( activeTask ) {

            console.log("There is another ongoing task")
            redirect(`/project/${projectId}/onair`)

        } else {

            try {

                activeTask = await startTask( nodeId!, projectId );

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
        <div>
            {

                activeTask && (

                    <OnAirTimer activeTask={activeTask}/>

                )

            }
        </div>
    )
}

export default ProjectPageOnAir
