"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatEstimate } from "@/lib/next-action/labels";
import type { ScheduleView } from "@/lib/schedule/data";
import { normalizeScheduleOps, ScheduleOpsError } from "@/lib/schedule/normalize";
import { capacityOf, capacityReason, isSchedulableState, openCountByNode } from "@/lib/schedule/rules";
import { cn } from "@/lib/utils";
import { AlertTriangle, Minus, Plus, Repeat, Search } from "lucide-react";
import { useMemo, useState } from "react";

type Props = {
    view: ScheduleView;
    dayKey: string;
    pending: boolean;
    /** resolves true when saved */
    onAdd: ( picks: { node_id: string; count: number }[] ) => Promise<boolean>;
};

/**
 * Pick tasks for a day. Any open action of the tree can be picked (also ones still waiting for
 * subtasks). One-time tasks once, loops up to their remaining repetitions. Going over the daily
 * goal only shows a warning.
 */
const ScheduleTaskPicker = ( { view, dayKey, pending, onAdd }: Props ) => {

    const [ query, setQuery ] = useState( "" );
    const [ picks, setPicks ] = useState<Record<string, number>>( {} );

    const open = useMemo( () => openCountByNode( view.items ), [ view.items ] );
    const candidates = useMemo( () => view.nodes.filter( n => isSchedulableState( n.state ) ), [ view.nodes ] );

    const q = query.trim().toLowerCase();
    const shown = q
        ? candidates.filter( n => n.name.toLowerCase().includes( q ) || n.path.some( p => p.toLowerCase().includes( q ) ) )
        : candidates;

    const picked = Object.entries( picks ).filter( ( [ , c ] ) => c > 0 ).map( ( [ node_id, count ] ) => ( { node_id, count } ) );

    // live check with the same rules the server uses (warnings: over the daily goal, non-work day, ...)
    const check = useMemo( () => {
        if( picked.length === 0 ) return null;
        try {
            const out = normalizeScheduleOps( { add: picked.map( p => ( { ...p, date: dayKey } ) ) }, {
                todayKey: view.todayKey, goalKey: view.goalKey, workDays: view.workDays, goalMinutes: view.goalMinutes, nodes: view.nodes, items: view.items,
            } );
            return { ok: true as const, warnings: out.warnings, after: out.days[0]?.afterMinutes ?? 0 };
        } catch( e ) {
            return { ok: false as const, problems: e instanceof ScheduleOpsError ? e.problems : [ String( e ) ] };
        }
    }, [ picked, dayKey, view ] );

    const change = ( id: string, delta: number, max: number ) => setPicks( p => ( { ...p, [ id ]: Math.max( 0, Math.min( max, ( p[ id ] ?? 0 ) + delta ) ) } ) );

    const submit = async () => {
        if( !check?.ok ) return;
        // keep the selection when saving fails, so the user can adjust and retry
        if( await onAdd( picked ) ) setPicks( {} );
    };

    if( candidates.length === 0 ) {
        return <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground"> 予定できるタスクがありません。ゴールツリーに行動タスクを追加してください。 </p>;
    }

    return (

        <div className="flex min-h-0 flex-col gap-2">

            <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground"/>
                <Input value={query} onChange={ e => setQuery( e.target.value ) } placeholder="タスクを検索" className="h-8 pl-7 text-sm" aria-label="タスクを検索"/>
            </div>

            <ul className="flex max-h-72 min-h-0 flex-col gap-1 overflow-y-auto pr-1" aria-label="予定できるタスク">
                { shown.map( node => {

                    const count = picks[ node.id ] ?? 0;
                    const capacity = capacityOf( node, open.get( node.id ) ?? 0 );
                    const reason = capacityReason( node, open.get( node.id ) ?? 0 );
                    const estimate = formatEstimate( node.estimateMinutes );

                    return (
                        <li key={node.id} className={cn( "flex items-center gap-2 rounded-lg border px-2 py-1.5", count > 0 && "border-primary bg-primary/5", reason && "opacity-60" )}>

                            <div className="flex min-w-0 flex-1 flex-col">
                                { node.path.length > 0 && <span className="truncate text-[0.7rem] text-muted-foreground"> { node.path.join( " › " ) } </span> }
                                <span className="flex items-center gap-1 truncate text-sm font-medium">
                                    { node.isLoop && <Repeat className="size-3 shrink-0 text-muted-foreground" aria-label="繰り返し"/> }
                                    { node.name }
                                </span>
                                <span className="text-[0.7rem] text-muted-foreground">
                                    { estimate ?? "目安なし" }
                                    { node.isLoop && ` ・ ${node.repetitionsCompleted}/${node.repetitionsRequired}回完了 ・ あと${capacity}回予定できます` }
                                    { node.state === "blocked" && " ・ 子タスクが未完了" }
                                    { reason && ` ・ ${reason}` }
                                </span>
                            </div>

                            { node.isLoop ? (
                                <div className="flex shrink-0 items-center gap-1">
                                    <Button type="button" size="icon-xs" variant="outline" onClick={ () => change( node.id, -1, capacity ) } disabled={ count === 0 } aria-label={`${node.name} を1回減らす`}><Minus/></Button>
                                    <span className="w-5 text-center text-sm tabular-nums" aria-live="polite">{ count }</span>
                                    <Button type="button" size="icon-xs" variant="outline" onClick={ () => change( node.id, 1, capacity ) } disabled={ count >= capacity } aria-label={`${node.name} を1回増やす`}><Plus/></Button>
                                </div>
                            ) : (
                                <Button type="button" size="xs" variant={ count > 0 ? "default" : "outline" } onClick={ () => change( node.id, count > 0 ? -1 : 1, capacity ) } disabled={ !!reason && count === 0 } aria-pressed={ count > 0 }>
                                    { count > 0 ? "選択中" : "選ぶ" }
                                </Button>
                            )}

                        </li>
                    );

                })}
                { shown.length === 0 && <li className="p-2 text-xs text-muted-foreground"> 一致するタスクがありません </li> }
            </ul>

            { check && !check.ok && (
                <ul className="flex flex-col gap-0.5 rounded-lg bg-destructive/10 p-2 text-xs text-destructive" role="alert">
                    { check.problems.map( p => <li key={p}>{ p }</li> ) }
                </ul>
            )}

            { check?.ok && check.warnings.length > 0 && (
                <ul className="flex flex-col gap-0.5 rounded-lg bg-amber-50 p-2 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-100" role="status">
                    { check.warnings.map( w => <li key={w} className="flex gap-1"><AlertTriangle className="mt-0.5 size-3 shrink-0"/> { w }</li> ) }
                    <li className="text-[0.7rem] opacity-80"> このまま追加することもできます。 </li>
                </ul>
            )}

            <Button type="button" onClick={submit} disabled={ pending || !check?.ok }>
                { picked.length > 0 ? `${picked.reduce( ( s, p ) => s + p.count, 0 )}件を追加` : "タスクを選んでください" }
                { check?.ok && view.goalMinutes ? ` （合計 ${check.after}分 / 目標 ${view.goalMinutes}分）` : "" }
            </Button>

        </div>

    );

};

export default ScheduleTaskPicker;
