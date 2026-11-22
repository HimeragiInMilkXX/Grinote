"use client"

import { useSetAtom } from "jotai";
import { toast } from "sonner";
import { updateTutorialProgress } from "@/app/project/[projectId]/serverActions";
import { currentStepAtom } from "@/components/tutorial/project/project-tutorial-panel";

/** Toasts shown the first time each onboarding step is completed, by step index. */
const TUTORIAL_STEP_MESSAGES: string[][] = [
    [ "「目標ツリーを確認・編集する」達成！次はそれを保存しよう！" ],
    [ "「ツリーを保存する」達成！次はタスク一つ開始しよう！" ],
    [ "「タスクを1つ開始する」達成！次はそれを完成しよう！" ],
    [ "「タスクを完了する」達成！次はキャラを確認しよう！" ],
    [ "「進捗を確認する」達成！", "オンボーディング完了！リソース報酬どーぞ" ],
]

/**
 * Returns `completeTutorialStep(index)`, which marks an onboarding step as done,
 * shows its toast and advances the tutorial panel. Resolves to whether the step was newly completed.
 */
export function useTutorialStep( project_id: string ) {

    const setCurrentStep = useSetAtom( currentStepAtom );

    return async function completeTutorialStep( index: number ): Promise<boolean> {

        const updated = await updateTutorialProgress( project_id, index );

        if( !updated ) return false;

        TUTORIAL_STEP_MESSAGES[index]?.forEach( message => toast.success( message, { position: "top-left" } ) );
        setCurrentStep( prev => prev + 1 );

        return true;

    }

}
