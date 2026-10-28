"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import StepLine from "./step-line";
import { useEffect, useState } from "react";
import FloatingCollapsible from "@/components/miscellaneous/floating-collapsible";
import { Button } from "@/components/ui/button";
import { GraduationCap, Minimize2 } from "lucide-react";
import { CollapsibleTrigger } from "@/components/ui/collapsible";

export default function ProjectTutorialPanel( { className = "", project_id, tutorial_progress }: { className?: string, project_id: string, tutorial_progress: [ boolean, boolean, boolean, boolean, boolean ] }) {

    const [ currentStep, setCurrentStep ] = useState(0);

    useEffect( () => {

        for( const [ index, value ] of tutorial_progress.entries() ) {

            if( !value ) {

                setCurrentStep( index );
                break;

            }

        }

    }, [ tutorial_progress ])

    return (

        <FloatingCollapsible hideTriggerOnOpen

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
                            isCompleted={tutorial_progress[0]}
                            destination={`/project/${project_id}/tree/edit`}
                            isAvailable={0 <= currentStep}
                        />

                        <StepLine
                            step="ツリーを保存する"
                            isCompleted={tutorial_progress[1]}
                            destination={`/project/${project_id}/tree/edit`}
                            isAvailable={1 <= currentStep}
                        />

                        <StepLine
                            step="タスクを1つ開始する"
                            isCompleted={tutorial_progress[2]}
                            destination={`/project/${project_id}/tree/pick`}
                            isAvailable={2 <= currentStep}
                        />

                        <StepLine
                            step="タスクを完了する"
                            isCompleted={tutorial_progress[3]}
                            destination={`/project/${project_id}/onair`}
                            isAvailable={3 <= currentStep}
                        />

                        <StepLine
                            step="進捗を確認する"
                            isCompleted={tutorial_progress[4]}
                            destination={`/project/${project_id}/character`}
                            isAvailable={4 <= currentStep}
                        />
                        
                    </CardContent>
                </Card>

            }

        />

    )

}
