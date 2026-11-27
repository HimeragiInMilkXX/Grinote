/**
 * Validate a batch of schedule changes (pure, unit-tested). Shared by the schedule page,
 * the assistant's propose_schedule tool, and the server actions that write the changes.
 *
 * Real problems (unknown ids, done entries, past days, completed nodes, too many entries for a
 * node) throw one combined error. Harmless no-ops are dropped with a warning. Going over the
 * daily goal, scheduling on a non-work day, or scheduling a task still waiting for its subtasks
 * are warnings only: the user decides.
 */

import { isPickableDay, isWorkDayKey } from "@/lib/next-action/schedule";
import { MAX_ADD_COUNT, MAX_SCHEDULE_OPS } from "./config";
import { capacityOf, capacityReason, openCountByNode } from "./rules";
import type { DayChange, ScheduleItemRow, ScheduleNode, ScheduleOps } from "./types";

export interface ScheduleOpsContext {
    todayKey: string;
    goalKey: string | null;
    workDays: readonly number[];
    /** daily_time_goal in minutes; null/0 = none */
    goalMinutes: number | null;
    nodes: readonly ScheduleNode[];
    items: readonly ScheduleItemRow[];
}

export interface RawScheduleOps {
    add?: { node_id?: unknown; date?: unknown; count?: unknown }[] | null;
    move?: { item_id?: unknown; date?: unknown }[] | null;
    remove?: { item_id?: unknown }[] | null;
}

export interface NormalizedSchedule {
    ops: ScheduleOps;
    warnings: string[];
    /** planned minutes before/after for every day the ops touch */
    days: DayChange[];
}

export class ScheduleOpsError extends Error {

    constructor( readonly problems: string[] ) {
        super( problems.join( "\n" ) );
        this.name = "ScheduleOpsError";
    }

}

const str = ( v: unknown ) => typeof v === "string" ? v.trim() : "";

function dayProblem( date: string, ctx: ScheduleOpsContext ): string | null {

    if( !/^\d{4}-\d{2}-\d{2}$/.test( date ) || Number.isNaN( Date.parse( date ) ) ) return `日付 "${date}" が不正です（YYYY-MM-DD）`;
    if( date < ctx.todayKey ) return `${date} は過去の日付です（今日 ${ctx.todayKey} 以降を指定してください）`;
    if( !isPickableDay( date, ctx.todayKey, ctx.goalKey ) ) return `${date} は目標日（${ctx.goalKey}）より後です`;

    return null;

}

