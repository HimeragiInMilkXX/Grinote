"use client"

import { deleteProject, resetProjectProgress } from "@/app/project/[projectId]/settings/serverActions";
import { projectSettingsDirtyAtom } from "@/atoms/project_settings_atoms";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useSetAtom } from "jotai";
import { RotateCcw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

type Props = {

    projectId: string;
    projectName: string;
    hasActiveTask: boolean;

}

const ProjectDangerZone = ( { projectId, projectName, hasActiveTask }: Props ) => {

    const router = useRouter();
    const setSettingsDirty = useSetAtom( projectSettingsDirtyAtom );

    const [ open, setOpen ] = useState<"reset" | "delete" | null>( null );
    const [ busy, setBusy ] = useState( false );
    const [ confirmName, setConfirmName ] = useState( "" );

    const close = () => { if( busy ) return; setOpen( null ); setConfirmName( "" ); }

    const onReset = async () => {

        setBusy( true );

        try {

            const result = await resetProjectProgress( projectId );

            if( !result.ok ) { toast.error( result.message, { position: "top-left" } ); return; }

            toast.success( "進捗をリセットしました", { position: "top-left" } );
            setOpen( null );
            router.refresh();

        } catch( e ) {

            toast.error( String( e ), { position: "top-left" } );

        } finally {

            setBusy( false );

        }

    }

    const onDelete = async () => {

        setBusy( true );

        try {

            const result = await deleteProject( projectId, confirmName );

            if( !result.ok ) { toast.error( result.message, { position: "top-left" } ); setBusy( false ); return; }

            toast.success( `「${projectName}」を削除しました`, { position: "top-left" } );
            // nothing left to save, so leave without the unsaved-changes prompt
            setSettingsDirty( false );
            router.replace( "/dashboard" );

        } catch( e ) {

            toast.error( String( e ), { position: "top-left" } );
            setBusy( false );

        }

    }

    return (

        <Card className="w-full ring-destructive/30">

            <CardHeader>
                <CardTitle className="text-lg text-destructive"> 危険な操作 </CardTitle>
                <CardDescription> { hasActiveTask ? "タスク実行中はリセット・削除できません。" : "これらの操作は元に戻せません。" } </CardDescription>
            </CardHeader>

            <CardContent className="flex flex-col gap-4">

                <div className="flex items-center justify-between gap-4">
                    <div className="text-sm">
                        <p className="font-medium"> 進捗をリセット </p>
                        <p className="text-muted-foreground"> 目標ツリーと記録を消して、キャラクターをLv.1に戻します。 </p>
                    </div>
                    <Button variant="destructive" disabled={hasActiveTask} onClick={() => setOpen( "reset" )}> <RotateCcw/> リセット </Button>
                </div>

                <div className="flex items-center justify-between gap-4">
                    <div className="text-sm">
                        <p className="font-medium"> プロジェクトを削除 </p>
                        <p className="text-muted-foreground"> プロジェクトとすべてのデータを完全に削除します。 </p>
                    </div>
                    <Button variant="destructive" disabled={hasActiveTask} onClick={() => setOpen( "delete" )}> <Trash2/> 削除 </Button>
                </div>

            </CardContent>

            <Dialog open={open === "reset"} onOpenChange={ o => { if( !o ) close() } }>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle> 進捗をリセットしますか？ </DialogTitle>
                        <DialogDescription> 次のデータが削除されます。元に戻すことはできません。 </DialogDescription>
                    </DialogHeader>
                    <ul className="list-disc pl-5 text-sm flex flex-col gap-1">
                        <li> 最終目標以外のすべてのタスク（目標ツリー） </li>
                        <li> ライブタスクの記録 </li>
                        <li> 獲得したアイテム </li>
                        <li> キャラクターのレベル・XP（Lv.1に戻ります）と連続日数 </li>
                    </ul>
                    <p className="text-sm text-muted-foreground"> プロジェクトの設定・キャラクター・マテリアルはそのまま残ります（タスクとの紐付けは外れます）。 </p>
                    <DialogFooter>
                        <Button variant="outline" onClick={close} disabled={busy}> キャンセル </Button>
                        <Button variant="destructive" onClick={onReset} disabled={busy}> { busy ? "リセット中..." : "リセットする" } </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={open === "delete"} onOpenChange={ o => { if( !o ) close() } }>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle> プロジェクトを削除しますか？ </DialogTitle>
                        <DialogDescription> 目標ツリー、記録、マテリアル（アップロードしたファイルを含む）、キャラクターがすべて削除されます。元に戻すことはできません。 </DialogDescription>
                    </DialogHeader>
                    <Field>
                        <FieldLabel htmlFor="settings-delete-confirm"> 確認のため、プロジェクト名「{ projectName }」を入力してください </FieldLabel>
                        <Input id="settings-delete-confirm" value={confirmName} onChange={e => setConfirmName( e.target.value )} autoComplete="off" disabled={busy}/>
                    </Field>
                    <DialogFooter>
                        <Button variant="outline" onClick={close} disabled={busy}> キャンセル </Button>
                        <Button variant="destructive" onClick={onDelete} disabled={busy || confirmName.trim() !== projectName.trim()}> { busy ? "削除中..." : "削除する" } </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </Card>

    )

}

export default ProjectDangerZone
