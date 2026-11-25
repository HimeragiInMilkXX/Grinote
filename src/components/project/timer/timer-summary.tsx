import { formatMinutes } from "@/components/project/journey/format";
import { FREE_TIMER_CHANGES, timerModeLabel } from "@/lib/timer/config";
import type { TimerSummary } from "@/lib/timer/types";
import { cn } from "@/lib/utils";
import { ArrowRight, Coffee, Hourglass, PauseCircle, Target } from "lucide-react";
import type { ReactNode } from "react";

const fmt = ( ms: number ) => formatMinutes( ms / 60_000, "0分" );

function Cell( { icon, label, value, sub }: { icon: ReactNode; label: string; value: string; sub?: string } ) {
    return (
        <div className="flex flex-col gap-0.5 rounded-xl bg-muted/60 px-3 py-2">
            <span className="flex items-center gap-1 text-xs text-muted-foreground">{icon}{label}</span>
            <span className="font-semibold tabular-nums">{value}</span>
            { sub && <span className="text-xs text-muted-foreground">{sub}</span> }
        </div>
    );
}

/** The timers used, in order (resets marked). */
export function TimerModeChips( { summary }: { summary: TimerSummary } ) {
    return (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {
                summary.modes.map( ( m, i ) => (
                    <span key={`${m.at}-${i}`} className="flex items-center gap-1.5">
                        { i > 0 && <ArrowRight className="size-3 text-muted-foreground"/> }
                        <span className={cn( "rounded-md border px-2 py-0.5", m.reset && "border-destructive/40 text-destructive" )}>
                            { timerModeLabel( m.mode ) }
                            { m.mode === "flowtime" && m.config.flowSuggestMin ? `（${m.config.flowSuggestMin}分ごと）` : "" }
                            { m.reset ? "・リセット" : "" }
                        </span>
                    </span>
                ) )
            }
        </div>
    );
}

interface Props {
    summary: TimerSummary | null;
    /** list the pause reasons (journey) */
    showPauseReasons?: boolean;
    className?: string;
}

/** Focus / sessions / breaks / pauses / timers of one task (report, task_complete, journey). */
const TimerSummaryView = ( { summary, showPauseReasons = false, className }: Props ) => {

    if( !summary ) return <p className={cn( "text-sm text-muted-foreground", className )}>旧バージョン（タイマーの記録なし）</p>;

    return (
        <div className={cn( "flex flex-col gap-3", className )}>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Cell icon={<Target className="size-3.5"/>} label="集中" value={fmt( summary.focusMs )} sub={`${summary.sessions}セッション${summary.completedSessions ? `（完走 ${summary.completedSessions}）` : ""}`}/>
                <Cell icon={<Coffee className="size-3.5"/>} label="休憩" value={fmt( summary.breakMs )} sub={`${summary.breaks}回（予定 ${summary.scheduledBreaks} / 任意 ${summary.customBreaks}）`}/>
                <Cell icon={<Hourglass className="size-3.5"/>} label="合計" value={fmt( summary.totalMs )} sub="集中 + 休憩"/>
                <Cell icon={<PauseCircle className="size-3.5"/>} label="一時停止" value={`${summary.pauses}回`} sub={ summary.pauses ? fmt( summary.pauseMs ) : "合計に含まない" }/>
            </div>

            <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">使ったタイマー</span>
                <TimerModeChips summary={summary}/>
            </div>

            {
                summary.resets > 0 && (
                    <p className="text-xs text-destructive">タイマーを{FREE_TIMER_CHANGES}回より多く変更したため、記録が{summary.resets}回リセットされました（上の数字はリセット後の分です）。</p>
                )
            }

            {
                showPauseReasons && summary.pauseReasons.length > 0 && (
                    <div className="flex flex-col gap-1">
                        <span className="text-xs text-muted-foreground">一時停止の理由</span>
                        <ul className="list-disc pl-5 text-sm">
                            { summary.pauseReasons.map( ( r, i ) => <li key={i}>{r}</li> ) }
                        </ul>
                    </div>
                )
            }

        </div>
    );

};

export default TimerSummaryView;
