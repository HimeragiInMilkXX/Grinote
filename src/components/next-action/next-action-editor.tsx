"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { NextActionState, PlanCandidateOption, PlanEdits } from "@/lib/next-action/actions";
import { dayLabel, formatEstimate } from "@/lib/next-action/labels";
import type { NextActionView } from "@/lib/next-action/types";
import { useState } from "react";

type Props = {
    state: NextActionState;
    /** prefill (the draft or the current plan) */
    initial: NextActionView | null;
    pending: boolean;
    onCancel: () => void;
    onSave: ( edits: PlanEdits ) => void;
};

const SELECT_CLASS = "h-9 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

const optionLabel = ( c: PlanCandidateOption ) => {
    const path = c.path.length ? `${c.path.join( " › " )} › ` : "";
    const extra = [ c.isLoop ? `繰り返し ${c.repetitionsCompleted}/${c.repetitionsRequired}` : null, formatEstimate( c.estimateMinutes ) ].filter( Boolean ).join( "・" );
    return `${path}${c.name}${extra ? `（${extra}）` : ""}`;
};

/** The user's own plan: a main task, an optional loop practice and the day. */
const NextActionEditor = ( { state, initial, pending, onCancel, onSave }: Props ) => {

    const { candidates, todayKey, nextWorkDay, goalKey } = state;
    const isCandidate = ( id: string | null | undefined ) => !!id && candidates.some( c => c.id === id );

    const initialProgress = initial?.items.find( i => i.role === "progress" )?.nodeId;
    const initialPractice = initial?.items.find( i => i.role === "practice" )?.nodeId;

    const [ progressId, setProgressId ] = useState( isCandidate( initialProgress ) ? initialProgress! : candidates.find( c => !c.isLoop )?.id ?? candidates[0]?.id ?? "" );
    const [ practiceId, setPracticeId ] = useState( isCandidate( initialPractice ) ? initialPractice! : "" );
    const initialDay = initial && initial.scheduledFor >= todayKey ? initial.scheduledFor : todayKey;
    const [ day, setDay ] = useState( initialDay );

    const loops = candidates.filter( c => c.isLoop && c.id !== progressId );
    const maxDay = goalKey && goalKey >= todayKey ? goalKey : undefined;

    if( candidates.length === 0 ) {
        return (
            <div className="flex flex-col gap-3">
                <p className="text-sm text-muted-foreground">今始められるタスクがありません。</p>
                <Button variant="secondary" onClick={onCancel}>戻る</Button>
            </div>
        );
    }

    return (
        <form
            className="flex flex-col gap-3"
            onSubmit={e => {
                e.preventDefault();
                if( !progressId ) return;
                onSave( { progressNodeId: progressId, practiceNodeId: practiceId || null, scheduledFor: day } );
            }}>

            <div className="flex flex-col gap-1.5">
                <Label htmlFor="na-progress">進捗タスク</Label>
                <select id="na-progress" className={SELECT_CLASS} value={progressId} onChange={e => { setProgressId( e.target.value ); if( e.target.value === practiceId ) setPracticeId( "" ); }}>
                    { candidates.map( c => <option key={c.id} value={c.id}>{ optionLabel( c ) }</option> ) }
                </select>
            </div>

            <div className="flex flex-col gap-1.5">
                <Label htmlFor="na-practice">練習タスク（任意・繰り返しタスク）</Label>
                <select id="na-practice" className={SELECT_CLASS} value={practiceId} onChange={e => setPracticeId( e.target.value )} disabled={loops.length === 0}>
                    <option value="">{ loops.length === 0 ? "始められる繰り返しタスクはありません" : "なし" }</option>
                    { loops.map( c => <option key={c.id} value={c.id}>{ optionLabel( c ) }</option> ) }
                </select>
            </div>

            <div className="flex flex-col gap-1.5">
                <Label htmlFor="na-day">いつやる？</Label>
                <div className="flex flex-wrap items-center gap-2">
                    <Button type="button" size="sm" variant={day === todayKey ? "default" : "outline"} onClick={() => setDay( todayKey )}>今日</Button>
                    { nextWorkDay && (
                        <Button type="button" size="sm" variant={day === nextWorkDay ? "default" : "outline"} onClick={() => setDay( nextWorkDay )}>
                            次の作業日（{ dayLabel( nextWorkDay, todayKey ) }）
                        </Button>
                    ) }
                    <input id="na-day" type="date" className={`${SELECT_CLASS} w-auto`} value={day} min={todayKey} max={maxDay} onChange={e => e.target.value && setDay( e.target.value )}/>
                </div>
            </div>

            <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>戻る</Button>
                <Button type="submit" disabled={pending || !progressId}>この予定で保存</Button>
            </div>

        </form>
    );

};

export default NextActionEditor;
