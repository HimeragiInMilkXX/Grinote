"use client"

import { analyzeReport, confirmReport, deleteEvidence, resumeWork, saveReflectionDraft, uploadEvidence, type EvidenceActionResult, type ReportActionResult, type ReportState } from "@/app/project/[projectId]/task_report/serverActions";
import EvidenceGallery from "@/components/project/evidence/evidence-gallery";
import JourneyAnalysisView from "@/components/project/journey/journey-analysis-view";
import { formatMinutes } from "@/components/project/journey/format";
import EvidenceUpload from "@/components/project/task-report/evidence-upload";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { MAX_EVIDENCE, validateEvidenceFile, type EvidenceView } from "@/lib/journey/evidence";
import { evidenceAddedAfterAnalysis, type JournalView } from "@/lib/journey/journal";
import { CLARIFICATION_ANSWER_MAX_LENGTH, EMPTY_REFLECTION, isReflectionComplete, REFLECTION_MAX_LENGTH, REFLECTION_QUESTIONS, reportSchema, type Reflection, type ReflectionKey } from "@/lib/journey/reflection";
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { CircleAlert, CircleCheck, Circle, FileUp, Loader2, NotebookPen, RotateCcw, Sparkles, Timer } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { useForm, useWatch, type Resolver } from "react-hook-form";

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
            <AlertDescription className="whitespace-pre-line"> { message } </AlertDescription>
        </Alert>
    );

}

function AnalyzingNotice( { withEvidence }: { withEvidence: boolean } ) {

    return (
        <div className="flex items-center gap-3 rounded-xl border px-4 py-3 text-sm" role="status">
            <Loader2 className="size-4 shrink-0 animate-spin"/>
            <span>
                { withEvidence
                    ? "AIが証拠と振り返りを分析しています…（動画・音声があると数分かかることがあります）"
                    : "AIが振り返りを分析しています…（ローカルのAIでは1〜2分かかることがあります）" }
            </span>
        </div>
    );

}

function CompletenessItem( { ok, label }: { ok: boolean; label: string } ) {

    return (
        <span className={cn( "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs", ok ? "border-green-600/40 bg-green-600/10 text-green-700 dark:text-green-400" : "text-muted-foreground" )}>
            { ok ? <CircleCheck className="size-3.5"/> : <Circle className="size-3.5"/> } { label }
        </span>
    );

}

/** How complete the report is: evidence and reflections (both recommended, either one is enough). */
function ReportCompleteness( { hasEvidence, reflectionDone }: { hasEvidence: boolean; reflectionDone: boolean } ) {

    const done = Number( hasEvidence ) + Number( reflectionDone );

    return (
        <div className={cn( "flex flex-col gap-1.5 rounded-xl border px-4 py-3", done === 2 ? "border-green-600/40 bg-green-600/5" : "border-amber-500/40 bg-amber-500/5" )}>
            <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium"> レポートの充実度 { done } / 2 </span>
                <CompletenessItem ok={hasEvidence} label="証拠"/>
                <CompletenessItem ok={reflectionDone} label="振り返り"/>
            </div>
            <p className="text-xs text-muted-foreground">
                { done === 2
                    ? "ばっちりです！証拠と振り返りの両方から、AIがより正確に評価します。"
                    : done === 1
                        ? `このままでも分析できますが、${ hasEvidence ? "振り返り" : "証拠" }も加えると評価がより正確になり、ジャーニーの記録も充実します。`
                        : "証拠のアップロードか、3つの振り返りのどちらかが必要です（両方がおすすめ）。" }
            </p>
        </div>
    );

}

