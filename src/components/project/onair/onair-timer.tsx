"use client"

import { abandonTask, completeTask, pauseTask, resumeTask } from "@/app/project/[projectId]/onair/serverActions";
import { updateTutorialProgress } from "@/app/project/[projectId]/serverActions";
import { Button } from "@/components/ui/button";
import { useSyncedDuration } from "@/hooks/useSyncedDuration"
import { OnAirRecord } from "@/types/records";
import { getMsFormatted } from "@/utils/utils";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface Props { activeTask: OnAirRecord }

const OnAirTimer = ( { activeTask }: Props ) => {

    const [ task, setTask ] = useState<OnAirRecord>( activeTask );
    const [ ended, setEnded ] = useState<boolean>(false);

    useEffect( () => {

        updateTutorialProgress(activeTask.project_id, 2).then( ( res ) => {if( res ) toast.success("「タスクを1つ開始する」達成！次はそれを完成しよう！", { position: "top-left" })} )

    }, [])

    const { startTimer, pauseTimer, elapsedMs, isRunning } = useSyncedDuration( task.updated_at, task.duration, task.status );

    const pause = async () => {
        setTask( await pauseTask( activeTask.id, activeTask.nodes!.id!, activeTask.project_id, elapsedMs ) )
        pauseTimer();
    }

    const resume = async () => {
        setTask( await resumeTask( activeTask.id, activeTask.nodes!.id!, activeTask.project_id ) )
        startTimer();
    }

    const complete = async () => {

        pauseTimer();
        setEnded( true )
        await completeTask( activeTask.id, activeTask.nodes!, activeTask.project_id, elapsedMs );

    }

    const abandon = async () => {

        pauseTimer();
        setEnded( true )
        await abandonTask( activeTask.id, activeTask.node_id, activeTask.project_id );

    }

    return (
        <div className="flex flex-col gap-3">
            <p className="text-2xl">{ getMsFormatted( elapsedMs ).minutes }:{ getMsFormatted( elapsedMs ).seconds }</p>

            {

                task.status === "active" ?
                <Button onClick={pause} disabled={!isRunning}> 一時停止 </Button> :
                <Button onClick={resume} disabled={isRunning}> 再開 </Button>

            }

            <Button onClick={complete} disabled={ended}> 完成 </Button>
            <Button onClick={abandon} disabled={ended}> 諦める </Button>

        </div>
    )
}

export default OnAirTimer
