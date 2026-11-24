import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { JourneyEntry } from "@/lib/journey/history";
import { Footprints, NotebookPen } from "lucide-react";
import Link from "next/link";
import JourneyTimelineEntry from "./journey-entry";

type Props = {
    projectId: string;
    entries: JourneyEntry[];
    pendingReportId: number | null;
};

const JourneyTimeline = ( { projectId, entries, pendingReportId }: Props ) => {

    return (
        <div className="flex flex-col gap-4">

            { pendingReportId !== null && (
                <Alert>
                    <NotebookPen/>
                    <AlertTitle> 未提出のレポートがあります </AlertTitle>
                    <AlertDescription className="flex flex-col items-start gap-2">
                        <span> 振り返りを確定すると、ジャーニーに記録されて経験値を受け取れます。 </span>
                        <Link href={`/project/${projectId}/task_report?recordId=${pendingReportId}`}><Button size="sm"> レポートを書く </Button></Link>
                    </AlertDescription>
                </Alert>
            ) }

            { entries.length === 0 ? (
                <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">
                    <Footprints className="size-6"/>
                    <p> まだ完了したタスクはありません。 </p>
                    <p> タスクを完了してレポートを確定すると、ここに記録されていきます。 </p>
                </div>
            ) : (
                <ol className="relative flex flex-col gap-4 before:absolute before:left-[12px] before:top-2 before:bottom-2 before:w-px before:bg-border">
                    { entries.map( entry => <JourneyTimelineEntry key={entry.recordId} entry={entry}/> ) }
                </ol>
            ) }

        </div>
    );

};

export default JourneyTimeline;
