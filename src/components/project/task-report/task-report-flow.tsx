"use client"

import { analyzeReport, confirmReport, resumeWork, saveReflectionDraft, type ReportActionResult, type ReportState } from "@/app/project/[projectId]/task_report/serverActions";
import JourneyAnalysisView from "@/components/project/journey/journey-analysis-view";
import { formatMinutes } from "@/components/project/journey/format";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { JournalView } from "@/lib/journey/journal";
import { CLARIFICATION_ANSWER_MAX_LENGTH, EMPTY_REFLECTION, REFLECTION_MAX_LENGTH, REFLECTION_QUESTIONS, reflectionSchema, type Reflection, type ReflectionKey } from "@/lib/journey/reflection";
import { zodResolver } from "@hookform/resolvers/zod";
import { CircleAlert, FileUp, Loader2, NotebookPen, RotateCcw, Timer } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";

/** Asks before leaving while there is something unsaved or an analysis is running. */
function useLeaveGuard( active: boolean ) {

    useEffect( () => {

        if( !active ) return;

        const onBeforeUnload = ( e: BeforeUnloadEvent ) => { e.preventDefault(); };
        window.addEventListener( "beforeunload", onBeforeUnload );

        return () => window.removeEventListener( "beforeunload", onBeforeUnload );

    }, [ active ] );

}

function ErrorAlert( { message }: { message: string | null } ) {

    if( !message ) return null;

    return (
        <Alert variant="destructive">
            <CircleAlert/>
            <AlertTitle> エラー </AlertTitle>
            <AlertDescription> { message } </AlertDescription>
        </Alert>
    );

}

function AnalyzingNotice() {

    return (
        <div className="flex items-center gap-3 rounded-xl border px-4 py-3 text-sm" role="status">
            <Loader2 className="size-4 animate-spin"/>
            <span> AIが振り返りを分析しています…（ローカルのAIでは1〜2分かかることがあります） </span>
        </div>
    );

}