export function normalizeScheduleOps( raw: RawScheduleOps, ctx: ScheduleOpsContext ): NormalizedSchedule {

    const problems: string[] = [];
    const warnings: string[] = [];
    const nodesById = new Map( ctx.nodes.map( n => [ n.id, n ] ) );
    const itemsById = new Map( ctx.items.map( i => [ i.id, i ] ) );
    const ops: ScheduleOps = { add: [], move: [], remove: [] };
    const touched = new Set<string>();
    const nameOfItem = ( item: ScheduleItemRow ) => nodesById.get( item.node_id )?.name ?? "（削除されたタスク）";

    // --- remove
    const removed = new Set<string>();
    for( const [ i, r ] of ( raw.remove ?? [] ).entries() ) {
        const id = str( r?.item_id );
        const item = itemsById.get( id );
        if( !item ) { problems.push( `remove[${i}]: 予定 "${id}" は存在しません (unknown item_id)` ); continue; }
        if( item.done_at ) { problems.push( `remove[${i}]: 「${nameOfItem( item )}」は完了済みの予定なので削除できません (done entry)` ); continue; }
        if( removed.has( id ) ) { warnings.push( `「${nameOfItem( item )}」の削除が重複していたので1つにまとめました` ); continue; }
        removed.add( id );
        ops.remove.push( { item_id: id } );
        touched.add( item.scheduled_for.slice( 0, 10 ) );
    }

    // --- move
    const moved = new Set<string>();
    for( const [ i, m ] of ( raw.move ?? [] ).entries() ) {
        const id = str( m?.item_id );
        const date = str( m?.date );
        const item = itemsById.get( id );
        if( !item ) { problems.push( `move[${i}]: 予定 "${id}" は存在しません (unknown item_id)` ); continue; }
        if( item.done_at ) { problems.push( `move[${i}]: 「${nameOfItem( item )}」は完了済みの予定なので移動できません (done entry)` ); continue; }
        if( removed.has( id ) ) { problems.push( `move[${i}]: 「${nameOfItem( item )}」は削除と移動の両方に含まれています` ); continue; }
        if( moved.has( id ) ) { problems.push( `move[${i}]: 「${nameOfItem( item )}」の移動が重複しています` ); continue; }
        const bad = dayProblem( date, ctx );
        if( bad ) { problems.push( `move[${i}]: ${bad}` ); continue; }
        if( item.scheduled_for.slice( 0, 10 ) === date ) { warnings.push( `「${nameOfItem( item )}」はすでに ${date} の予定です（移動なし）` ); continue; }
        moved.add( id );
        ops.move.push( { item_id: id, date } );
        touched.add( item.scheduled_for.slice( 0, 10 ) );
        touched.add( date );
    }

    // --- add (limits are checked after the removes)
    const open = openCountByNode( ctx.items.filter( i => !removed.has( i.id ) ) );
    const addedPerNode = new Map<string, number>();
    for( const [ i, a ] of ( raw.add ?? [] ).entries() ) {
        const nodeId = str( a?.node_id );
        const date = str( a?.date );
        const node = nodesById.get( nodeId );
        const count = a?.count === undefined || a?.count === null ? 1 : Number( a.count );
        if( !node ) { problems.push( `add[${i}]: タスク "${nodeId}" は存在しません (unknown node_id)` ); continue; }
        if( !Number.isInteger( count ) || count < 1 || count > MAX_ADD_COUNT ) { problems.push( `add[${i}]: 回数は1〜${MAX_ADD_COUNT}の整数で指定してください` ); continue; }
        const bad = dayProblem( date, ctx );
        if( bad ) { problems.push( `add[${i}]: ${bad}` ); continue; }
        const already = ( open.get( nodeId ) ?? 0 ) + ( addedPerNode.get( nodeId ) ?? 0 );
        const reason = capacityReason( node, already );
        if( reason ) { problems.push( `add[${i}]: 「${node.name}」: ${reason} (over limit)` ); continue; }
        const capacity = capacityOf( node, already );
        if( count > capacity ) { problems.push( `add[${i}]: 「${node.name}」はあと${capacity}回までしか予定できません（${count}回を指定） (over limit)` ); continue; }
        if( !node.isLoop && count > 1 ) { problems.push( `add[${i}]: 「${node.name}」は1回きりのタスクです` ); continue; }
        addedPerNode.set( nodeId, ( addedPerNode.get( nodeId ) ?? 0 ) + count );
        const same = ops.add.find( x => x.node_id === nodeId && x.date === date );
        if( same ) same.count += count;
        else ops.add.push( { node_id: nodeId, date, count } );
        touched.add( date );
        if( node.state === "blocked" ) warnings.push( `「${node.name}」はまだ子タスクが残っているので、それまでは開始できません` );
        if( !isWorkDayKey( date, ctx.workDays ) ) warnings.push( `${date} は作業日ではありません（「${node.name}」）` );
    }

    if( problems.length > 0 ) throw new ScheduleOpsError( problems );

    const total = ops.add.reduce( ( s, a ) => s + a.count, 0 ) + ops.move.length + ops.remove.length;
    if( total === 0 ) throw new ScheduleOpsError( [ "変更がありません (no changes)" ] );
    if( total > MAX_SCHEDULE_OPS ) throw new ScheduleOpsError( [ `一度に変更できるのは${MAX_SCHEDULE_OPS}件までです（${total}件）` ] );

    const days = dayChanges( ops, ctx, [ ...touched ] );
    for( const d of days ) {
        if( d.over && d.afterMinutes > d.beforeMinutes ) warnings.push( `${d.key} の予定は${d.afterMinutes}分で、1日の目標時間（${d.goalMinutes}分）を超えます` );
    }

    return { ops, warnings: [ ...new Set( warnings ) ], days };

}

/**
 * Planned minutes per day before and after the ops (done + open entries of the day; stale ones,
 * whose node can't be worked on anymore, don't count). Carried entries count on their own day.
 */
export function dayChanges( ops: ScheduleOps, ctx: Pick<ScheduleOpsContext, "nodes" | "items" | "goalMinutes">, keys: readonly string[] ): DayChange[] {

    const nodesById = new Map( ctx.nodes.map( n => [ n.id, n ] ) );
    const minutesOf = ( nodeId: string ) => nodesById.get( nodeId )?.estimateMinutes ?? 0;
    const counts = ( item: ScheduleItemRow ) => {
        if( item.done_at ) return true;
        const node = nodesById.get( item.node_id );
        return !!node && ( node.state === "schedulable" || node.state === "blocked" );
    };

    const before = new Map<string, number>();
    for( const item of ctx.items ) {
        if( !counts( item ) ) continue;
        const key = item.scheduled_for.slice( 0, 10 );
        before.set( key, ( before.get( key ) ?? 0 ) + minutesOf( item.node_id ) );
    }

    const after = new Map( before );
    const itemsById = new Map( ctx.items.map( i => [ i.id, i ] ) );
    const shift = ( key: string, delta: number ) => after.set( key, ( after.get( key ) ?? 0 ) + delta );

    for( const r of ops.remove ) {
        const item = itemsById.get( r.item_id );
        if( item && counts( item ) ) shift( item.scheduled_for.slice( 0, 10 ), -minutesOf( item.node_id ) );
    }
    for( const m of ops.move ) {
        const item = itemsById.get( m.item_id );
        if( !item || !counts( item ) ) continue;
        shift( item.scheduled_for.slice( 0, 10 ), -minutesOf( item.node_id ) );
        shift( m.date, minutesOf( item.node_id ) );
    }
    for( const a of ops.add ) shift( a.date, minutesOf( a.node_id ) * a.count );

    const goal = ctx.goalMinutes && ctx.goalMinutes > 0 ? ctx.goalMinutes : null;

    return [ ...new Set( keys ) ].sort().map( key => {
        const afterMinutes = after.get( key ) ?? 0;
        return { key, beforeMinutes: before.get( key ) ?? 0, afterMinutes, goalMinutes: goal, over: goal !== null && afterMinutes > goal };
    } );

}
