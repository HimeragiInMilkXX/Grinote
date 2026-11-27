import type { NextActionDay } from "@/lib/calendar/next-actions";
import { PLAN_KIND_LABELS } from "@/lib/next-action/config";
import { dayLabel, ROLE_LABELS } from "@/lib/next-action/labels";
import { projectColorStyle } from "@/lib/projects/colors";
import { cn } from "@/lib/utils";
import { Check, Sparkles } from "lucide-react";
import Link from "next/link";

type Props = {
    days: NextActionDay[];
    todayKey: string;
};

/** 今日 / 明日: every project with its next action (if any). Rows open the goal tree. */
const NextActionPanel = ( { days, todayKey }: Props ) => {

    return (
        <section className="flex flex-col gap-3" aria-label="次のアクション">

            <h3 className="flex items-center gap-1.5 text-base font-medium"><Sparkles className="size-4 text-primary"/> 次のアクション</h3>

            <div className="grid gap-3 md:grid-cols-2">
                { days.map( day => (
                    <div key={day.key} className="flex flex-col gap-2 rounded-xl border bg-card p-3">

                        <p className="text-sm font-semibold">{ day.label } <span className="font-normal text-muted-foreground">{ Number( day.key.slice( 5, 7 ) ) }/{ Number( day.key.slice( 8, 10 ) ) }</span></p>

                        <ul className="flex flex-col gap-1.5">
                            { day.rows.map( row => {
                                const style = projectColorStyle( row.color );
                                return (
                                    <li key={row.projectId}>
                                        <Link href={`/project/${row.projectId}/tree`} className={cn( "flex flex-col gap-1 rounded-lg border-l-4 bg-background px-2.5 py-2 transition-colors hover:bg-muted", style.accent )}>

                                            <span className="flex items-center gap-1.5 text-sm font-medium">
                                                <span aria-hidden className={cn( "size-2.5 shrink-0 rounded-full", style.dot )}/>
                                                <span className="truncate">{ row.name }</span>
                                                { row.pastGoal
                                                    ? <span className="shrink-0 text-[0.7rem] font-normal text-muted-foreground">目標日を過ぎました</span>
                                                    : !row.isWorkDay && <span className="shrink-0 text-[0.7rem] font-normal text-muted-foreground">作業日ではありません</span> }
                                            </span>

                                            { row.plan ? (
                                                <span className="flex flex-col gap-0.5 pl-4 text-xs">
                                                    <span className="text-muted-foreground">
                                                        { PLAN_KIND_LABELS[ row.plan.kind ] }
                                                        { row.plan.carriedOver && <span className="ml-1.5 rounded bg-amber-100 px-1 text-amber-900">持ち越し（{ dayLabel( row.plan.scheduledFor, todayKey ) }）</span> }
                                                    </span>
                                                    { row.plan.items.map( item => (
                                                        <span key={item.role} className={cn( "flex items-center gap-1", item.done && "text-muted-foreground line-through" )}>
                                                            { item.done ? <Check className="size-3 text-green-700"/> : <span className="text-[0.65rem] text-muted-foreground">{ ROLE_LABELS[ item.role ] }</span> }
                                                            <span className="truncate">{ item.name }</span>
                                                        </span>
                                                    ) ) }
                                                </span>
                                            ) : (
                                                <span className="pl-4 text-xs text-muted-foreground">
                                                    { row.laterKey ? `次の予定：${dayLabel( row.laterKey, todayKey )}` : "次のアクションはまだありません" }
                                                </span>
                                            ) }

                                        </Link>
                                    </li>
                                );
                            } ) }
                        </ul>

                    </div>
                ) ) }
            </div>

        </section>
    );

};

export default NextActionPanel;
