import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { BookOpenText, NotebookPen } from "lucide-react";
import Link from "next/link";

type Props = {
    projectId: string;
    /** record id of a finished task whose report is still pending */
    pendingReportId: number | null;
};

/** Dashboard entry to the journey timeline (replaces the old 記録一覧 dialog). */
const ProjectDashboardJourneyLink = ( { projectId, pendingReportId }: Props ) => {

    return (
        <div className="flex flex-col gap-3">

            { pendingReportId !== null && (
                <Alert>
                    <NotebookPen/>
                    <AlertTitle> 未提出のレポートがあります </AlertTitle>
                    <AlertDescription className="flex flex-col items-start gap-2">
                        <span> 振り返りを書いて確定すると、経験値を受け取れます。 </span>
                        <Link href={`/project/${projectId}/task_report?recordId=${pendingReportId}`}>
                            <Button size="sm"> レポートを書く </Button>
                        </Link>
                    </AlertDescription>
                </Alert>
            ) }

            <Link href={`/project/${projectId}/journey`}>
                <Button variant="secondary" className="w-full cursor-pointer border border-black/20">
                    <BookOpenText/> ジャーニーを見る
                </Button>
            </Link>

        </div>
    );

};

export default ProjectDashboardJourneyLink;
