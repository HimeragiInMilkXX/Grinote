import type { DayPanel } from "@/lib/calendar/day-panel";
import { PLAN_KIND_LABELS } from "@/lib/next-action/config";
import { dayLabel, ROLE_LABELS } from "@/lib/next-action/labels";
import { projectColorStyle } from "@/lib/projects/colors";
import { cn } from "@/lib/utils";
import { CalendarDays, Check, Repeat, Sparkles } from "lucide-react";
import Link from "next/link";

type Props = {
    panel: DayPanel;
    todayKey: string;
};

/**
 * The focused day under the calendar: every project with that day's unfinished scheduled tasks
 * (tree order), its next scheduled day, and its next action. Rows open the project's schedule.
 */
const DayTaskPanel = ( { panel, todayKey }: Props ) => {

    const title = dayLabel( panel.key, todayKey );

    return (
        <section className="flex flex-col gap-3" aria-label={`${title}の予定`} aria-live="polite">

            <h3 className="flex items-center gap-1.5 text-base font-medium">
                <CalendarDays className="size-4 text-primary"/> { title }の予定
                { ( title === "今日" || title === "明日" ) && (
                    <span className="text-sm font-normal text-muted-foreground"> { Number( panel.key.slice( 5, 7 ) ) }/{ Number( panel.key.slice( 8, 10 ) ) } </span>
                ) }
            </h3>

            <ul className="grid gap-2 md:grid-cols-2">
                { panel.rows.map( row => {

                    const style = projectColorStyle( row.color );

                    return (
                        <li key={row.projectId} className={cn( "flex flex-col gap-1.5 rounded-xl border border-l-4 bg-card px-3 py-2", style.accent )}>

                            <Link href={`/project/${row.projectId}/schedule`} className="flex items-center gap-1.5 text-sm font-medium hover:underline">
                                <span aria-hidden className={cn( "size-2.5 shrink-0 rounded-full", style.dot )}/>
                                <span className="truncate">{ row.name }</span>
                                { row.pastGoal
                                    ? <span className="shrink-0 text-[0.7rem] font-normal text-muted-foreground">目標日を過ぎました</span>
                                    : !row.isWorkDay && <span className="shrink-0 text-[0.7rem] font-normal text-muted-foreground">作業日ではありません</span> }
                                { row.doneCount > 0 && <span className="ml-auto flex shrink-0 items-center gap-0.5 text-[0.7rem] font-normal text-green-700"><Check className="size-3"/> { row.doneCount }件完了</span> }
                            </Link>

                            { row.tasks.length > 0 ? (
                                <ul className="flex flex-col gap-0.5 pl-4 text-xs">
                                    { row.tasks.map( t => (
                                        <li key={t.id} className="flex items-center gap-1">
                                            { t.isLoop ? <Repeat className="size-3 shrink-0 text-muted-foreground" aria-label="繰り返し"/> : <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-foreground/60"/> }
                                            <span className="truncate">{ t.name }</span>
                                            { t.dayKey !== panel.key && <span className="shrink-0 rounded bg-amber-100 px-1 text-[0.65rem] text-amber-900"> 持ち越し（{ dayLabel( t.dayKey, todayKey ) }） </span> }
                                        </li>
                                    ) ) }
                                </ul>
                            ) : (
                                <p className="pl-4 text-xs text-muted-foreground">
                                    { row.doneCount > 0 ? "この日の予定はすべて終わりました" : "この日の予定はありません" }
                                </p>
                            ) }

                            { row.next && (
                                <p className="truncate pl-4 text-xs text-muted-foreground">
                                    次の予定：{ dayLabel( row.next.key, todayKey ) } ・ { row.next.tasks.map( t => t.name ).join( "、" ) }
                                </p>
                            ) }

                            { row.plan && (
                                <div className="flex flex-col gap-0.5 border-t pt-1 pl-4 text-xs">
                                    <span className="flex items-center gap-1 text-muted-foreground">
                                        <Sparkles className="size-3 text-primary"/> 次のアクション：{ PLAN_KIND_LABELS[ row.plan.kind ] }
                                        { row.plan.carriedOver && <span className="ml-1 rounded bg-amber-100 px-1 text-amber-900">持ち越し（{ dayLabel( row.plan.scheduledFor, todayKey ) }）</span> }
                                    </span>
                                    { row.plan.items.map( item => (
                                        <span key={item.role} className={cn( "flex items-center gap-1", item.done && "text-muted-foreground line-through" )}>
                                            { item.done ? <Check className="size-3 text-green-700"/> : <span className="text-[0.65rem] text-muted-foreground">{ ROLE_LABELS[ item.role ] }</span> }
                                            <span className="truncate">{ item.name }</span>
                                        </span>
                                    ) ) }
                                </div>
                            ) }

                            { !row.plan && row.planLaterKey && (
                                <p className="pl-4 text-xs text-muted-foreground"><Sparkles className="mr-1 inline size-3 text-primary"/>次のアクション：{ dayLabel( row.planLaterKey, todayKey ) }</p>
                            ) }

                        </li>
                    );

                } ) }
            </ul>

        </section>
    );

};

export default DayTaskPanel;
