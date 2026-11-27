import { OnAirRecord } from "@/types/records";
import { getRecord } from "./serverActions";
import { redirect } from "next/navigation";
import { getMsFormatted } from "@/utils/utils";
import TimerSummaryView from "@/components/project/timer/timer-summary";
import { summarizeStoredTimer } from "@/lib/timer/summary";
import TaskCompleteCharacter from "@/components/project/character/task-complete-character";
import TaskRewardBreakdownCard from "@/components/project/task-complete/task-reward-breakdown";
import { getProject } from "@/lib/projects";
import { asRewardBreakdown } from "@/lib/rewards/breakdown";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import NextActionPrompt from "@/components/next-action/next-action-prompt";
import { loadNextActionSummary } from "@/lib/next-action/data";
import { createClient } from "@/utils/supabase/server";

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

    const nextAction = await loadNextActionSummary( await createClient(), projectId );

    const time = getMsFormatted( record.duration );
    const timer = summarizeStoredTimer( record.timer );

    return (
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">

            <div className="flex flex-col lg:basis-0 lg:grow">
                <TaskCompleteCharacter
                    record={record}
                    project={project}
                    initTotalXp={initTotalXp}
                    xpGained={xpGained}/>
                <p className="my-3">お疲れさん! {record.nodes?.task_name}を{ timer ? "集中" : "" }{time.hours}:{time.minutes}:{time.seconds}で終わらせました！ </p>
                <div className="mb-3 rounded-2xl border bg-card p-3">
                    <p className="mb-2 text-sm font-semibold">作業の記録</p>
                    <TimerSummaryView summary={timer} showPauseReasons/>
                </div>
                <NextActionPrompt
                    projectId={projectId}
                    autoOpen={ firstView && nextAction.scheduleGate.allowed }
                    candidateCount={nextAction.candidateCount}
                    saved={nextAction.saved}
                    todayKey={nextAction.todayKey}/>
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
