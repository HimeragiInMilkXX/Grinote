"use client"

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { FREE_TIMER_CHANGES, TIMER_CONFIG, timerModeLabel } from "@/lib/timer/config";
import type { TimerChoice, TimerMode, TimerState } from "@/lib/timer/types";
import { useEffect, useState } from "react";
import TimerPicker from "./timer-picker";

const MIN = 60_000;

/** 一時停止: optional reason (recorded with the pause). */
export function PauseReasonDialog( { open, onCancel, onConfirm, busy }: { open: boolean; onCancel: () => void; onConfirm: ( reason: string | null ) => void; busy: boolean } ) {

    const [ reason, setReason ] = useState( "" );
    useEffect( () => { if( open ) setReason( "" ); }, [ open ] );

    return (
        <Dialog open={open} onOpenChange={ o => { if( !o ) onCancel(); } }>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>一時停止</DialogTitle>
                    <DialogDescription>
                        急な用事など、作業を中断するときに使います。一時停止は休憩には数えず、集中時間にも休憩時間にも入りません。理由は任意です（記録に残ります）。
                    </DialogDescription>
                </DialogHeader>
                <Textarea
                    value={reason}
                    onChange={ e => setReason( e.target.value.slice( 0, TIMER_CONFIG.pauseReasonMaxLength ) ) }
                    placeholder="例: 電話がかかってきた"
                    rows={3}
                />
                <DialogFooter>
                    <Button variant="outline" onClick={ () => onConfirm( null ) } disabled={busy}>理由なしで一時停止</Button>
                    <Button onClick={ () => onConfirm( reason.trim() || null ) } disabled={busy || !reason.trim()}>理由を記録して一時停止</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );

}

/** A countdown session ended: take the scheduled break or skip it. */
export function BreakOfferDialog( { open, kind, onAccept, onSkip, busy }: { open: boolean; kind: TimerState[ "awaitingKind" ]; onAccept: () => void; onSkip: () => void; busy: boolean } ) {

    const minutes = kind === "long" ? TIMER_CONFIG.pomodoro.longBreakMs / MIN : kind === "deep" ? TIMER_CONFIG.deep.breakMs / MIN : TIMER_CONFIG.pomodoro.shortBreakMs / MIN;

    return (
        <Dialog open={open} disablePointerDismissal>
            <DialogContent showCloseButton={false}>
                <DialogHeader>
                    <DialogTitle>セッション終了！{ kind === "long" ? "長い休憩の時間です" : "休憩しますか？" }</DialogTitle>
                    <DialogDescription>
                        {minutes}分の休憩に入ります。スキップすると、このセッションは完了として数え、次のセッションをすぐに始めます。
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button variant="outline" onClick={onSkip} disabled={busy}>スキップして続ける</Button>
                    <Button onClick={onAccept} disabled={busy}>{minutes}分休憩する</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );

}

/** A scheduled break countdown ended. */
export function BreakEndDialog( { open, onResume, onChangeTimer, onLater, busy, needsSwitch }: { open: boolean; onResume: () => void; onChangeTimer: () => void; onLater: () => void; busy: boolean; needsSwitch: boolean } ) {

    return (
        <Dialog open={open} onOpenChange={ o => { if( !o ) onLater(); } }>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>休憩終了</DialogTitle>
                    <DialogDescription>
                        次のセッションを始めましょう。このまま休憩を続けると、超えた時間も休憩として記録されます。
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button variant="outline" onClick={onChangeTimer} disabled={busy}>タイマーを変更</Button>
                    { !needsSwitch && <Button onClick={onResume} disabled={busy}>作業を再開</Button> }
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );

}

/** Change the timer during a break (3 free changes, then each change resets the stats). */
export function TimerChangeDialog( { open, state, onCancel, onConfirm, busy }: { open: boolean; state: TimerState; onCancel: () => void; onConfirm: ( choice: TimerChoice ) => void; busy: boolean } ) {

    const leavingStarter = state.mode === "starter";
    const initial: TimerChoice = leavingStarter ? { mode: "flowtime", config: { flowSuggestMin: TIMER_CONFIG.flowtime.defaultSuggestMin } } : { mode: state.mode === "pomodoro" ? "deep" : "pomodoro" };
    const [ choice, setChoice ] = useState<TimerChoice>( initial );
    useEffect( () => { if( open ) setChoice( initial ); }, [ open ] );

    const left = Math.max( 0, FREE_TIMER_CHANGES - state.changesUsed );
    const willReset = !leavingStarter && left === 0;
    const disabled: TimerMode[] = state.mode === "flowtime" ? [] : [ state.mode ];
    const same = choice.mode === state.mode && ( choice.config?.flowSuggestMin ?? null ) === ( state.config.flowSuggestMin ?? null );

    return (
        <Dialog open={open} onOpenChange={ o => { if( !o ) onCancel(); } }>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>タイマーを変更</DialogTitle>
                    <DialogDescription>
                        今は「{timerModeLabel( state.mode )}」。
                        { leavingStarter
                            ? "10分スターターからの切り替えは変更回数に数えません。"
                            : left > 0 ? `無料で変更できるのはあと${left}回です。` : "" }
                    </DialogDescription>
                </DialogHeader>
                {
                    willReset && (
                        <p className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">
                            変更回数（{FREE_TIMER_CHANGES}回）を使い切りました。変更すると、このタスクの集中時間・休憩・セッションの記録がすべてリセットされます。
                        </p>
                    )
                }
                <TimerPicker value={choice} onChange={setChoice} disabledModes={disabled}/>
                <DialogFooter>
                    <Button variant="outline" onClick={onCancel} disabled={busy}>キャンセル</Button>
                    <Button variant={ willReset ? "destructive" : "default" } onClick={ () => onConfirm( choice ) } disabled={busy || same}>
                        { willReset ? "リセットして変更" : "変更する" }
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );

}

