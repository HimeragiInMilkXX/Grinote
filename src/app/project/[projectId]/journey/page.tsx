import JourneyStatsCard from "@/components/project/journey/journey-stats";
import JourneyTimeline from "@/components/project/journey/journey-timeline";
import { BookOpenText } from "lucide-react";
import { getJourney } from "./serverActions";

const ProjectJourneyPage = async ( { params }: PageProps<"/project/[projectId]/journey"> ) => {

    const { projectId } = await params;

    const { stats, entries, pendingReportId } = await getJourney( projectId );

    return (
        <div className="flex h-[90vh] w-full justify-center overflow-y-auto">
            <div className="flex w-full max-w-3xl flex-col gap-4 px-4 py-2 *:shrink-0">
                <div className="flex flex-col gap-1">
                    <h1 className="flex items-center gap-2 text-xl font-semibold"><BookOpenText className="size-6"/> ジャーニー </h1>
                    <p className="text-sm text-muted-foreground"> これまでの作業・振り返り・AIの分析の記録です。記録をクリックすると詳細を表示します。 </p>
                </div>
                <JourneyStatsCard stats={stats}/>
                <JourneyTimeline projectId={projectId} entries={entries} pendingReportId={pendingReportId}/>
            </div>
        </div>
    );

};

export default ProjectJourneyPage;
