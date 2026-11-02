"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import StepLine from "./step-line";
import { useEffect, useState } from "react";
import FloatingCollapsible from "@/components/miscellaneous/floating-collapsible";
import { Button } from "@/components/ui/button";
import { GraduationCap, Minimize2 } from "lucide-react";
import { CollapsibleTrigger } from "@/components/ui/collapsible";
import { atom, useSetAtom } from "jotai";

export const currentStepAtom = atom(0);

export default function ProjectTutorialPanel( { className = "", project_id, tutorial_progress }: { className?: string, project_id: string, tutorial_progress: [ boolean, boolean, boolean, boolean, boolean ] }) {

    const setCurrentStep = useSetAtom(currentStepAtom);

    const [ isComplete, setIsComplete ] = useState(true);

    useEffect( () => {

        for( const [ index, value ] of tutorial_progress.entries() ) {

            if( !value ) {

                setCurrentStep( index );
                setIsComplete(false)
                return;

            }

        }

        setIsComplete(true);

    }, [])

    return (

        !isComplete &&

            ( <FloatingCollapsible hideTriggerOnOpen initOpen={!isComplete}

                trigger={

                    <Button variant="default" size="icon" aria-label="Expand" className="absolute right-0 top-0 m-6 bg-green-400 shadow hover:bg-green-500 cursor-pointer">
                        <GraduationCap className="h-4 w-4" size={24} />
                    </Button>

                }

                content={

                    <Card className={`${className} max-w-none!`}>

                        <CollapsibleTrigger render={
                            <Button variant="ghost" size="icon" aria-label="Expand" className="bg-transparent! hover:bg-gray-100! absolute right-0 top-0">
                                <Minimize2 className="h-4 w-4" />
                            </Button>
                        }/>

                        <CardHeader>
                            <CardTitle> 始めましょう！ </CardTitle>
                            <CardDescription> 初めてのGrinote？ステップに沿ってとりあえずやってみましょう（報酬あり） </CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-2">

                            <StepLine
                                step="目標ツリーを確認・編集する"
                                destination={`/project/${project_id}/tree?isInitialEditMode=true`}
                                stepIndex={0}
                            />

                            <StepLine
                                step="ツリーを保存する"
                                destination={`/project/${project_id}/tree?isInitialEditMode=true`}
                                stepIndex={1}
                            />

                            <StepLine
                                step="タスクを1つ開始する"
                                destination={`/project/${project_id}/tree?isInitialEditMode=false`}
                                stepIndex={2}
                            />

                            <StepLine
                                step="タスクを完了する"
                                destination={`/project/${project_id}/onair`}
                                stepIndex={3}
                            />

                            <StepLine
                                step="進捗を確認する"
                                destination={`/project/${project_id}/character`}
                                stepIndex={4}
                            />

                        </CardContent>
                    </Card>

                }

            />

        )

    )

}
