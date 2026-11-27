"use client";

import { Button } from "@/components/ui/button";
import type { NextActionState } from "@/lib/next-action/actions";
import type { NextActionView } from "@/lib/next-action/types";
import { Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import NextActionDialog from "./next-action-dialog";
import NextActionPlan from "./next-action-plan";

type Props = {
    projectId: string;
    /** first visit of the reward page: open the popup by itself after the XP animation */
    autoOpen: boolean;
    /** startable tasks left in the tree (nothing to plan when 0) */
    candidateCount: number;
    saved: NextActionView | null;
    todayKey: string;
};

/** Delay so the XP animation plays before the popup covers it. */
const AUTO_OPEN_DELAY_MS = 3200;

/** Task complete page: plan the next action (popup) and show the plan once saved. */
const NextActionPrompt = ( { projectId, autoOpen, candidateCount, saved: initialSaved, todayKey }: Props ) => {

    const [ open, setOpen ] = useState( false );
    const [ saved, setSaved ] = useState( initialSaved );
    const [ today, setToday ] = useState( todayKey );

    useEffect( () => {

        if( !autoOpen || candidateCount === 0 ) return;

        const timer = setTimeout( () => setOpen( true ), AUTO_OPEN_DELAY_MS );
        return () => clearTimeout( timer );

    }, [ autoOpen, candidateCount ] );

    const onChanged = ( state: NextActionState ) => { setSaved( state.saved ); setToday( state.todayKey ); };

    if( candidateCount === 0 && !saved ) {
        return <p className="mb-3 text-sm text-muted-foreground">今始められるタスクはもうありません。ゴールツリーで次のタスクを追加しましょう。</p>;
    }

    return (
        <div className="mb-3 flex flex-col gap-2 rounded-2xl border bg-card p-3">

            <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 text-sm font-semibold"><Sparkles className="size-4 text-primary"/> 次のアクション</p>
                { candidateCount > 0 && (
                    <Button size="sm" variant={saved ? "outline" : "default"} className="cursor-pointer" onClick={() => setOpen( true )}>
                        { saved ? "決め直す" : "次のアクションを決める" }
                    </Button>
                ) }
            </div>

            { saved
                ? <NextActionPlan plan={saved} todayKey={today} projectId={projectId} startable={saved.scheduledFor <= today} compact/>
                : <p className="text-xs text-muted-foreground">次にやるタスクを決めておくと、次の作業をすぐに始められます。</p> }

            <NextActionDialog projectId={projectId} open={open} onOpenChange={setOpen} origin="task_completed" onChanged={onChanged}/>

        </div>
    );

};

export default NextActionPrompt;
