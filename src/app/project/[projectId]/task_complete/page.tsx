import { OnAirRecord } from "@/types/records";
import { getRecord } from "./serverActions";
import { redirect } from "next/navigation";
import { getMsFormatted } from "@/utils/utils";
import TaskCompleteCharacter from "@/components/project/character/task-complete-character";
import { getProject } from "@/lib/projects";

type Props = {

    searchParams: Promise<{ [key: string]: string | undefined }>;
    params: any;

}

const ProjectTaskCompletePage = async ( { searchParams, params }: Props ) => {

    const { recordId } = await searchParams;
    const { projectId } = await params;

    if( !recordId ) redirect( `/project/${projectId}/dashboard` );

    const record: OnAirRecord = await getRecord( Number(recordId), projectId );

    const project: Project = await getProject( projectId )

    // FIX THIS DOUBLE LOADING ISSUE
    if( record.reward_redeemed ) redirect( `/project/${projectId}/dashboard` );

    const time = getMsFormatted( record.duration );

    return (
        <>
        
            {

                ( !record.reward_redeemed && record ) && (

                    <div>
                        <TaskCompleteCharacter
                            record={record}
                            project={project}
                            characterLevelChanges={{

                                prev_lv: record.projects.character_level,
                                prev_xp: record.projects.character_xp,
                                xp_gained: record.xp_change ?? 0,

                                growth_step: record.projects.characters!.growth_step

                            }}/>
                        <p>お疲れさん! {record.nodes?.task_name}を{time.hours}:{time.minutes}:{time.seconds}で終わらせました！ </p>
                    </div>

                )

            }
        
        </>
    )
}

export default ProjectTaskCompletePage
