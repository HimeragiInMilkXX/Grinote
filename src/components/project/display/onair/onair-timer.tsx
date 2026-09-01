"use client"

import { completeTask, pauseTask, resumeTask } from "@/app/project/[projectId]/onair/serverActions";
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
        setTask( await pauseTask( activeTask.nodes!.id!, activeTask.project_id, elapsedMs ) )
        pauseTimer();
    }

    const resume = async () => {
        setTask( await resumeTask( activeTask.nodes!.id!, activeTask.project_id ) )
        startTimer();
    }

    const complete = async () => {

        pauseTimer();
        await completeTask( activeTask.nodes!, activeTask.project_id, elapsedMs );

    }

    return (
        <div className="flex flex-col gap-3">
            <p className="text-2xl">{ getMsFormatted( elapsedMs ).minutes }:{ getMsFormatted( elapsedMs ).seconds }</p>

            {
                
                task.status === "active" ?
                <Button onClick={pause}> Pause </Button> :
                <Button onClick={resume}> Resume </Button>

            }

            <Button onClick={complete}> End Session </Button>

        </div>
    )
}

export default OnAirTimer