const TaskReportFlow = ( { report }: { report: ReportState } ) => {

    const { recordId, projectId, task, limits } = report;

    const [ journal, setJournal ] = useState<JournalView | null>( report.journal );
    const [ error, setError ] = useState<string | null>( null );
    const [ editing, setEditing ] = useState( false );
    // answers belong to one clarification round (key), so a new round always starts empty
    const [ answerState, setAnswerState ] = useState<{ key: string; values: string[] }>( { key: "", values: [] } );
    const [ isPending, startTransition ] = useTransition();

    const status = journal?.status ?? "draft";
    const pendingQuestions = journal?.pendingQuestions ?? [];
    const hasAnalysis = !!journal?.analysis && status === "analyzed";
    const runsLeft = Math.max( 0, limits.maxRuns - ( journal?.analysisRuns ?? 0 ) );

    const clarifyKey = `${journal?.clarificationRounds ?? 0}:${pendingQuestions.join( "|" )}`;
    const answers = answerState.key === clarifyKey ? answerState.values : pendingQuestions.map( () => "" );
    const setAnswer = ( i: number, value: string ) => setAnswerState( { key: clarifyKey, values: answers.map( ( a, j ) => j === i ? value : a ) } );

    const mode: "form" | "clarify" | "result" | "busy" =
        status === "analyzing" && !isPending ? "busy"
        : status === "needs_clarification" && pendingQuestions.length > 0 ? "clarify"
        : hasAnalysis && !editing ? "result"
        : "form";

    const form = useForm<Reflection>( {
        resolver: zodResolver( reflectionSchema ),
        defaultValues: journal?.reflection ?? EMPTY_REFLECTION,
        mode: "onSubmit",
    } );

    const { register, handleSubmit, formState, getValues, reset, setError: setFieldError, control } = form;
    const values = useWatch( { control } ) as Partial<Reflection>;


    useLeaveGuard( isPending || ( mode === "form" && formState.isDirty ) || answers.some( a => a.trim() ) );

    const lastSaved = useRef<string>( JSON.stringify( journal?.reflection ?? EMPTY_REFLECTION ) );

    // drafts are saved on blur while writing the first report (an analysed one changes only via 再分析)
    const saveDraft = () => {

        if( ( status !== "draft" && status !== "failed" ) || isPending ) return;

        const current = getValues();
        const key = JSON.stringify( current );
        if( key === lastSaved.current ) return;

        lastSaved.current = key;

        saveReflectionDraft( recordId, projectId, current )
            .then( res => {
                if( res.ok ) {
                    setJournal( res.journal );
                    reset( current, { keepValues: true } );
                }
            } )
            .catch( () => { lastSaved.current = ""; } );

    };

    const applyResult = ( res: ReportActionResult, onOk?: () => void ) => {

        if( res.journal ) setJournal( res.journal );

        if( res.ok ) {
            setError( null );
            onOk?.();
            return;
        }

        setError( res.message );

        if( res.errors ) {
            for( const [ key, message ] of Object.entries( res.errors ) ) setFieldError( key as ReflectionKey, { message } );
        }

    };

    const run = ( input: { answers?: string[]; skip?: boolean } ) => {

        const reflection = getValues();

        startTransition( async () => {

            try {
                const res = await analyzeReport( recordId, projectId, { reflection, ...input } );
                applyResult( res, () => {
                    setEditing( false );
                    lastSaved.current = JSON.stringify( reflection );
                    reset( reflection );
                } );
            } catch {
                setError( "通信エラーが発生しました。もう一度お試しください。" );
            }

        } );

    };

    const onSubmit = handleSubmit( () => run( {} ) );

    const confirm = () => {

        startTransition( async () => {
            try {
                // redirects to the reward page on success
                const res = await confirmReport( recordId, projectId );
                if( res ) applyResult( res );
            } catch( e ) {
                if( isRedirect( e ) ) throw e;
                setError( "通信エラーが発生しました。もう一度お試しください。" );
            }
        } );

    };

    const backToWork = () => {

        if( !window.confirm( "タイマーに戻りますか？\n記録した時間と書いた振り返りは残りますが、AIの分析結果はやり直しになります。" ) ) return;

        startTransition( async () => {
            try {
                const res = await resumeWork( recordId, projectId );
                if( res ) applyResult( res );
            } catch( e ) {
                if( isRedirect( e ) ) throw e;
                setError( "通信エラーが発生しました。もう一度お試しください。" );
            }
        } );

    };

    return (
        <div className="flex w-full max-w-3xl flex-col gap-4 px-4 py-2 *:shrink-0">

            {/* header */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg"><NotebookPen className="size-5"/> タスク完了レポート </CardTitle>
                    <CardDescription>
                        「{ task.name }」お疲れさまでした！ 経験値を受け取る前に、今回の作業を振り返りましょう。
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 text-sm">
                    <div className="flex gap-4 text-muted-foreground">
                        <span className="flex items-center gap-1"><Timer className="size-4"/> 実際 { formatMinutes( report.durationMs / 60000, "0秒" ) }</span>
                        <span> 予定 { formatMinutes( task.estimatedMinutes ) } </span>
                    </div>
                    <Button variant="outline" size="sm" onClick={backToWork} disabled={isPending}>
                        <RotateCcw/> 作業に戻る
                    </Button>
                </CardContent>
            </Card>

            {/* how to report */}
            { mode === "form" && !hasAnalysis && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base"> レポートの方法 </CardTitle>
                        <CardDescription> 両方そろえると、より正確な評価と充実した記録になります（おすすめ）。 </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-3 sm:grid-cols-2">
                        <div className="flex items-start gap-3 rounded-2xl border border-dashed px-4 py-3 opacity-60" aria-disabled="true">
                            <FileUp className="mt-0.5 size-5 shrink-0"/>
                            <div className="flex flex-col gap-0.5">
                                <span className="text-sm font-medium"> 証拠をアップロード <span className="ml-1 rounded bg-muted px-1.5 py-0.5 text-[10px]">準備中</span></span>
                                <span className="text-xs text-muted-foreground"> 写真・動画・音声をAIが確認します。近日公開。 </span>
                            </div>
                        </div>
                        <div className="flex items-start gap-3 rounded-2xl border border-primary/40 bg-primary/5 px-4 py-3">
                            <NotebookPen className="mt-0.5 size-5 shrink-0"/>
                            <div className="flex flex-col gap-0.5">
                                <span className="text-sm font-medium"> 振り返りに答える </span>
                                <span className="text-xs text-muted-foreground"> 3つの質問に答えると、AIが内容を分析します。 </span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            ) }

            <ErrorAlert message={error}/>

            {/* reflections */}
            { mode === "form" && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base"> { hasAnalysis ? "振り返りを修正して再分析" : "振り返り" } </CardTitle>
                        <CardDescription> うまくいかなかったことも大切な記録です。正直に書くほど評価が正確になります。 </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={onSubmit} className="flex flex-col gap-5">
                            {
                                REFLECTION_QUESTIONS.map( ( q, i ) => {
                                    const fieldError = formState.errors[ q.key ]?.message;
                                    const length = ( values[ q.key ] ?? "" ).length;
                                    return (
                                        <div key={q.key} className="flex flex-col gap-1.5">
                                            <label htmlFor={`reflection-${q.key}`} className="text-sm font-medium"> { i + 1 }. { q.label } </label>
                                            <p className="text-xs text-muted-foreground"> { q.hint } </p>
                                            <Textarea
                                                id={`reflection-${q.key}`}
                                                rows={3}
                                                maxLength={REFLECTION_MAX_LENGTH}
                                                placeholder={q.placeholder}
                                                disabled={isPending}
                                                aria-invalid={!!fieldError}
                                                {...register( q.key, { onBlur: saveDraft } )}
                                            />
                                            <div className="flex justify-between text-xs">
                                                <span className="text-destructive"> { fieldError } </span>
                                                <span className="tabular-nums text-muted-foreground"> { length } / { REFLECTION_MAX_LENGTH } </span>
                                            </div>
                                        </div>
                                    );
                                })
                            }

                            { isPending && <AnalyzingNotice/> }

                            { status === "failed" && !isPending && (
                                <Alert>
                                    <CircleAlert/>
                                    <AlertTitle> AIの分析ができませんでした </AlertTitle>
                                    <AlertDescription>
                                        もう一度分析するか、AIなしで経験値を受け取れます（AI評価ボーナスなし・×1.00）。
                                    </AlertDescription>
                                </Alert>
                            ) }

                            <div className="flex flex-wrap justify-end gap-2">
                                { hasAnalysis && (
                                    <Button type="button" variant="outline" disabled={isPending} onClick={() => { setEditing( false ); reset( journal?.reflection ?? EMPTY_REFLECTION ); setError( null ); }}>
                                        キャンセル
                                    </Button>
                                ) }
                                { status === "failed" && (
                                    <Button type="button" variant="secondary" disabled={isPending} onClick={confirm}>
                                        AIなしで受け取る
                                    </Button>
                                ) }
                                <Button type="submit" disabled={isPending}>
                                    { isPending ? <Loader2 className="animate-spin"/> : null }
                                    { hasAnalysis ? `再分析する（残り${runsLeft}回）` : status === "failed" ? "もう一度分析する" : "AIに分析してもらう" }
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            ) }

            {/* clarifying questions */}
            { mode === "clarify" && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base"> AIからの質問 </CardTitle>
                        <CardDescription> 正確に評価するために、もう少し教えてください。書けない場合は「これ以上書けない」を押してください。 </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-4">
                        {
                            pendingQuestions.map( ( question, i ) => (
                                <div key={i} className="flex flex-col gap-1.5">
                                    <label htmlFor={`clarify-${i}`} className="text-sm font-medium"> { question } </label>
                                    <Textarea
                                        id={`clarify-${i}`}
                                        rows={2}
                                        maxLength={CLARIFICATION_ANSWER_MAX_LENGTH}
                                        disabled={isPending}
                                        value={answers[i] ?? ""}
                                        onChange={e => setAnswer( i, e.target.value )}
                                    />
                                </div>
                            ) )
                        }

                        { isPending && <AnalyzingNotice/> }

                        <div className="flex flex-wrap justify-end gap-2">
                            <Button variant="outline" disabled={isPending} onClick={() => run( { skip: true } )}> これ以上書けない </Button>
                            <Button disabled={isPending || answers.some( a => !a.trim() )} onClick={() => run( { answers } )}>
                                { isPending ? <Loader2 className="animate-spin"/> : null } 回答して分析
                            </Button>
                        </div>

                        <details className="text-sm">
                            <summary className="cursor-pointer text-muted-foreground"> 自分の振り返りを見る </summary>
                            <dl className="mt-2 flex flex-col gap-2">
                                { REFLECTION_QUESTIONS.map( q => (
                                    <div key={q.key}>
                                        <dt className="text-xs font-medium text-muted-foreground"> { q.label } </dt>
                                        <dd className="whitespace-pre-wrap"> { values[ q.key ] } </dd>
                                    </div>
                                ) ) }
                            </dl>
                        </details>
                    </CardContent>
                </Card>
            ) }

            {/* a run started elsewhere (another tab) is still going */}
            { mode === "busy" && (
                <Card>
                    <CardContent className="flex flex-col items-start gap-3 text-sm">
                        <AnalyzingNotice/>
                        <p className="text-muted-foreground"> 別の画面でAIが分析中です。終わったら再読み込みしてください。 </p>
                        <Button variant="outline" size="sm" onClick={() => window.location.reload()}> 再読み込み </Button>
                    </CardContent>
                </Card>
            ) }

            {/* analysis result */}
            { mode === "result" && journal?.analysis && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base"> AIの分析結果 </CardTitle>
                        <CardDescription> 内容を確認してください。確定すると経験値を受け取り、ジャーニーに記録されます。 </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-5">
                        <JourneyAnalysisView analysis={journal.analysis}/>

                        { isPending && (
                            <div className="flex items-center gap-3 text-sm text-muted-foreground" role="status"><Loader2 className="size-4 animate-spin"/> 処理しています… </div>
                        ) }

                        <div className="flex flex-wrap justify-end gap-2">
                            <Button variant="outline" disabled={isPending || runsLeft <= 0} onClick={() => { setEditing( true ); setError( null ); }}>
                                { runsLeft > 0 ? `修正して再分析（残り${runsLeft}回）` : "再分析の上限に達しました" }
                            </Button>
                            <Button disabled={isPending} onClick={confirm}> 確認して経験値を受け取る </Button>
                        </div>
                    </CardContent>
                </Card>
            ) }

        </div>
    );

};

/** Next.js redirect() from a server action surfaces as a thrown error on the client in some cases. */
function isRedirect( e: unknown ) {

    return typeof e === "object" && e !== null && "digest" in e && String( ( e as { digest?: unknown } ).digest ).startsWith( "NEXT_REDIRECT" );

}

export default TaskReportFlow;
