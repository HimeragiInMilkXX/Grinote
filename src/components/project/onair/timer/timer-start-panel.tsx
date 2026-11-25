"use client"

import { startTask } from "@/app/project/[projectId]/onair/serverActions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import type { TimerChoice } from "@/lib/timer/types";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import TimerPicker, { loadLastTimerChoice, saveLastTimerChoice } from "./timer-picker";
import { requestTimerNotificationPermission } from "./timer-notify";

interface Props {
    projectId: string;
    nodeId: string;
    taskName: string;
}

/** Step between the tree's スタート and the on-air timer: pick a timer, then start. */
const TimerStartPanel = ( { projectId, nodeId, taskName }: Props ) => {

    const [ choice, setChoice ] = useState<TimerChoice>( { mode: "pomodoro" } );
    const [ busy, setBusy ] = useState( false );

    useEffect( () => {
        const last = loadLastTimerChoice();
        if( last ) setChoice( last );
    }, [] );

    const start = async () => {
        setBusy( true );
        saveLastTimerChoice( choice );
        requestTimerNotificationPermission();
        const res = await startTask( nodeId, projectId, choice ).catch( e => {
            // redirect() is thrown on success
            if( e && typeof e === "object" && "digest" in e && String( ( e as { digest: unknown } ).digest ).startsWith( "NEXT_REDIRECT" ) ) throw e;
            return { ok: false as const, message: "タスクを開始できませんでした" };
        } );
        if( res && !res.ok ) {
            toast.error( res.message );
            setBusy( false );
        }
    };

    return (
        <Card className="w-full max-w-2xl">
            <CardHeader>
                <CardTitle className="text-2xl">タイマーを選ぶ</CardTitle>
                <CardDescription>「{taskName}」をどのリズムで進めますか？</CardDescription>
            </CardHeader>
            <CardContent>
                <TimerPicker value={choice} onChange={setChoice}/>
            </CardContent>
            <CardFooter className="flex justify-between gap-2">
                <Button variant="outline" render={<Link href={`/project/${projectId}/tree?isInitialEditMode=false`}/>} nativeButton={false}>ツリーに戻る</Button>
                <Button onClick={start} disabled={busy}>{ busy ? "開始中…" : "このタイマーで開始" }</Button>
            </CardFooter>
        </Card>
    );

};

export default TimerStartPanel;
