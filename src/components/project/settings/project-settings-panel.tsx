"use client"

import { updateProjectSettings } from "@/app/project/[projectId]/settings/serverActions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldSeparator } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { buildSettingsPatch, canRenameCharacter, CHARACTER_NAME_MAX, DAILY_GOAL_MAX_HOURS, projectToSettingsInput, type ProjectSettingsInput } from "@/lib/projects/settings";
import { WEEKDAYS } from "@/lib/projects/work-days";
import { format } from "date-fns";
import { Lock, Pencil, RadioTower } from "lucide-react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Controller, useForm, type FieldErrors, type Resolver } from "react-hook-form";
import { toast } from "sonner";
import { useUnsavedSettings } from "./use-unsaved-settings";
import ProjectColorPicker from "@/components/project/project-color-picker";

const DurationPicker = dynamic( () => import( "react-duration-picker" ), {
    ssr: false,
    loading: () => <div className="text-sm text-muted-foreground">Loading…</div>,
});

type Props = {

    project: Project;
    hasActiveTask: boolean;

}

const formatDuration = ( { hours, minutes, seconds }: ProjectSettingsInput["daily_time_goal"] ) =>
    [ hours > 0 && `${hours}時間`, minutes > 0 && `${minutes}分`, seconds > 0 && `${seconds}秒` ].filter( Boolean ).join( "" ) || "未設定";

const LockedNote = () => (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Lock size={12}/> 変更不可</span>
)

