"use client"

import { abandonTask, finishTask, timerAction } from "@/app/project/[projectId]/onair/serverActions";
import { useTutorialStep } from "@/hooks/useTutorialStep";
import { useServerClock } from "@/hooks/useServerClock";
import { Button } from "@/components/ui/button";
import { OnAirRecord } from "@/types/records";
import { FREE_TIMER_CHANGES, TIMER_CONFIG, TIMER_MODE_INFO } from "@/lib/timer/config";
import { timerView } from "@/lib/timer/view";
import type { TimerChoice, TimerEvent } from "@/lib/timer/types";
import { cn } from "@/lib/utils";
import { formatMinutes } from "@/components/project/journey/format";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AbandonDialog, BreakEndDialog, BreakOfferDialog, PauseReasonDialog, StarterCheckDialog, TimerChangeDialog } from "./timer/timer-dialogs";
import { notifyTimer } from "./timer/timer-notify";

interface Props { activeTask: OnAirRecord; serverNow: number }

/** "05:00" / "1:02:03" */
export function formatClock( ms: number ) {
    const total = Math.max( 0, Math.floor( ms / 1000 ) );
    const h = Math.floor( total / 3600 );
    const m = Math.floor( ( total % 3600 ) / 60 );
    const s = total % 60;
    const pad = ( n: number ) => String( n ).padStart( 2, "0" );
    return h > 0 ? `${h}:${pad( m )}:${pad( s )}` : `${pad( m )}:${pad( s )}`;
}

const minutes = ( ms: number ) => formatMinutes( ms / 60_000, "0分" );

