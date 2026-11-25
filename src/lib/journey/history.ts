/**
 * Journey timeline data: completed records with their journal, the header stats, and the
 * evidence-free summaries the AI reads (report analysis history + assistant tools).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { asRewardBreakdown, intervalToMinutes, msToMinutes, type TaskRewardBreakdown } from "@/lib/rewards/breakdown";
import { REWARD_DAY_TIMEZONE } from "@/lib/rewards/config";
import { computeCurrentStreak, computeLongestStreak, dateKeyInZone } from "@/lib/rewards/streaks";
import { NEXT_ACTION_LABELS } from "./analysis";
import { toJournalView, type JournalView, type TaskJournalRow } from "./journal";
import type { HistorySummary } from "./prompt";
import { summarizeStoredTimer } from "@/lib/timer/summary";
import type { TimerSummary } from "@/lib/timer/types";

export interface JourneyEntry {
    recordId: number;
    nodeId: string;
    taskName: string;
    taskDescription: string | null;
    startedAt: string;
    completedAt: string;
    durationMs: number;
    estimatedMinutes: number;
    actualMinutes: number;
    xp: number;
    breakdown: TaskRewardBreakdown | null;
    /** sessions / breaks / pauses / timers used; null for records before 4.5 */
    timer: TimerSummary | null;
    /** null for records completed before the journey system (4.0). */
    journal: JournalView | null;
}

export interface JourneyStats {
    /** focus time */
    totalWorkMs: number;
    totalBreakMs: number;
    /** focus sessions (records from 4.5 on) */
    totalSessions: number;
    completedTasks: number;
    currentStreak: number;
    longestStreak: number;
    /** ISO timestamp of the project creation. */
    startedAt: string;
}

const one = <T,>( v: T | T[] | null | undefined ): T | null => Array.isArray( v ) ? v[0] ?? null : v ?? null;

type EntryRow = {
    id: number;
    node_id: string;
    started_at: string;
    completed_at: string | null;
    updated_at: string;
    duration: number | string | null;
    xp_change: number | null;
    reward_breakdown: unknown;
    timer?: unknown;
    nodes: { task_name: string; description: string | null; time_limit: string | null } | { task_name: string; description: string | null; time_limit: string | null }[] | null;
    task_journals: TaskJournalRow | TaskJournalRow[] | null;
};

export const JOURNEY_ENTRY_SELECT = "id, node_id, started_at, completed_at, updated_at, duration, xp_change, reward_breakdown, timer, nodes ( task_name, description, time_limit ), task_journals ( * )";

export function toJourneyEntry( row: EntryRow ): JourneyEntry {

    const node = one( row.nodes );
    const journalRow = one( row.task_journals );
    const breakdown = asRewardBreakdown( row.reward_breakdown );
    const durationMs = Number( row.duration ) || 0;

    const estimatedMinutes = breakdown?.inputs.estimatedMinutes
        ?? ( journalRow?.estimated_minutes != null ? Number( journalRow.estimated_minutes ) : intervalToMinutes( node?.time_limit ) );

    return {
        recordId: row.id,
        nodeId: row.node_id,
        taskName: journalRow?.task_name ?? node?.task_name ?? "（削除されたタスク）",
        taskDescription: journalRow?.task_description ?? node?.description ?? null,
        startedAt: row.started_at,
        completedAt: row.completed_at ?? row.updated_at,
        durationMs,
        estimatedMinutes: Number.isFinite( estimatedMinutes ) ? estimatedMinutes : 0,
        actualMinutes: msToMinutes( durationMs ),
        xp: breakdown?.awardedXp ?? row.xp_change ?? 0,
        breakdown,
        timer: summarizeStoredTimer( row.timer ),
        journal: journalRow ? toJournalView( journalRow ) : null,
    };

}

/** Completed records of a project, newest first (RLS limits them to the signed-in user). */
export async function loadJourneyEntries( supabase: SupabaseClient, projectId: string, opts: { limit?: number } = {} ): Promise<JourneyEntry[]> {

    let query = supabase
        .from( "records" )
        .select( JOURNEY_ENTRY_SELECT )
        .eq( "project_id", projectId )
        .eq( "status", "completed" )
        .order( "completed_at", { ascending: false } );

    if( opts.limit ) query = query.limit( opts.limit );

    const { data, error } = await query;

    if( error ) throw new Error( error.message );

    return ( ( data ?? [] ) as unknown as EntryRow[] ).map( toJourneyEntry );

}

export function computeJourneyStats( entries: readonly ( Pick<JourneyEntry, "durationMs" | "completedAt"> & { timer?: TimerSummary | null } )[], project: { created_at: string; work_days: readonly number[] }, now: Date = new Date() ): JourneyStats {

    const dayKeys = entries.map( e => dateKeyInZone( new Date( e.completedAt ), REWARD_DAY_TIMEZONE ) );
    const todayKey = dateKeyInZone( now, REWARD_DAY_TIMEZONE );

    return {
        totalWorkMs: entries.reduce( ( sum, e ) => sum + ( Number.isFinite( e.durationMs ) ? e.durationMs : 0 ), 0 ),
        totalBreakMs: entries.reduce( ( sum, e ) => sum + ( e.timer?.breakMs ?? 0 ), 0 ),
        totalSessions: entries.reduce( ( sum, e ) => sum + ( e.timer?.sessions ?? 0 ), 0 ),
        completedTasks: entries.length,
        currentStreak: computeCurrentStreak( { completionDayKeys: dayKeys, todayKey, workDays: project.work_days } ),
        longestStreak: computeLongestStreak( { completionDayKeys: dayKeys, todayKey, workDays: project.work_days } ),
        startedAt: project.created_at,
    };

}

/** Evidence-free summary of one entry for the AI (null for entries without an analysis). */
export function toHistorySummary( entry: JourneyEntry ): HistorySummary | null {

    const analysis = entry.journal?.analysis;
    if( !analysis ) return null;

    return {
        date: dateKeyInZone( new Date( entry.completedAt ), REWARD_DAY_TIMEZONE ),
        task: entry.taskName,
        score: entry.journal?.aiScore ?? null,
        conclusion: analysis.conclusion,
        struggles: analysis.struggles,
        nextActions: analysis.nextActions.map( a => `${NEXT_ACTION_LABELS[ a.kind ]}: ${a.detail}` ),
    };

}
