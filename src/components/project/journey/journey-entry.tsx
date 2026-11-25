import TaskRewardBreakdownCard from "@/components/project/task-complete/task-reward-breakdown";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { JourneyEntry } from "@/lib/journey/history";
import { settledClarifications } from "@/lib/journey/journal";
import { REFLECTION_QUESTIONS } from "@/lib/journey/reflection";
import { ChevronDown, FileUp, MessageCircleQuestion } from "lucide-react";
import type { ReactNode } from "react";
import { formatDateTime, formatMinutes } from "./format";
import JourneyAnalysisView, { scoreTone } from "./journey-analysis-view";
import TimerSummaryView from "@/components/project/timer/timer-summary";

function ScoreBadge( { entry }: { entry: JourneyEntry } ) {

    const journal = entry.journal;

    if( !journal ) return <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"> 旧バージョン </span>;
    if( journal.aiScore === null || !journal.analysis ) return <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"> AI分析なし </span>;

    return <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold tabular-nums ${ scoreTone( journal.aiScore ) }`}> AI { journal.aiScore } </span>;

}

function Block( { title, children }: { title: string; children: ReactNode } ) {

    return (
        <section className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">{ title }</h3>
            { children }
        </section>
    );

}

/** One completed task on the journey timeline: a summary that expands to every detail. */
const JourneyTimelineEntry = ( { entry }: { entry: JourneyEntry } ) => {

    const { journal, breakdown } = entry;
    const analysis = journal?.analysis ?? null;
    const clarifications = journal ? settledClarifications( journal.clarifications ) : [];
    const levelUp = !!breakdown && breakdown.after.level > breakdown.before.level;

    return (
        <li className="relative pl-8">

            {/* timeline dot */}
            <span aria-hidden className="absolute left-[7px] top-5 size-3 rounded-full border-2 border-background bg-primary ring-2 ring-primary/30"/>

            <Collapsible className="rounded-2xl border bg-card">

                <CollapsibleTrigger className="group flex w-full cursor-pointer flex-col gap-2 px-4 py-3 text-left">

                    <div className="flex w-full flex-wrap items-center justify-between gap-2">
                        <span className="text-xs text-muted-foreground tabular-nums">{ formatDateTime( entry.completedAt ) }</span>
                        <div className="flex items-center gap-2">
                            <ScoreBadge entry={entry}/>
                            <span className="text-sm font-semibold text-green-600 tabular-nums">+{ entry.xp } XP</span>
                            <ChevronDown className="size-4 text-muted-foreground transition-transform group-data-[panel-open]:rotate-180"/>
                        </div>
                    </div>

                    <p className="font-medium">{ entry.taskName }</p>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span> 予定 { formatMinutes( entry.estimatedMinutes ) } </span>
                        <span> 集中 { formatMinutes( entry.actualMinutes, "0分" ) }{ entry.timer ? `（${ entry.timer.sessions }セッション）` : "" } </span>
                        { entry.timer && <span> 休憩 { entry.timer.breaks }回・{ formatMinutes( entry.timer.breakMs / 60000, "0分" ) } </span> }
                        { breakdown && (
                            <span className={ levelUp ? "font-semibold text-primary" : undefined }>
                                Lv.{ breakdown.before.level }{ levelUp ? ` → Lv.${ breakdown.after.level }` : "" }（累計 { Math.round( breakdown.after.totalXp ) } XP）
                            </span>
                        ) }
                    </div>

                    { analysis && <p className="line-clamp-2 text-sm text-foreground/80">{ analysis.conclusion }</p> }

                </CollapsibleTrigger>

                <CollapsibleContent className="flex flex-col gap-6 border-t px-4 py-4">

                    { entry.taskDescription && (
                        <Block title="タスクの説明">
                            <p className="text-sm whitespace-pre-wrap text-foreground/80">{ entry.taskDescription }</p>
                        </Block>
                    ) }

                    <Block title="作業の記録">
                        <TimerSummaryView summary={ entry.timer } showPauseReasons/>
                    </Block>

                    <Block title="振り返り">
                        { journal ? (
                            <dl className="flex flex-col gap-3">
                                { REFLECTION_QUESTIONS.map( q => (
                                    <div key={q.key}>
                                        <dt className="text-xs font-medium text-muted-foreground">{ q.label }</dt>
                                        <dd className="text-sm whitespace-pre-wrap">{ journal.reflection[ q.key ] || "—" }</dd>
                                    </div>
                                ) ) }
                            </dl>
                        ) : <p className="text-sm text-muted-foreground"> 振り返りなし（ジャーニー機能より前の記録です） </p> }
                    </Block>

                    { clarifications.length > 0 && (
                        <Block title="AIからの質問">
                            <ul className="flex flex-col gap-2">
                                { clarifications.map( ( c, i ) => (
                                    <li key={i} className="text-sm">
                                        <p className="flex items-start gap-1.5 text-muted-foreground"><MessageCircleQuestion className="mt-0.5 size-3.5 shrink-0"/>{ c.question }</p>
                                        <p className="pl-5 whitespace-pre-wrap">{ c.skipped ? "（これ以上書けない）" : c.answer }</p>
                                    </li>
                                ) ) }
                            </ul>
                        </Block>
                    ) }

                    <Block title="証拠">
                        <p className="flex items-center gap-1.5 text-sm text-muted-foreground"><FileUp className="size-4"/> 証拠なし（アップロード機能は準備中） </p>
                    </Block>

                    <Block title="AIの分析">
                        { analysis
                            ? <JourneyAnalysisView analysis={analysis}/>
                            : <p className="text-sm text-muted-foreground"> { journal ? "AIの分析ができなかったため、AI評価なしで記録しました。" : "AI分析なし" } </p> }
                    </Block>

                    <Block title="獲得XP・キャラクターの成長">
                        { breakdown
                            ? <TaskRewardBreakdownCard breakdown={breakdown}/>
                            : <p className="text-sm text-muted-foreground"> この記録は旧方式で計算されました（固定 { entry.xp } XP）。 </p> }
                    </Block>

                </CollapsibleContent>

            </Collapsible>

        </li>
    );

};

export default JourneyTimelineEntry;