const OnAirTimer = ( { activeTask, serverNow }: Props ) => {

    // For onboarding
    const completeTutorialStep = useTutorialStep( activeTask.project_id );

    useEffect( () => {

        completeTutorialStep( 2 )

    }, [])

    const [ task, setTask ] = useState<OnAirRecord>( activeTask );
    const [ busy, setBusy ] = useState( false );
    const [ ended, setEnded ] = useState( false );
    const [ dialog, setDialog ] = useState<null | "pause" | "abandon" | "change">( null );
    const [ breakEndDismissed, setBreakEndDismissed ] = useState( false );

    const { now, sync } = useServerClock( serverNow );

    const timer = task.timer!;
    const view = timerView( timer, now );
    const info = TIMER_MODE_INFO[ timer.mode ];

    const act = async ( event: TimerEvent ) => {
        if( busy ) return false;
        setBusy( true );
        try {
            const res = await timerAction( task.id, task.project_id, event );
            sync( res.serverNow );
            if( res.record ) setTask( res.record );
            if( !res.ok ) toast.error( res.message );
            return res.ok;
        } catch {
            toast.error( "通信に失敗しました" );
            return false;
        } finally {
            setBusy( false );
        }
    };

    // ---- automatic transitions and notices ----

    // a countdown session reached its end: the server closes it at the exact scheduled end
    const dueSent = useRef<string | null>( null );
    useEffect( () => {
        const key = `${timer.phaseStartedAt}:${timer.sessionWorkMs}`;
        if( view.sessionDue && dueSent.current !== key && !busy ) {
            dueSent.current = key;
            notifyTimer( "セッション終了！", timer.mode === "pomodoro" ? "休憩しますか？" : "10分休憩しますか？" );
            void act( { type: "session_due" } );
        }
    } );

    // 10-min starter done
    const starterNotified = useRef( false );
    useEffect( () => {
        if( view.starterCheck && !starterNotified.current ) {
            starterNotified.current = true;
            notifyTimer( "10分たちました！", "このまま続けますか？" );
        }
        if( !view.starterCheck ) starterNotified.current = false;
    }, [ view.starterCheck ] );

    // flowtime: suggest a break (never forced)
    const suggested = useRef<number | null>( null );
    useEffect( () => {
        if( !view.suggestBreak || suggested.current === timer.suggestionSnoozedAtMs ) return;
        suggested.current = timer.suggestionSnoozedAtMs;
        let decided = false;
        notifyTimer( `${Math.round( view.sessionFocusMs / 60_000 )}分集中しました`, "10分休憩しませんか？", { sound: true } );
        toast( "休憩の提案", {
            description: "フロータイム: そろそろ10分休憩しませんか？",
            duration: 60_000,
            action: { label: "休憩する", onClick: () => { decided = true; void act( { type: "take_suggested_break" } ); } },
            cancel: { label: "あとで", onClick: () => { decided = true; void act( { type: "snooze_suggestion" } ); } },
            onAutoClose: () => { if( !decided ) void act( { type: "snooze_suggestion" } ); },
        } );
    }, [ view.suggestBreak ] );

    // scheduled break over
    const breakEndNotified = useRef<number | null>( null );
    useEffect( () => {
        if( view.breakOver && breakEndNotified.current !== timer.phaseStartedAt ) {
            breakEndNotified.current = timer.phaseStartedAt;
            setBreakEndDismissed( false );
            notifyTimer( "休憩終了", "次のセッションを始めましょう" );
        }
    }, [ view.breakOver ] );

    // custom break: a notice every 5 minutes, the clock stays hidden
    const lastBreakNotice = useRef( 0 );
    useEffect( () => {
        if( timer.phase !== "break" || timer.breakEndsAt != null ) { lastBreakNotice.current = 0; return; }
        const k = Math.floor( view.breakElapsedMs / TIMER_CONFIG.customBreakNoticeMs );
        if( k > lastBreakNotice.current ) {
            lastBreakNotice.current = k;
            notifyTimer( `休憩して${k * TIMER_CONFIG.customBreakNoticeMs / 60_000}分たちました`, "準備ができたら作業に戻りましょう" );
        }
    } );

    // tab title
    useEffect( () => {
        const base = "Grinote";
        const label = timer.phase === "break" && timer.breakEndsAt == null ? "休憩中"
            : timer.phase === "paused" ? "一時停止"
            : view.clockMs != null ? formatClock( view.clockMs ) : "";
        document.title = label ? `${label} | ${base}` : base;
        return () => { document.title = base; };
    } );

    // ---- actions ----

    const complete = async () => {
        setEnded( true );
        await finishTask( task.id, task.project_id );
    };

    const abandon = async () => {
        setEnded( true );
        await abandonTask( task.id, task.project_id );
    };

    const changeTimer = async ( choice: TimerChoice ) => {
        const ok = await act( timer.mode === "starter" && timer.phase !== "break"
            ? { type: "starter_switch", mode: choice.mode, config: choice.config }
            : { type: "change_mode", mode: choice.mode, config: choice.config } );
        if( ok ) setDialog( null );
    };

    const starterNeedsSwitch = timer.mode === "starter" && timer.starterRemainingMs <= 0 && !timer.sessionOpen;
    const isCustomBreak = timer.phase === "break" && timer.breakEndsAt == null;
    const changesLeft = Math.max( 0, FREE_TIMER_CHANGES - timer.changesUsed );

    const phaseLabel = (
        timer.phase === "work" ? `集中 #${view.liveSessions || 1}`
        : timer.phase === "paused" ? "一時停止中"
        : timer.phase === "awaiting" ? "セッション終了"
        : timer.phase === "break" ? ( isCustomBreak ? "休憩中" : timer.breakSource === "long" ? "長い休憩" : "休憩" )
        : "終了"
    );

    const disabled = busy || ended;

    return (
        <div className="flex min-w-72 flex-col gap-3">

            <div className="flex items-center justify-between gap-2 text-sm">
                <span className="rounded-md bg-primary/10 px-2 py-0.5 font-medium text-primary">{info.label}</span>
                <span className="text-xs text-muted-foreground" title="タイマー変更（休憩中のみ）">変更 残り{changesLeft}/{FREE_TIMER_CHANGES}</span>
            </div>

            <div className={cn( "flex flex-col items-center gap-1 rounded-xl border p-4", timer.phase === "break" || timer.phase === "awaiting" ? "bg-emerald-50 dark:bg-emerald-950/30" : timer.phase === "paused" ? "bg-amber-50 dark:bg-amber-950/30" : "bg-background" )}>
                <p className="text-sm text-muted-foreground">{phaseLabel}</p>

                {
                    isCustomBreak
                        ? <p className="py-2 text-center text-lg">ゆっくり休んでください<br/><span className="text-xs text-muted-foreground">5分ごとにお知らせします</span></p>
                        : <p className={cn( "font-mono text-5xl tabular-nums", timer.phase === "paused" && "opacity-50" )} suppressHydrationWarning>
                            { view.clockMs != null ? formatClock( view.clockMs ) : "--:--" }
                          </p>
                }

                {
                    view.direction === "up" && timer.phase === "work" && timer.mode === "starter" && (
                        <p className="text-xs text-muted-foreground">10分達成！カウントアップ中</p>
                    )
                }

                {
                    timer.phase === "paused" && timer.pauseReason && (
                        <p className="max-w-64 text-center text-xs text-muted-foreground">理由: {timer.pauseReason}</p>
                    )
                }

                {
                    timer.mode === "pomodoro" && (
                        <div className="mt-1 flex gap-1.5" aria-label={`長い休憩まで ${view.cycle}/4`}>
                            { [ 0, 1, 2, 3 ].map( i => <span key={i} className={cn( "size-2.5 rounded-full", i < view.cycle ? "bg-primary" : "bg-muted" )}/> ) }
                        </div>
                    )
                }
            </div>

            {
                timer.phase === "work" && (
                    <>
                        <Button onClick={ () => act( { type: "take_break" } ) } disabled={disabled}>休憩する</Button>
                        <Button variant="outline" onClick={ () => setDialog( "pause" ) } disabled={disabled}>一時停止</Button>
                    </>
                )
            }

            {
                timer.phase === "paused" && (
                    starterNeedsSwitch
                        ? <Button onClick={ () => setDialog( "change" ) } disabled={disabled}>タイマーを選んで再開</Button>
                        : <Button onClick={ () => act( { type: "resume" } ) } disabled={disabled}>再開</Button>
                )
            }

            {
                timer.phase === "break" && (
                    <>
                        {
                            starterNeedsSwitch
                                ? <Button onClick={ () => setDialog( "change" ) } disabled={disabled}>タイマーを選んで再開</Button>
                                : <Button onClick={ () => act( { type: "end_break" } ) } disabled={disabled}>作業に戻る</Button>
                        }
                        { !starterNeedsSwitch && <Button variant="outline" onClick={ () => setDialog( "change" ) } disabled={disabled}>タイマーを変更</Button> }
                    </>
                )
            }

            <Button variant="secondary" onClick={complete} disabled={disabled}>完成</Button>
            <Button variant="ghost" onClick={ () => setDialog( "abandon" ) } disabled={disabled}>諦める</Button>

            <dl className="grid grid-cols-3 gap-2 rounded-lg bg-muted/50 p-2 text-center text-xs" suppressHydrationWarning>
                <div><dt className="text-muted-foreground">集中</dt><dd>{minutes( view.liveFocusMs )}</dd></div>
                <div><dt className="text-muted-foreground">セッション</dt><dd>{view.liveSessions}</dd></div>
                <div><dt className="text-muted-foreground">休憩</dt><dd>{view.liveBreaks}回 / {minutes( view.liveBreakMs )}</dd></div>
            </dl>

            <PauseReasonDialog
                open={dialog === "pause"}
                busy={busy}
                onCancel={ () => setDialog( null ) }
                onConfirm={ async reason => { if( await act( { type: "pause", reason } ) ) setDialog( null ); } }
            />

            <AbandonDialog open={dialog === "abandon"} busy={disabled} onCancel={ () => setDialog( null ) } onConfirm={abandon}/>

            <TimerChangeDialog open={dialog === "change"} state={timer} busy={busy} onCancel={ () => setDialog( null ) } onConfirm={changeTimer}/>

            <BreakOfferDialog
                open={timer.phase === "awaiting" && !ended}
                kind={timer.awaitingKind}
                busy={busy}
                onAccept={ () => act( { type: "accept_break" } ) }
                onSkip={ () => act( { type: "skip_break" } ) }
            />

            <BreakEndDialog
                open={view.breakOver && !breakEndDismissed && dialog === null && !ended}
                busy={busy}
                needsSwitch={starterNeedsSwitch}
                onResume={ () => act( { type: "end_break" } ) }
                onChangeTimer={ () => { setBreakEndDismissed( true ); setDialog( "change" ); } }
                onLater={ () => setBreakEndDismissed( true ) }
            />

            <StarterCheckDialog
                open={view.starterCheck && dialog === null && !ended}
                busy={busy}
                onSwitch={changeTimer}
                onBreak={ () => act( { type: "take_break" } ) }
                onAbandon={ () => setDialog( "abandon" ) }
            />

        </div>
    )
}

export default OnAirTimer