const TaskReportFlow = ( { report }: { report: ReportState } ) => {

    const { recordId, projectId, task, limits, evidenceEnabled } = report;

    const [ journal, setJournal ] = useState<JournalView | null>( report.journal );
    const [ evidence, setEvidence ] = useState<EvidenceView[]>( report.evidence );
    const [ uploading, setUploading ] = useState<string[]>( [] );
    const [ deletingId, setDeletingId ] = useState<string | null>( null );
    const [ error, setError ] = useState<string | null>( null );
    const [ editing, setEditing ] = useState( false );
    // answers belong to one clarification round (key), so a new round always starts empty
    const [ answerState, setAnswerState ] = useState<{ key: string; values: string[] }>( { key: "", values: [] } );
    const [ isPending, startTransition ] = useTransition();

    const status = journal?.status ?? "draft";
    const pendingQuestions = journal?.pendingQuestions ?? [];
    const hasAnalysis = !!journal?.analysis && status === "analyzed";
    const runsLeft = Math.max( 0, limits.maxRuns - ( journal?.analysisRuns ?? 0 ) );
    const hasEvidence = evidence.length > 0;
    const evidenceBusy = uploading.length > 0 || deletingId !== null;
    const busy = isPending || evidenceBusy;

    const clarifyKey = `${journal?.clarificationRounds ?? 0}:${pendingQuestions.join( "|" )}`;
    const answers = answerState.key === clarifyKey ? answerState.values : pendingQuestions.map( () => "" );
    const setAnswer = ( i: number, value: string ) => setAnswerState( { key: clarifyKey, values: answers.map( ( a, j ) => j === i ? value : a ) } );

    const mode: "form" | "clarify" | "result" | "busy" =
        status === "analyzing" && !isPending ? "busy"
        : status === "needs_clarification" && pendingQuestions.length > 0 ? "clarify"
        : hasAnalysis && !editing ? "result"
        : "form";

    // evidence makes the answers optional: the resolver reads the current state on every validation
    const hasEvidenceRef = useRef( hasEvidence );
    useEffect( () => { hasEvidenceRef.current = hasEvidence; }, [ hasEvidence ] );
    const resolver: Resolver<Reflection> = ( values, context, options ) => zodResolver( reportSchema( hasEvidenceRef.current ) )( values, context, options ) as ReturnType<Resolver<Reflection>>;

    const form = useForm<Reflection>( {
        resolver,
        defaultValues: journal?.reflection ?? EMPTY_REFLECTION,
        mode: "onSubmit",
    } );

    const { register, handleSubmit, formState, getValues, reset, setError: setFieldError, clearErrors, control } = form;
    const values = useWatch( { control } ) as Partial<Reflection>;
    const reflectionDone = isReflectionComplete( values );

    // files the current analysis didn't look at (uploaded while editing): confirm is blocked
    const unanalysed = hasAnalysis ? evidenceAddedAfterAnalysis( evidence, journal?.analysis ?? null ) : [];

    useLeaveGuard( busy || ( mode === "form" && formState.isDirty ) || answers.some( a => a.trim() ) );

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

    const applyEvidenceResult = ( res: EvidenceActionResult ) => {

        if( res.journal ) setJournal( res.journal );
        if( res.ok ) setEvidence( res.evidence );
        return res.ok ? null : res.message;

    };

    /** Uploads one at a time (server actions run in order anyway); every problem is listed. */
    const addFiles = async ( files: File[] ) => {

        const errors: string[] = [];
        const slots = MAX_EVIDENCE - evidence.length;
        const accepted: File[] = [];

        for( const file of files ) {
            const check = validateEvidenceFile( file );
            if( !check.ok ) errors.push( check.error );
            else if( accepted.length >= slots ) errors.push( `「${file.name}」は追加できません（証拠は${MAX_EVIDENCE}件まで）。` );
            else accepted.push( file );
        }

        setError( errors.length ? errors.join( "\n" ) : null );
        if( accepted.length === 0 ) return;

        setUploading( accepted.map( f => f.name ) );

        for( const file of accepted ) {

            const data = new FormData();
            data.append( "file", file );

            try {
                const message = applyEvidenceResult( await uploadEvidence( recordId, projectId, data ) );
                if( message ) errors.push( `「${file.name}」: ${message}` );
            } catch {
                errors.push( `「${file.name}」: 通信エラーが発生しました。ファイルが大きすぎるか、接続が切れた可能性があります。` );
            }

            setUploading( names => names.slice( 1 ) );

        }

        setUploading( [] );
        setError( errors.length ? errors.join( "\n" ) : null );
        if( errors.length === 0 ) clearErrors();

    };

    const removeFile = async ( id: string ) => {

        const item = evidence.find( e => e.id === id );
        if( !window.confirm( `「${item?.name ?? "このファイル"}」を削除しますか？\n${ hasAnalysis ? "AIの分析結果は残ります。" : "" }` ) ) return;

        setDeletingId( id );

        try {
            setError( applyEvidenceResult( await deleteEvidence( recordId, projectId, id ) ) );
        } catch {
            setError( "通信エラーが発生しました。もう一度お試しください。" );
        } finally {
            setDeletingId( null );
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

        if( !window.confirm( "タイマーに戻りますか？\n記録した時間・書いた振り返り・アップロードした証拠は残りますが、AIの分析結果はやり直しになります。" ) ) return;

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

    const scrollTo = ( id: string ) => document.getElementById( id )?.scrollIntoView( { behavior: "smooth", block: "start" } );

    const uploadDisabledReason = !evidenceEnabled
        ? "現在、証拠を分析できるAI（クラウドAI）が利用できないため、証拠のアップロードは使えません。振り返りで報告してください。"
        : runsLeft <= 0 ? "AIの分析回数の上限に達したため、証拠を追加できません。" : null;

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
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
                        <span className="flex items-center gap-1"><Timer className="size-4"/> 集中 { formatMinutes( report.durationMs / 60000, "0秒" ) }</span>
                        { report.timer && <span> { report.timer.sessions }セッション </span> }
                        { report.timer && <span> 休憩 { report.timer.breaks }回・{ formatMinutes( report.timer.breakMs / 60000, "0分" ) } </span> }
                        <span> 予定 { formatMinutes( task.estimatedMinutes ) } </span>
                    </div>
                    <Button variant="outline" size="sm" onClick={backToWork} disabled={busy}>
                        <RotateCcw/> 作業に戻る
                    </Button>
                </CardContent>
            </Card>

            {/* how to report */}
            { mode === "form" && !hasAnalysis && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base"> レポートの方法 </CardTitle>
                        <CardDescription> どちらか一方でも分析できます。両方そろえると、より正確な評価と充実した記録になります（おすすめ）。 </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-3 sm:grid-cols-2">
                        <button
                            type="button"
                            onClick={() => scrollTo( "report-evidence" )}
                            className={cn( "flex items-start gap-3 rounded-2xl border px-4 py-3 text-left transition-colors hover:bg-muted/60", hasEvidence ? "border-green-600/40 bg-green-600/5" : "border-dashed", !evidenceEnabled && "opacity-60" )}
                        >
                            <FileUp className="mt-0.5 size-5 shrink-0"/>
                            <span className="flex flex-col gap-0.5">
                                <span className="flex items-center gap-1.5 text-sm font-medium"> 証拠をアップロード { hasEvidence && <CircleCheck className="size-4 text-green-600"/> } </span>
                                <span className="text-xs text-muted-foreground">
                                    { evidenceEnabled ? `写真・動画・音声（最大${MAX_EVIDENCE}件）をAIが確認します。${ hasEvidence ? `${evidence.length}件アップロード済み。` : "" }` : "現在は利用できません（クラウドAIが必要です）。" }
                                </span>
                            </span>
                        </button>
                        <button
                            type="button"
                            onClick={() => scrollTo( "report-reflection" )}
                            className={cn( "flex items-start gap-3 rounded-2xl border px-4 py-3 text-left transition-colors hover:bg-muted/60", reflectionDone ? "border-green-600/40 bg-green-600/5" : "border-dashed" )}
                        >
                            <NotebookPen className="mt-0.5 size-5 shrink-0"/>
                            <span className="flex flex-col gap-0.5">
                                <span className="flex items-center gap-1.5 text-sm font-medium"> 振り返りに答える { reflectionDone && <CircleCheck className="size-4 text-green-600"/> } </span>
                                <span className="text-xs text-muted-foreground"> 3つの質問に答えると、AIが内容を分析します。 </span>
                            </span>
                        </button>
                    </CardContent>
                </Card>
            ) }

            <ErrorAlert message={error}/>

            {/* evidence (editable while writing or re-analysing) */}
            { mode === "form" && (
                <Card id="report-evidence" className="scroll-mt-4">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base"><FileUp className="size-4"/> 証拠 <span className="text-xs font-normal text-muted-foreground">（{ evidence.length } / { MAX_EVIDENCE }）</span></CardTitle>
                        <CardDescription> 作業の様子や成果が分かる写真・動画・音声をアップロードすると、AIが内容を確認して評価に使います。 </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-4">
                        <EvidenceGallery
                            items={evidence}
                            reports={hasAnalysis ? journal?.analysis?.evidence : undefined}
                            pendingLabel={hasAnalysis ? "まだ分析されていません（再分析すると評価に使われます）" : null}
                            onDelete={removeFile}
                            deletingId={deletingId}
                            disabled={isPending || uploading.length > 0}
                        />
                        <EvidenceUpload
                            count={evidence.length}
                            uploading={uploading}
                            disabled={isPending || deletingId !== null}
                            disabledReason={uploadDisabledReason}
                            onFiles={files => { void addFiles( files ); }}
                        />
                    </CardContent>
                </Card>
            ) }

            {/* reflections */}
            { mode === "form" && (
                <Card id="report-reflection" className="scroll-mt-4">
                    <CardHeader>
                        <CardTitle className="text-base"> { hasAnalysis ? "振り返りを修正して再分析" : "振り返り" } </CardTitle>
                        <CardDescription>
                            { hasEvidence
                                ? "証拠があるので振り返りは任意ですが、書くほど評価が正確になり、記録も充実します。"
                                : "うまくいかなかったことも大切な記録です。3つすべてに答えてください（証拠をアップロードした場合は任意）。" }
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={onSubmit} className="flex flex-col gap-5">
                            {
                                REFLECTION_QUESTIONS.map( ( q, i ) => {
                                    const fieldError = formState.errors[ q.key ]?.message;
                                    const length = ( values[ q.key ] ?? "" ).length;
                                    return (
                                        <div key={q.key} className="flex flex-col gap-1.5">
                                            <label htmlFor={`reflection-${q.key}`} className="text-sm font-medium"> { i + 1 }. { q.label } { hasEvidence && <span className="text-xs font-normal text-muted-foreground">（任意）</span> } </label>
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

                            <ReportCompleteness hasEvidence={hasEvidence} reflectionDone={reflectionDone}/>

                            { isPending && <AnalyzingNotice withEvidence={hasEvidence}/> }

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
                                    <Button type="button" variant="outline" disabled={busy} onClick={() => { setEditing( false ); reset( journal?.reflection ?? EMPTY_REFLECTION ); setError( null ); }}>
                                        キャンセル
                                    </Button>
                                ) }
                                { status === "failed" && (
                                    <Button type="button" variant="secondary" disabled={busy} onClick={confirm}>
                                        AIなしで受け取る
                                    </Button>
                                ) }
                                <Button type="submit" disabled={busy}>
                                    { isPending ? <Loader2 className="animate-spin"/> : <Sparkles/> }
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

                        { isPending && <AnalyzingNotice withEvidence={hasEvidence}/> }

                        <div className="flex flex-wrap justify-end gap-2">
                            <Button variant="outline" disabled={isPending} onClick={() => run( { skip: true } )}> これ以上書けない </Button>
                            <Button disabled={isPending || answers.some( a => !a.trim() )} onClick={() => run( { answers } )}>
                                { isPending ? <Loader2 className="animate-spin"/> : null } 回答して分析
                            </Button>
                        </div>

                        <details className="text-sm">
                            <summary className="cursor-pointer text-muted-foreground"> 自分のレポートを見る </summary>
                            <dl className="mt-2 flex flex-col gap-2">
                                { REFLECTION_QUESTIONS.map( q => (
                                    <div key={q.key}>
                                        <dt className="text-xs font-medium text-muted-foreground"> { q.label } </dt>
                                        <dd className="whitespace-pre-wrap"> { values[ q.key ] || "—" } </dd>
                                    </div>
                                ) ) }
                            </dl>
                            { hasEvidence && <div className="mt-3"><EvidenceGallery items={evidence}/></div> }
                        </details>
                    </CardContent>
                </Card>
            ) }

            {/* a run started elsewhere (another tab) is still going */}
            { mode === "busy" && (
                <Card>
                    <CardContent className="flex flex-col items-start gap-3 text-sm">
                        <AnalyzingNotice withEvidence={hasEvidence}/>
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

                        { ( evidence.length > 0 || ( journal.analysis.evidence?.length ?? 0 ) > 0 ) && (
                            <section className="flex flex-col gap-2">
                                <h3 className="flex items-center gap-1.5 text-sm font-semibold"><FileUp className="size-4"/> 証拠とAIのレポート </h3>
                                <EvidenceGallery
                                    items={evidence}
                                    reports={journal.analysis.evidence}
                                    pendingLabel="まだ分析されていません（再分析すると評価に使われます）"
                                    onDelete={removeFile}
                                    deletingId={deletingId}
                                    disabled={isPending}
                                />
                            </section>
                        ) }

                        <JourneyAnalysisView analysis={journal.analysis}/>

                        { unanalysed.length > 0 && (
                            <Alert>
                                <CircleAlert/>
                                <AlertTitle> 分析されていない証拠があります </AlertTitle>
                                <AlertDescription> 分析のあとに追加した証拠があります。「修正して再分析」で分析するか、その証拠を削除してから確定してください。 </AlertDescription>
                            </Alert>
                        ) }

                        { isPending && (
                            <div className="flex items-center gap-3 text-sm text-muted-foreground" role="status"><Loader2 className="size-4 animate-spin"/> 処理しています… </div>
                        ) }

                        <div className="flex flex-wrap justify-end gap-2">
                            <Button variant="outline" disabled={busy || runsLeft <= 0} onClick={() => { setEditing( true ); setError( null ); }}>
                                { runsLeft > 0 ? `修正して再分析（残り${runsLeft}回）` : "再分析の上限に達しました" }
                            </Button>
                            <Button disabled={busy || unanalysed.length > 0} onClick={confirm}> 確認して経験値を受け取る </Button>
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
