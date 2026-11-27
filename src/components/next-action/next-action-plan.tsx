"use client";

import { Button } from "@/components/ui/button";
import { PLAN_KIND_LABELS } from "@/lib/next-action/config";
import { dayLabel, formatEstimate, ITEM_STATE_LABELS, ROLE_LABELS } from "@/lib/next-action/labels";
import type { NextActionView, PlanItemView } from "@/lib/next-action/types";
import { cn } from "@/lib/utils";
import { CalendarClock, Check, Play, Repeat, Sparkles, TriangleAlert } from "lucide-react";
import Link from "next/link";

type Props = {
    plan: NextActionView;
    todayKey: string;
    projectId: string;
    /** show スタート buttons (only for items that can be started) */
    startable?: boolean;
    /** why start is disabled (an active task / a pending report) */
    startDisabledReason?: string | null;
    compact?: boolean;
};

const ROLE_STYLES = {
    practice: "bg-sky-100 text-sky-800 border-sky-300",
    progress: "bg-amber-100 text-amber-900 border-amber-300",
} as const;

function PlanItem( { item, projectId, startable, startDisabledReason, compact }: { item: PlanItemView; projectId: string; startable: boolean; startDisabledReason?: string | null; compact?: boolean } ) {

    const stateLabel = ITEM_STATE_LABELS[ item.state ];
    const estimate = formatEstimate( item.estimateMinutes );
    const canStart = startable && item.state === "ok" && item.nodeId;

    return (
        <li className={cn( "flex flex-col gap-1 rounded-lg border p-2.5", item.state === "done" && "opacity-60" )}>

            <div className="flex items-center gap-2">
                <span className={cn( "shrink-0 rounded border px-1.5 py-0.5 text-[0.7rem] font-semibold", ROLE_STYLES[ item.role ] )}>
                    { ROLE_LABELS[ item.role ] }
                </span>
                <span className={cn( "min-w-0 grow truncate font-medium", item.state === "done" && "line-through" )} title={item.name}>
                    { item.name }
                </span>
                { item.isLoop && (
                    <span className="flex shrink-0 items-center gap-0.5 text-xs text-muted-foreground">
                        <Repeat className="size-3"/>{ item.repetitionsCompleted }/{ item.repetitionsRequired }
                    </span>
                ) }
                { estimate && <span className="shrink-0 text-xs text-muted-foreground">{ estimate }</span> }
                { compact && canStart && !startDisabledReason && (
                    <Link href={`/project/${projectId}/onair?nodeId=${item.nodeId}`} className="shrink-0">
                        <Button size="xs" className="cursor-pointer"><Play/> スタート</Button>
                    </Link>
                ) }
            </div>

            { !compact && item.reason && <p className="text-xs text-muted-foreground">{ item.reason }</p> }

            { stateLabel && (
                <p className={cn( "flex items-center gap-1 text-xs", item.state === "done" ? "text-green-700" : "text-destructive" )}>
                    { item.state === "done" ? <Check className="size-3"/> : <TriangleAlert className="size-3"/> }
                    { stateLabel }
                </p>
            ) }

            { canStart && ( !compact || startDisabledReason ) && (
                startDisabledReason
                    ? <p className="text-xs text-muted-foreground">{ startDisabledReason }</p>
                    : (
                        <Link href={`/project/${projectId}/onair?nodeId=${item.nodeId}`} className="self-end">
                            <Button size="sm" className="cursor-pointer"><Play/> スタート</Button>
                        </Link>
                    )
            ) }

        </li>
    );

}

/** A plan (draft or saved): type, day, items with reasons, AI message. */
const NextActionPlan = ( { plan, todayKey, projectId, startable = false, startDisabledReason, compact }: Props ) => {

    return (
        <div className="flex flex-col gap-2">

            <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full bg-primary/10 px-2 py-0.5 font-semibold text-primary">{ PLAN_KIND_LABELS[ plan.kind ] }</span>
                <span className="flex items-center gap-1 text-muted-foreground">
                    <CalendarClock className="size-3.5"/>
                    { plan.overdue ? `${dayLabel( plan.scheduledFor, todayKey )}の予定（持ち越し）` : dayLabel( plan.scheduledFor, todayKey ) }
                </span>
                <span className="text-muted-foreground">{ plan.source === "ai" ? "AIのおすすめ" : "自分で決めた予定" }</span>
            </div>

            <ul className="flex flex-col gap-2">
                { plan.items.map( item => (
                    <PlanItem key={item.role} item={item} projectId={projectId} startable={startable} startDisabledReason={startDisabledReason} compact={compact}/>
                ) ) }
            </ul>

            { !compact && plan.message && (
                <p className="flex gap-1.5 rounded-lg bg-muted/60 p-2 text-xs">
                    <Sparkles className="mt-0.5 size-3.5 shrink-0 text-primary"/>
                    <span>{ plan.message }</span>
                </p>
            ) }

            { plan.finished && <p className="text-xs text-green-700">この予定はすべて完了しました。次のアクションを作成しましょう。</p> }
            { plan.stale && !plan.finished && <p className="text-xs text-destructive">ツリーが変更されたため、この予定の一部は今は始められません。</p> }

        </div>
    );

};

export default NextActionPlan;
