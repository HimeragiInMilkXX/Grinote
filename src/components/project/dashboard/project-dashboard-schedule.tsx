"use client";

import { scheduleVersionAtom } from "@/atoms/schedule_atoms";
import { Button } from "@/components/ui/button";
import { dayLabel, formatEstimate } from "@/lib/next-action/labels";
import type { ScheduleEntry } from "@/lib/schedule/types";
import { useAtomValue } from "jotai";
import { CalendarDays, Play, Repeat } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

export type DashboardScheduleDay = { key: string; entries: ScheduleEntry[] };

type Props = {
    projectId: string;
    todayKey: string;
    /** today's unfinished entries (carried ones included) */
    today: ScheduleEntry[];
    /** the next days with unfinished entries */
    upcoming: DashboardScheduleDay[];
    hasActiveTask: boolean;
    hasPendingReport: boolean;
};

/** Project dashboard: what's scheduled today and on the next planned days. */
const ProjectDashboardSchedule = ( { projectId, todayKey, today, upcoming, hasActiveTask, hasPendingReport }: Props ) => {

    // the assistant's proposal card may change the schedule while the dashboard is open
    const router = useRouter();
    const version = useAtomValue( scheduleVersionAtom );
    const first = useRef( version );
    useEffect( () => { if( version !== first.current ) router.refresh(); }, [ version, router ] );

    const startDisabledReason = hasPendingReport
        ? "未提出のレポートを先に書いてください。"
        : hasActiveTask ? "作業中のタスクがあります。" : null;

    const empty = today.length === 0 && upcoming.length === 0;

    return (
        <div className="flex w-0 min-w-full flex-col gap-2 rounded-2xl border bg-card p-3">

            <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 text-sm font-semibold"><CalendarDays className="size-4 text-primary"/> 予定</p>
                <Button size="xs" variant="outline" nativeButton={false} render={ <Link href={`/project/${projectId}/schedule`}/> }>
                    スケジュールを開く
                </Button>
            </div>

            { empty && <p className="text-xs text-muted-foreground"> これからの予定はありません。スケジュールでタスクを日に割り当てましょう。 </p> }

            { !empty && (
                <div className="flex flex-col gap-1">
                    <p className="text-xs font-medium text-muted-foreground"> 今日 { today.length > 0 ? `（残り${today.length}件）` : "" } </p>
                    { today.length === 0
                        ? <p className="text-xs text-muted-foreground"> 今日の予定はすべて終わりました。 </p>
                        : (
                            <ul className="flex flex-col gap-1">
                                { today.map( e => (
                                    <li key={e.id} className="flex items-center gap-2 rounded-lg border px-2 py-1">
                                        { e.isLoop && <Repeat className="size-3 shrink-0 text-muted-foreground" aria-label="繰り返し"/> }
                                        <span className="min-w-0 flex-1 truncate text-sm"> { e.name } </span>
                                        { e.state === "carried" && <span className="shrink-0 text-[0.65rem] text-amber-700"> 持ち越し </span> }
                                        <span className="shrink-0 text-[0.7rem] text-muted-foreground"> { formatEstimate( e.estimateMinutes ) ?? "" } </span>
                                        { e.startable && (
                                            startDisabledReason
                                                ? <Button size="xs" disabled title={startDisabledReason}><Play/> スタート</Button>
                                                : <Button size="xs" nativeButton={false} render={ <Link href={`/project/${projectId}/onair?nodeId=${e.nodeId}`}/> }><Play/> スタート</Button>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}
                </div>
            )}

            { upcoming.map( day => (
                <div key={day.key} className="flex flex-col gap-0.5">
                    <p className="text-xs font-medium text-muted-foreground"> { dayLabel( day.key, todayKey ) }（{ day.entries.length }件） </p>
                    <p className="truncate text-xs"> { day.entries.map( e => e.name ).join( "、" ) } </p>
                </div>
            ))}

        </div>
    );

};

export default ProjectDashboardSchedule;
