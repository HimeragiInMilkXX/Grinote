import { OnAirRecord } from "@/types/records";
import { getRecord } from "./serverActions";
import { redirect } from "next/navigation";
import { getMsFormatted } from "@/utils/utils";

type Props = {

    searchParams: Promise<{ [key: string]: string | undefined }>;
    params: any;

}

const ProjectTaskCompletePage = async ( { searchParams, params }: Props ) => {

    const { recordId } = await searchParams;
    const { projectId } = await params;

    if( !recordId ) redirect( `/project/${projectId}/dashboard` );

    const record: OnAirRecord = await getRecord( recordId, projectId );

    const time = getMsFormatted( record.duration );

    return (
        <div>
            <p>お疲れさん! {record.nodes?.task_name}を{time.hours}:{time.minutes}:{time.seconds}で終わらせました！ </p>
        </div>
    )
}

export default ProjectTaskCompletePage
