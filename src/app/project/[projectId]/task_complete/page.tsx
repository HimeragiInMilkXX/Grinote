import { OnAirRecord } from "@/types/records";
import { getRecord } from "./serverActions";
import { redirect } from "next/navigation";
import { getMsFormatted } from "@/utils/utils";
import TaskCompleteCharacter from "@/components/project/character/task-complete-character";
import TaskRewardBreakdownCard from "@/components/project/task-complete/task-reward-breakdown";
import { getProject } from "@/lib/projects";
import { asRewardBreakdown } from "@/lib/rewards/breakdown";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const ProjectTaskCompletePage = async ( { searchParams, params }: PageProps<"/project/[projectId]/task_complete"> ) => {

    const { recordId } = await searchParams;
    const { projectId } = await params;

    if( typeof recordId !== "string" ) redirect( `/project/${projectId}/dashboard` );

    const record: OnAirRecord = await getRecord( Number(recordId), projectId );

    const project: Project = await getProject( projectId )

    const breakdown = asRewardBreakdown( record.reward_breakdown );

    // XP was awarded at completion. First visit: animate before -> after. Revisit: show the result.
    const firstView = !record.reward_redeemed;
    const initTotalXp = breakdown ? ( firstView ? breakdown.before.totalXp : breakdown.after.totalXp ) : Number( project.character_xp );
    const xpGained = breakdown && firstView ? breakdown.awardedXp : 0;

    const time = getMsFormatted( record.duration );

    return (
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">

            <div className="flex flex-col lg:basis-0 lg:grow">
                <TaskCompleteCharacter
                    record={record}
                    project={project}
                    initTotalXp={initTotalXp}
                    xpGained={xpGained}/>
                <p className="my-3">お疲れさん! {record.nodes?.task_name}を{time.hours}:{time.minutes}:{time.seconds}で終わらせました！ </p>
                <div className="w-full flex gap-3">

                    <Link href={`/project/${projectId}/dashboard`} className="basis-0 grow">
                        <Button className="w-full border border-black/20 cursor-pointer" variant="secondary"> ダッシュボードへ </Button>
                    </Link>

                    <Link href={`/project/${projectId}/journey`} className="basis-0 grow">
                        <Button className="w-full border border-black/20 cursor-pointer" variant="secondary"> ジャーニーで見る </Button>
                    </Link>

                    <Link href={`/project/${projectId}/character`} className="basis-0 grow">
                        <Button className="w-full cursor-pointer"> キャラクターへ </Button>
                    </Link>

                </div>
            </div>

            <div className="lg:basis-0 lg:grow">
                {
                    breakdown
                        ? <TaskRewardBreakdownCard breakdown={breakdown}/>
                        : <p className="text-sm text-muted-foreground"> この記録は旧方式で計算されました（固定 { record.xp_change ?? 0 } XP）。 </p>
                }
            </div>

        </div>
    )
}

export default ProjectTaskCompletePage
