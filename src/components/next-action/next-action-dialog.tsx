"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
    createManualNextAction, getNextActionState, rejectNextAction, reviseNextAction, saveNextAction, startNextActionDraft,
    type NextActionResult, type NextActionState, type PlanEdits,
} from "@/lib/next-action/actions";
import { NEXT_ACTION_MAX_REVISIONS, NEXT_ACTION_TEXT_LIMITS, PLAN_INTENT_LABELS, PLAN_INTENTS, type PlanIntent, type PlanOrigin } from "@/lib/next-action/config";
import { dayLabel } from "@/lib/next-action/labels";
import { CalendarCheck2, Loader2, Pencil, RefreshCw, Sparkles } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import NextActionPlan from "./next-action-plan";
import NextActionEditor from "./next-action-editor";

type Step = "loading" | "ask" | "generating" | "draft" | "edit" | "saved";

type Props = {
    projectId: string;
    open: boolean;
    onOpenChange: ( open: boolean ) => void;
    origin: PlanOrigin;
    /** called whenever the saved plan may have changed (save, reject, manual plan) */
    onChanged?: ( state: NextActionState ) => void;
};

/**
 * The next action popup: ask → (choose when, after a task) → AI draft → revise up to 3 times →
 * save / reject, or edit / make one by hand. Closing it keeps an open draft for later.
 */
