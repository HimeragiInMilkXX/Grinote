import { redirect } from "next/navigation";
import TaskReportFlow from "@/components/project/task-report/task-report-flow";
import { getReport } from "./serverActions";

const ProjectTaskReportPage = async ( { searchParams, params }: PageProps<"/project/[projectId]/task_report"> ) => {

    const { recordId } = await searchParams;
    const { projectId } = await params;

    const id = typeof recordId === "string" ? Number( recordId ) : NaN;

    if( !Number.isInteger( id ) || id <= 0 ) redirect( `/project/${projectId}/dashboard` );

    const report = await getReport( id, projectId );

    return (
        <div className="flex h-[90vh] w-full justify-center overflow-y-auto">
            <TaskReportFlow report={report}/>
        </div>
    );

};

export default ProjectTaskReportPage;
