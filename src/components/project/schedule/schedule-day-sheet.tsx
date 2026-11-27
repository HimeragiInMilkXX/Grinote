"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { dayLabel, formatEstimate } from "@/lib/next-action/labels";
import { isPickableDay, isWorkDayKey } from "@/lib/next-action/schedule";
import type { ScheduleView } from "@/lib/schedule/data";
import { dayTotal, entriesForDay } from "@/lib/schedule/days";
import type { ScheduleEntry } from "@/lib/schedule/types";
import { cn } from "@/lib/utils";
import { AlertTriangle, ArrowRightLeft, Check, Play, Repeat, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import ScheduleTaskPicker from "./schedule-task-picker";

type Props = {
    view: ScheduleView;
    dayKey: string | null;
    pending: boolean;
    onClose: () => void;
    onAdd: ( dayKey: string, picks: { node_id: string; count: number }[] ) => Promise<boolean>;
    onMove: ( itemId: string, toKey: string ) => Promise<boolean>;
    onRemove: ( itemId: string ) => Promise<boolean>;
};

const STATE_BADGE: Record<ScheduleEntry["state"], string | null> = {
    open: null,
    carried: "持ち越し",
    done: "完了",
    stale: "ツリーの変更で対象外",
};

/** One day of the schedule: its entries (move / remove while open) and the task picker. */
const ScheduleDaySheet = ( { view, dayKey, pending, onClose, onAdd, onMove, onRemove }: Props ) => {

    return (
        <Sheet open={ !!dayKey } onOpenChange={ open => { if( !open ) onClose(); } }>
            <SheetContent side="right" className="w-full gap-3 overflow-y-auto p-4 sm:max-w-md">
                { dayKey && <DayBody key={dayKey} view={view} dayKey={dayKey} pending={pending} onAdd={onAdd} onMove={onMove} onRemove={onRemove}/> }
            </SheetContent>
        </Sheet>
    );

};

function DayBody( { view, dayKey, pending, onAdd, onMove, onRemove }: Omit<Props, "dayKey" | "onClose"> & { dayKey: string } ) {

    const entries = entriesForDay( view.entries, dayKey, view.todayKey );
    const total = dayTotal( dayKey, entries, view.goalMinutes );
    const workDay = isWorkDayKey( dayKey, view.workDays );
    const canAdd = isPickableDay( dayKey, view.todayKey, view.goalKey );
    const isPast = dayKey < view.todayKey;

    return (
        <>
            <SheetHeader className="p-0 pr-8">
                <SheetTitle> { dayLabel( dayKey, view.todayKey ) } の予定 </SheetTitle>
                <SheetDescription>
                    { workDay ? "作業日" : "作業日ではありません" }
                    { " ・ " }
                    { total.goalMinutes ? `${total.minutes}分 / 目標 ${total.goalMinutes}分` : `${total.minutes}分` }
                </SheetDescription>
            </SheetHeader>

            { total.over && (
                <p className="flex gap-1.5 rounded-lg bg-amber-50 p-2 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-100" role="status">
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0"/>
                    予定の合計が1日の目標時間（{ total.goalMinutes }分）を超えています。このままでも大丈夫です。
                </p>
            )}

            <section className="flex flex-col gap-1.5" aria-label="この日の予定">
                { entries.length === 0 && <p className="text-xs text-muted-foreground"> まだ予定はありません。 </p> }
                { entries.map( e => (
                    <EntryRow key={e.id} entry={e} view={view} pending={pending} onMove={onMove} onRemove={onRemove}/>
                ))}
            </section>

            <section className="flex flex-col gap-2 border-t pt-3" aria-label="タスクを追加">
                <h3 className="text-sm font-semibold"> タスクを追加 </h3>
                { canAdd
                    ? <ScheduleTaskPicker view={view} dayKey={dayKey} pending={pending} onAdd={ picks => onAdd( dayKey, picks ) }/>
                    : <p className="text-xs text-muted-foreground"> { isPast ? "過去の日には追加できません。" : `目標日（${view.goalKey}）より後の日には追加できません。` } </p> }
            </section>
        </>
    );

}

function EntryRow( { entry, view, pending, onMove, onRemove }: { entry: ScheduleEntry; view: ScheduleView; pending: boolean; onMove: Props["onMove"]; onRemove: Props["onRemove"] } ) {

    const [ moving, setMoving ] = useState( false );
    const [ target, setTarget ] = useState( view.todayKey );
    const done = entry.state === "done";
    const badge = STATE_BADGE[ entry.state ];
    const estimate = formatEstimate( entry.estimateMinutes );
    const targetOk = isPickableDay( target, view.todayKey, view.goalKey ) && target !== entry.dayKey;

    return (
        <div className={cn( "flex flex-col gap-1.5 rounded-lg border p-2", done && "bg-muted/50", entry.state === "stale" && "opacity-70" )}>

            <div className="flex items-start gap-2">
                { done ? <Check className="mt-0.5 size-4 shrink-0 text-green-700" aria-label="完了"/> : entry.isLoop ? <Repeat className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-label="繰り返し"/> : <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-hidden/> }
                <div className="flex min-w-0 flex-1 flex-col">
                    { entry.path.length > 0 && <span className="truncate text-[0.7rem] text-muted-foreground"> { entry.path.join( " › " ) } </span> }
                    <span className={cn( "text-sm font-medium", done && "line-through decoration-1" )}> { entry.name } </span>
                    <span className="text-[0.7rem] text-muted-foreground">
                        { estimate ?? "目安なし" }
                        { entry.state === "carried" && ` ・ ${dayLabel( entry.dayKey, view.todayKey )}から` }
                        { done && entry.doneAt && ` ・ ${new Date( entry.doneAt ).toLocaleDateString( "ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric" } )} 完了` }
                    </span>
                </div>
                { badge && <span className={cn( "shrink-0 rounded-full px-1.5 py-0.5 text-[0.65rem]", done ? "bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-100" : "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100" )}>{ badge }</span> }
            </div>

            { !done && (
                <div className="flex flex-wrap items-center gap-1.5">
                    { entry.startable && entry.dayKey <= view.todayKey && (
                        <Button size="xs" nativeButton={false} render={ <Link href={`/project/${view.projectId}/onair?nodeId=${entry.nodeId}`}/> }>
                            <Play/> スタート
                        </Button>
                    )}
                    <Button size="xs" variant="outline" onClick={ () => setMoving( m => !m ) } disabled={pending} aria-expanded={moving}>
                        <ArrowRightLeft/> 日付を変更
                    </Button>
                    <Button size="xs" variant="destructive" onClick={ () => onRemove( entry.id ) } disabled={pending}>
                        <Trash2/> 外す
                    </Button>
                </div>
            )}

            { !done && moving && (
                <div className="flex items-center gap-1.5">
                    <Input type="date" value={target} min={view.todayKey} max={ view.goalKey && view.goalKey >= view.todayKey ? view.goalKey : undefined } onChange={ e => setTarget( e.target.value ) } className="h-7 w-40 text-sm" aria-label="移動先の日付"/>
                    <Button size="xs" onClick={ () => { onMove( entry.id, target ); setMoving( false ); } } disabled={ pending || !targetOk }> 移動 </Button>
                </div>
            )}

        </div>
    );

}

export default ScheduleDaySheet;