const ProjectSettingsPanel = ( { project, hasActiveTask }: Props ) => {

    const router = useRouter();

    const saved = useMemo( () => projectToSettingsInput( project ), [ project ] );
    const canRename = canRenameCharacter( project );

    const [ editing, setEditing ] = useState( false );
    const [ saving, setSaving ] = useState( false );
    // The duration picker only reads its initial value and re-aligns whenever it changes, so it gets a
    // snapshot taken when editing starts (never the live field value) and is remounted via the key.
    const [ pickerKey, setPickerKey ] = useState( 0 );
    const [ pickerInitial, setPickerInitial ] = useState( saved.daily_time_goal );
    const [ pendingRename, setPendingRename ] = useState<ProjectSettingsInput | null>( null );

    // Same rules as the server action (buildSettingsPatch), checked against the saved row.
    const resolver: Resolver<ProjectSettingsInput> = async ( values ) => {

        const result = buildSettingsPatch( project, values );

        if( result.ok ) return { values, errors: {} };

        const errors: FieldErrors<ProjectSettingsInput> = {};
        for( const [ field, message ] of Object.entries( result.errors ) )
            errors[ field as keyof ProjectSettingsInput ] = { type: "validate", message };

        return { values: {}, errors };

    };

    const form = useForm<ProjectSettingsInput>( { resolver, defaultValues: saved } );

    // a fresh row after saving / router.refresh()
    useEffect( () => {

        if( editing ) return;
        form.reset( saved );
        setPickerInitial( saved.daily_time_goal );
        setPickerKey( k => k + 1 );

    }, [ saved ] ); // eslint-disable-line react-hooks/exhaustive-deps

    const dirty = editing && form.formState.isDirty;
    useUnsavedSettings( dirty );

    const locked = !editing || saving;

    const startEditing = () => {

        if( hasActiveTask ) return;
        form.reset( saved );
        setPickerInitial( saved.daily_time_goal );
        setPickerKey( k => k + 1 );
        setEditing( true );

    }

    const cancelEditing = () => {

        if( form.formState.isDirty && !window.confirm( "保存されていない変更を破棄しますか？" ) ) return;
        form.reset( saved );
        setPickerKey( k => k + 1 );
        setEditing( false );

    }

    const save = async ( values: ProjectSettingsInput ) => {

        setSaving( true );

        try {

            const result = await updateProjectSettings( project.id, values );

            if( !result.ok ) {

                for( const [ field, message ] of Object.entries( result.errors ?? {} ) )
                    form.setError( field as keyof ProjectSettingsInput, { type: "server", message } );

                toast.error( result.message, { position: "top-left" } );
                return;

            }

            toast.success( result.changed.length > 0 ? "設定を保存しました！" : "変更はありませんでした", { position: "top-left" } );

            form.reset( values );
            setEditing( false );
            router.refresh();

        } catch( e ) {

            toast.error( String( e ), { position: "top-left" } );

        } finally {

            setSaving( false );

        }

    }

    const onSubmit = form.handleSubmit( values => {

        if( canRename && values.character_given_name.trim() !== saved.character_given_name ) {

            setPendingRename( values );
            return;

        }

        return save( values );

    });

    const characterName = project.characters?.name;

    return (

        <Card className="w-full">

            <CardHeader>
                <CardTitle className="text-lg"> プロジェクト設定 </CardTitle>
                <CardDescription> 「編集」を押すと変更できます。変更は保存するまで反映されません。 </CardDescription>
            </CardHeader>

            <CardContent className="flex flex-col gap-6">

                { hasActiveTask && (
                    <Alert>
                        <RadioTower/>
                        <AlertTitle> タスク実行中 </AlertTitle>
                        <AlertDescription> タスク実行中（レポート未提出を含む）は設定を変更できません。ライブタスクを完了してレポートを確定するか、中止してから変更してください。 </AlertDescription>
                    </Alert>
                )}

                {/* Locked details */}
                <FieldGroup>

                    <Field>
                        <FieldLabel htmlFor="settings-final-goal" className="justify-between"> 最終目標 <LockedNote/> </FieldLabel>
                        <Textarea id="settings-final-goal" value={project.final_goal} disabled readOnly className="max-h-[14vh]"/>
                    </Field>

                    <div className="flex gap-4 items-center">

                        { characterName && (
                            <Image src={`/character/thumbnail/${encodeURIComponent( characterName )}.png`} width={72} height={72} className="aspect-square object-cover rounded-lg bg-muted" alt={characterName}/>
                        )}

                        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm flex-1">
                            <span className="text-muted-foreground">キャラクター</span><span>{ characterName ?? "-" }</span>
                            <span className="text-muted-foreground">レベル / XP</span><span>Lv.{ project.character_level } / { project.character_xp } XP</span>
                            <span className="text-muted-foreground">連続日数</span><span>{ project.streak } 日</span>
                            <span className="text-muted-foreground">作成日</span><span>{ format( new Date( project.created_at ), "yyyy/MM/dd" ) }</span>
                        </div>

                        <LockedNote/>

                    </div>

                </FieldGroup>

                <FieldSeparator/>

                {/* Editable settings */}
                <form id="project-settings-form" onSubmit={onSubmit}>
                    <FieldGroup>

                        <Controller
                            name="name"
                            control={form.control}
                            render={ ( { field, fieldState } ) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor="settings-name"> プロジェクト名 </FieldLabel>
                                    <Input { ...field } id="settings-name" disabled={locked} aria-invalid={fieldState.invalid} autoComplete="off"/>
                                    { fieldState.invalid && <FieldError errors={[ fieldState.error ]}/> }
                                </Field>
                            )}
                        />

                        <Controller
                            name="character_given_name"
                            control={form.control}
                            render={ ( { field, fieldState } ) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor="settings-character-name" className="justify-between">
                                        キャラクターネーム
                                        { !canRename && <LockedNote/> }
                                    </FieldLabel>
                                    <Input { ...field } id="settings-character-name" maxLength={CHARACTER_NAME_MAX} disabled={locked || !canRename} aria-invalid={fieldState.invalid} autoComplete="off"/>
                                    <FieldDescription>
                                        { canRename ? "＊キャラクターネームは1回だけ変更できます" : "＊キャラクターネームは変更済みのため、これ以上変更できません" }
                                    </FieldDescription>
                                    { fieldState.invalid && <FieldError errors={[ fieldState.error ]}/> }
                                </Field>
                            )}
                        />

                        <Controller
                            name="description"
                            control={form.control}
                            render={ ( { field, fieldState } ) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor="settings-description"> 説明 </FieldLabel>
                                    <Textarea { ...field } id="settings-description" className="max-h-[16vh]" disabled={locked} aria-invalid={fieldState.invalid} autoComplete="off"/>
                                    { fieldState.invalid && <FieldError errors={[ fieldState.error ]}/> }
                                </Field>
                            )}
                        />

                        <Controller
                            name="achieve_date_goal"
                            control={form.control}
                            render={ ( { field, fieldState } ) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor="settings-achieve-date"> 達成日時 </FieldLabel>
                                    <Input { ...field } type="date" id="settings-achieve-date" disabled={locked} aria-invalid={fieldState.invalid}/>
                                    { editing && <FieldDescription> ＊変更する場合は今日以降の日付を選んでください </FieldDescription> }
                                    { fieldState.invalid && <FieldError errors={[ fieldState.error ]}/> }
                                </Field>
                            )}
                        />

                        <Controller
                            name="daily_time_goal"
                            control={form.control}
                            render={ ( { field, fieldState } ) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor="settings-daily-goal"> 目標時間（毎日） </FieldLabel>
                                    { locked ? (
                                        <Input id="settings-daily-goal" value={formatDuration( field.value )} disabled readOnly/>
                                    ) : (
                                        <DurationPicker
                                            key={pickerKey}
                                            onChange={field.onChange}
                                            initialDuration={pickerInitial}
                                            maxHours={DAILY_GOAL_MAX_HOURS}
                                        />
                                    )}
                                    { fieldState.invalid && <FieldError errors={[ fieldState.error ]}/> }
                                </Field>
                            )}
                        />

                        <Controller
                            name="work_days"
                            control={form.control}
                            render={ ( { field, fieldState } ) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel> 週間目標（曜日） </FieldLabel>
                                    <div className="flex flex-wrap gap-4">
                                        { WEEKDAYS.map( day => (
                                            <label key={day.value} htmlFor={`settings-work-day-${day.value}`} className="flex items-center gap-2 cursor-pointer has-disabled:cursor-default">
                                                <Checkbox
                                                    id={`settings-work-day-${day.value}`}
                                                    disabled={locked}
                                                    checked={ field.value?.includes( day.value ) }
                                                    onCheckedChange={ checked => {
                                                        const current = field.value ?? [];
                                                        field.onChange( checked ? [ ...current, day.value ] : current.filter( v => v !== day.value ) );
                                                    }}
                                                />
                                                <span className="text-sm"> { day.label } </span>
                                            </label>
                                        ))}
                                    </div>
                                    { fieldState.invalid && <FieldError errors={[ fieldState.error ]}/> }
                                </Field>
                            )}
                        />

                        <Controller
                            name="color"
                            control={form.control}
                            render={ ( { field, fieldState } ) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel id="settings-color-label"> カラー </FieldLabel>
                                    <ProjectColorPicker value={field.value} onChange={field.onChange} disabled={locked} aria-labelledby="settings-color-label" aria-invalid={fieldState.invalid}/>
                                    { editing && <FieldDescription> ＊カレンダーやプロジェクト一覧で使われる色です </FieldDescription> }
                                    { fieldState.invalid && <FieldError errors={[ fieldState.error ]}/> }
                                </Field>
                            )}
                        />

                    </FieldGroup>
                </form>

            </CardContent>

            <CardFooter className="flex justify-end gap-2">

                { editing ? (
                    <>
                        { dirty && <span className="mr-auto text-xs text-red-600"> 保存されていない変更があります </span> }
                        <Button variant="outline" onClick={cancelEditing} disabled={saving}> キャンセル </Button>
                        <Button type="submit" form="project-settings-form" disabled={saving || !form.formState.isDirty}> { saving ? "保存中..." : "保存" } </Button>
                    </>
                ) : (
                    <Button onClick={startEditing} disabled={hasActiveTask}> <Pencil/> 編集 </Button>
                )}

            </CardFooter>

            <Dialog open={pendingRename != null} onOpenChange={ open => { if( !open ) setPendingRename( null ) } }>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle> キャラクターネームを変更しますか？ </DialogTitle>
                        <DialogDescription>
                            「{ saved.character_given_name }」→「{ pendingRename?.character_given_name.trim() }」に変更します。キャラクターネームは1回しか変更できないため、この後は変更できません。
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setPendingRename( null )}> 戻る </Button>
                        <Button onClick={() => { const values = pendingRename; setPendingRename( null ); if( values ) save( values ); }}> 変更して保存 </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </Card>

    )

}

export default ProjectSettingsPanel