const NextActionDialog = ( { projectId, open, onOpenChange, origin, onChanged }: Props ) => {

    const [ step, setStep ] = useState<Step>( "loading" );
    const [ state, setState ] = useState<NextActionState | null>( null );
    const [ error, setError ] = useState<string | null>( null );
    const [ feedback, setFeedback ] = useState( "" );
    const [ pending, startTransition ] = useTransition();

    // (re)load when opened: an open draft resumes, otherwise ask first
    useEffect( () => {

        if( !open ) return;

        let cancelled = false;
        setStep( "loading" );
        setError( null );
        setFeedback( "" );

        getNextActionState( projectId ).then( res => {
            if( cancelled ) return;
            if( !res.ok ) { setError( res.message ); setStep( "ask" ); return; }
            setState( res.state );
            setStep( res.state.draftId ? "draft" : "ask" );
        } );

        return () => { cancelled = true; };

    }, [ open, projectId ] );

    const apply = ( res: NextActionResult, next: Step, onOk?: ( s: NextActionState ) => void ) => {

        if( res.state ) setState( res.state );

        if( !res.ok ) {
            setError( res.message );
            // a failed run keeps the draft (and its remaining tries); without a draft go back
            setStep( res.state?.draftId ? "draft" : res.state ? "ask" : step === "generating" ? "ask" : step );
            return;
        }

        setError( null );
        setStep( next );
        onOk?.( res.state );

    };

    const generate = ( intent: PlanIntent | null ) => {
        setStep( "generating" );
        setError( null );
        startTransition( async () => apply( await startNextActionDraft( projectId, origin, intent ), "draft" ) );
    };

    const revise = ( withFeedback: boolean ) => {
        if( !state?.draftId ) return;
        const draftId = state.draftId;
        const text = withFeedback ? feedback : "";
        setStep( "generating" );
        setError( null );
        startTransition( async () => {
            const res = await reviseNextAction( projectId, draftId, text );
            if( res.ok ) setFeedback( "" );
            apply( res, "draft" );
        } );
    };

    const save = ( edits?: PlanEdits ) => {
        startTransition( async () => {
            const res = state?.draftId
                ? await saveNextAction( projectId, state.draftId, edits ?? null )
                : edits ? await createManualNextAction( projectId, edits ) : null;
            if( !res ) return;
            apply( res, "saved", s => { toast.success( "次のアクションを保存しました" ); onChanged?.( s ); } );
        } );
    };

    const reject = () => {
        if( !state?.draftId ) { onOpenChange( false ); return; }
        const draftId = state.draftId;
        startTransition( async () => {
            apply( await rejectNextAction( projectId, draftId ), "ask", s => { onChanged?.( s ); onOpenChange( false ); } );
        } );
    };

    const draft = state?.draft ?? null;
    const remaining = state ? Math.max( 0, state.draftRemaining ) : 0;
    const noCandidates = state !== null && state.candidates.length === 0;

    return (
        <Dialog open={open} onOpenChange={o => { if( !pending ) onOpenChange( o ); }}>
            <DialogContent className="sm:max-w-lg">

                <DialogHeader>
                    <DialogTitle className="flex items-center gap-1.5"><Sparkles className="size-4 text-primary"/> 次のアクション</DialogTitle>
                    <DialogDescription>
                        { step === "ask" && origin === "task_completed" && "お疲れさまでした！次はいつ、何をしますか？AIが次のタスクを提案します。" }
                        { step === "ask" && origin !== "task_completed" && "ゴールツリーをもとに、次に取り組むタスクをAIが提案します。作成しますか？" }
                        { step === "generating" && "AIがツリー・今日の作業・ジャーニーから次のタスクを考えています…" }
                        { step === "draft" && "提案を確認してください。保存すると、ダッシュボード・ツリー・カレンダーに表示されます。" }
                        { step === "edit" && "始めたいタスクと日にちを自分で選べます。" }
                        { step === "saved" && "保存しました。" }
                    </DialogDescription>
                </DialogHeader>

                { error && <p className="rounded-md bg-destructive/10 p-2 text-xs text-destructive">{ error }</p> }

                { step === "loading" && <div className="flex justify-center py-6"><Loader2 className="size-5 animate-spin"/></div> }

                { step === "generating" && (
                    <div className="flex flex-col items-center gap-2 py-6 text-sm text-muted-foreground">
                        <Loader2 className="size-6 animate-spin text-primary"/>
                        <span>少々お待ちください</span>
                    </div>
                ) }

                { step === "ask" && noCandidates && (
                    <p className="text-sm text-muted-foreground">今始められるタスクがありません。ゴールツリーにタスクを追加してから作成してください。</p>
                ) }

                { step === "ask" && !noCandidates && origin === "task_completed" && (
                    <div className="flex flex-col gap-2">
                        { PLAN_INTENTS.map( intent => (
                            <Button key={intent} variant={intent === "unsure" ? "outline" : "secondary"} className="h-auto cursor-pointer justify-start border border-black/10 py-2 text-left whitespace-normal" disabled={pending} onClick={() => generate( intent )}>
                                { PLAN_INTENT_LABELS[ intent ] }
                            </Button>
                        ) ) }
                    </div>
                ) }

                { step === "draft" && state && (
                    draft
                        ? <NextActionPlan plan={draft} todayKey={state.todayKey} projectId={projectId}/>
                        : <p className="text-sm text-muted-foreground">まだ提案がありません。もう一度お試しいただくか、自分で選んでください。</p>
                ) }

                { step === "draft" && state && remaining > 0 && draft && (
                    <div className="flex flex-col gap-1.5">
                        <Textarea
                            value={feedback}
                            maxLength={NEXT_ACTION_TEXT_LIMITS.feedback}
                            placeholder="変えてほしいこと（例：もっと短いタスクがいい、明日にしたい）"
                            onChange={e => setFeedback( e.target.value )}
                            disabled={pending}
                            className="min-h-12 text-sm"/>
                        <p className="text-xs text-muted-foreground">修正・再生成はあと { Math.min( remaining, NEXT_ACTION_MAX_REVISIONS ) } 回できます。</p>
                    </div>
                ) }

                { step === "draft" && state && remaining === 0 && (
                    <p className="text-xs text-muted-foreground">再生成の回数を使い切りました。保存するか、却下してください（自分で編集もできます）。</p>
                ) }

                { step === "edit" && state && (
                    <NextActionEditor
                        state={state}
                        initial={draft ?? state.saved}
                        pending={pending}
                        onCancel={() => setStep( state.draftId ? "draft" : "ask" )}
                        onSave={save}/>
                ) }

                { step === "saved" && state?.saved && (
                    <NextActionPlan plan={state.saved} todayKey={state.todayKey} projectId={projectId} startable={state.saved.scheduledFor <= state.todayKey} compact/>
                ) }

                { step !== "edit" && step !== "loading" && step !== "generating" && (
                    <DialogFooter className="flex-wrap gap-2">

                        { step === "ask" && origin !== "task_completed" && !noCandidates && (
                            <>
                                <Button variant="ghost" className="cursor-pointer" onClick={() => onOpenChange( false )}>今はしない</Button>
                                <Button variant="outline" className="cursor-pointer" onClick={() => setStep( "edit" )}><Pencil/> 自分で選ぶ</Button>
                                <Button className="cursor-pointer" disabled={pending} onClick={() => generate( null )}><Sparkles/> 作成する</Button>
                            </>
                        ) }

                        { step === "ask" && origin === "task_completed" && !noCandidates && (
                            <>
                                <Button variant="ghost" className="cursor-pointer" onClick={() => onOpenChange( false )}>今はしない</Button>
                                <Button variant="outline" className="cursor-pointer" onClick={() => setStep( "edit" )}><Pencil/> 自分で選ぶ</Button>
                            </>
                        ) }

                        { step === "ask" && noCandidates && <Button variant="secondary" className="cursor-pointer" onClick={() => onOpenChange( false )}>閉じる</Button> }

                        { step === "draft" && (
                            <>
                                <Button variant="ghost" className="cursor-pointer text-destructive" disabled={pending} onClick={reject}>却下</Button>
                                <Button variant="outline" className="cursor-pointer" disabled={pending} onClick={() => setStep( "edit" )}><Pencil/> 自分で編集</Button>
                                { remaining > 0 && (
                                    <Button variant="outline" className="cursor-pointer" disabled={pending} onClick={() => revise( !!feedback.trim() )}>
                                        <RefreshCw/> { draft ? ( feedback.trim() ? "修正して再生成" : "再生成" ) : "もう一度試す" }
                                    </Button>
                                ) }
                                { draft && <Button className="cursor-pointer" disabled={pending || draft.stale} onClick={() => save()}><CalendarCheck2/> 保存</Button> }
                            </>
                        ) }

                        { step === "saved" && (
                            <Button variant="secondary" className="cursor-pointer" onClick={() => onOpenChange( false )}>
                                { state?.saved && state.saved.scheduledFor > state.todayKey ? `${dayLabel( state.saved.scheduledFor, state.todayKey )}に取り組みましょう` : "閉じる" }
                            </Button>
                        ) }

                    </DialogFooter>
                ) }

            </DialogContent>
        </Dialog>
    );

};

export default NextActionDialog;
