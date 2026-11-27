"use client";

import NextActionDialog from "@/components/next-action/next-action-dialog";
import NextActionPlan from "@/components/next-action/next-action-plan";
import { Button } from "@/components/ui/button";
import { clearSavedNextAction, type NextActionState } from "@/lib/next-action/actions";
import type { NextActionView } from "@/lib/next-action/types";
import { Sparkles } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";

type Props = {
    projectId: string;
    saved: NextActionView | null;
    hasDraft: boolean;
    candidateCount: number;
    todayKey: string;
    /** a task is running or paused */
    hasActiveTask: boolean;
    /** a finished task still waits for its report */
    hasPendingReport: boolean;
};

/** Project dashboard: the current next action with スタート buttons (→ timer picker). */
const ProjectDashboardNextAction = ( { projectId, saved: initialSaved, hasDraft: initialHasDraft, candidateCount, todayKey: initialToday, hasActiveTask, hasPendingReport }: Props ) => {

    const [ open, setOpen ] = useState( false );
    const [ saved, setSaved ] = useState( initialSaved );
    const [ hasDraft, setHasDraft ] = useState( initialHasDraft );
    const [ todayKey, setTodayKey ] = useState( initialToday );
    const [ pending, startTransition ] = useTransition();
    // compact by default: the card sits next to the character, whose size follows the column height
    const [ showDetails, setShowDetails ] = useState( false );

    const onChanged = ( state: NextActionState ) => {
        setSaved( state.saved );
        setHasDraft( !!state.draftId );
        setTodayKey( state.todayKey );
    };

    const clear = () => {
        if( !confirm( "この次のアクションを取り消しますか？" ) ) return;
        startTransition( async () => {
            const res = await clearSavedNextAction( projectId );
            if( !res.ok ) { toast.error( res.message ); return; }
            onChanged( res.state );
        } );
    };

    const startDisabledReason = hasPendingReport
        ? "未提出のレポートを先に書いてください。"
        : hasActiveTask ? "作業中のタスクがあります。" : null;

    return (
        <div className="flex w-0 min-w-full flex-col gap-2 rounded-2xl border bg-card p-3">

            <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 text-sm font-semibold"><Sparkles className="size-4 text-primary"/> 次のアクション</p>
                { saved && (
                    <div className="flex gap-1">
                        { candidateCount > 0 && <Button size="xs" variant="outline" className="cursor-pointer" onClick={() => setOpen( true )}>決め直す</Button> }
                        <Button size="xs" variant="ghost" className="cursor-pointer text-muted-foreground" disabled={pending} onClick={clear}>取り消す</Button>
                    </div>
                ) }
            </div>

            { saved && (
                <>
                    <NextActionPlan plan={saved} todayKey={todayKey} projectId={projectId} startable startDisabledReason={startDisabledReason} compact={!showDetails}/>
                    { ( saved.message || saved.items.some( i => i.reason ) ) && (
                        <Button size="xs" variant="link" className="self-start px-0" onClick={() => setShowDetails( v => !v )}>
                            { showDetails ? "理由を閉じる" : "理由を見る" }
                        </Button>
                    ) }
                    { hasActiveTask && !hasPendingReport && (
                        <Link href={`/project/${projectId}/onair`} className="self-end">
                            <Button size="sm" variant="secondary" className="cursor-pointer">作業中のタスクへ</Button>
                        </Link>
                    ) }
                </>
            ) }

            { !saved && (
                <div className="flex flex-col items-start gap-2">
                    <p className="text-xs text-muted-foreground">
                        { candidateCount > 0
                            ? "次に取り組むタスクがまだ決まっていません。AIと一緒に決めましょう。"
                            : "今始められるタスクがありません。ゴールツリーにタスクを追加しましょう。" }
                    </p>
                    { candidateCount > 0 && (
                        <Button size="sm" className="cursor-pointer" onClick={() => setOpen( true )}>
                            { hasDraft ? "未確定の提案を確認" : "次のアクションを作成" }
                        </Button>
                    ) }
                </div>
            ) }

            { saved && hasDraft && (
                <Button size="xs" variant="link" className="self-start px-0" onClick={() => setOpen( true )}>未確定の提案があります</Button>
            ) }

            <NextActionDialog projectId={projectId} open={open} onOpenChange={setOpen} origin="manual" onChanged={onChanged}/>

        </div>
    );

};

export default ProjectDashboardNextAction;