type StarterStep = "ask" | "stop" | "pick";

/** 10-min starter reached its 10 minutes: keep working (switch timer) or stop. */
export function StarterCheckDialog( { open, busy, onSwitch, onBreak, onAbandon }: { open: boolean; busy: boolean; onSwitch: ( choice: TimerChoice ) => void; onBreak: () => void; onAbandon: () => void } ) {

    const [ step, setStep ] = useState<StarterStep>( "ask" );
    const [ choice, setChoice ] = useState<TimerChoice>( { mode: "flowtime", config: { flowSuggestMin: TIMER_CONFIG.flowtime.defaultSuggestMin } } );

    useEffect( () => { if( open ) setStep( "ask" ); }, [ open ] );

    const pick = ( preset: TimerChoice ) => { setChoice( preset ); setStep( "pick" ); };

    return (
        <Dialog open={open} disablePointerDismissal>
            <DialogContent showCloseButton={false} className={ step === "pick" ? "max-h-[90vh] overflow-y-auto sm:max-w-2xl" : undefined }>
                {
                    step === "ask" && (
                        <>
                            <DialogHeader>
                                <DialogTitle>10分たちました！</DialogTitle>
                                <DialogDescription>このまま続けますか？（タイマーはカウントアップで進んでいます）</DialogDescription>
                            </DialogHeader>
                            <DialogFooter>
                                <Button variant="outline" onClick={ () => setStep( "stop" ) } disabled={busy}>やめる</Button>
                                <Button onClick={ () => pick( { mode: "flowtime", config: { flowSuggestMin: TIMER_CONFIG.flowtime.defaultSuggestMin } } ) } disabled={busy}>続ける</Button>
                            </DialogFooter>
                        </>
                    )
                }
                {
                    step === "stop" && (
                        <>
                            <DialogHeader>
                                <DialogTitle>どうしますか？</DialogTitle>
                                <DialogDescription>ここまでの10分も、ちゃんと記録に残ります。</DialogDescription>
                            </DialogHeader>
                            <div className="flex flex-col gap-2">
                                <Button variant="outline" onClick={onBreak} disabled={busy}>休憩する</Button>
                                <Button variant="outline" onClick={ () => pick( { mode: "pomodoro" } ) } disabled={busy}>別のタイマーを試す</Button>
                                <Button variant="outline" onClick={ () => pick( { mode: "flowtime", config: { flowSuggestMin: TIMER_CONFIG.flowtime.defaultSuggestMin } } ) } disabled={busy}>やっぱり続ける</Button>
                                <Button variant="destructive" onClick={onAbandon} disabled={busy}>タスクを諦める</Button>
                            </div>
                        </>
                    )
                }
                {
                    step === "pick" && (
                        <>
                            <DialogHeader>
                                <DialogTitle>続けるタイマーを選ぶ</DialogTitle>
                                <DialogDescription>10分スターターのあとは、別のタイマーで続けます（変更回数には数えません）。セッションはそのまま続きます。</DialogDescription>
                            </DialogHeader>
                            <TimerPicker value={choice} onChange={setChoice} disabledModes={ [ "starter" ] }/>
                            <DialogFooter>
                                <Button variant="outline" onClick={ () => setStep( "ask" ) } disabled={busy}>戻る</Button>
                                <Button onClick={ () => onSwitch( choice ) } disabled={busy || choice.mode === "starter"}>このタイマーで続ける</Button>
                            </DialogFooter>
                        </>
                    )
                }
            </DialogContent>
        </Dialog>
    );

}

/** 諦める confirmation. */
export function AbandonDialog( { open, onCancel, onConfirm, busy }: { open: boolean; onCancel: () => void; onConfirm: () => void; busy: boolean } ) {

    return (
        <Dialog open={open} onOpenChange={ o => { if( !o ) onCancel(); } }>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>このタスクを諦めますか？</DialogTitle>
                    <DialogDescription>タイマーを止めて、このタスクの記録を終了します。XPはもらえません。</DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button variant="outline" onClick={onCancel} disabled={busy}>やめておく</Button>
                    <Button variant="destructive" onClick={onConfirm} disabled={busy}>諦める</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );

}
