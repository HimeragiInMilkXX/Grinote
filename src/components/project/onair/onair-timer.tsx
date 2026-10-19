"use client"

import { abandonTask, completeTask, pauseTask, resumeTask } from "@/app/project/[projectId]/onair/serverActions";
import { Button } from "@/components/ui/button";
import { useSyncedDuration } from "@/hooks/useSyncedDuration"
import { OnAirRecord } from "@/types/records";
import { getMsFormatted } from "@/utils/utils";
import { useState } from "react";

interface Props { activeTask: OnAirRecord }

const OnAirTimer = ( { activeTask }: Props ) => {

    const [ task, setTask ] = useState<OnAirRecord>( activeTask );

    const { startTimer, pauseTimer, elapsedMs } = useSyncedDuration( task.updated_at, task.duration, task.status );

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
        await completeTask( activeTask.id, activeTask.nodes!, activeTask.project_id, elapsedMs );

    }

    const abandon = async () => {

        pauseTimer();
        await abandonTask( activeTask.id, activeTask.node_id, activeTask.project_id );

    }

    return (
        <div className="flex flex-col gap-3">
            <p className="text-2xl">{ getMsFormatted( elapsedMs ).minutes }:{ getMsFormatted( elapsedMs ).seconds }</p>

            {
                
                task.status === "active" ?
                <Button onClick={pause}> 一時停止 </Button> :
                <Button onClick={resume}> 再開 </Button>

            }

            <Button onClick={complete}> 完成 </Button>
            <Button onClick={abandon}> 諦める </Button>

        </div>
    )
}

export default OnAirTimer
