"use client"

import { type ProposeGoalTreeToolPart } from "@/tools"
import {
  Questionnaire,
  QuestionnaireActions,
  QuestionnaireChoice,
  QuestionnaireChoices,
  QuestionnaireDescription,
  QuestionnaireError,
  QuestionnaireInput,
  QuestionnaireItem,
  QuestionnaireSubmit,
  QuestionnaireTitle,
} from "@/components/ui/questionnaire"
import { Checkbox } from "@/components/ui/checkbox"
import { DiffCountBadges } from "@/components/flow/generated/change-format"
import { countOps, withoutOpsFor } from "@/lib/tree/tree-changes"
import { useRef, useState } from "react"

const ACTION_LABELS: Record<string, string> = {
  update: "内容の変更",
  move: "移動",
  delete: "削除",
  "add child": "子タスクの追加",
  "remove child": "子タスクの移動",
}

export function ProposalQuestionCard({
  part, onAccept, onReject, onRequestChanges
}: {
  part: ProposeGoalTreeToolPart
  /** Receives the ids of protected (progressed loop) nodes the user allowed. */
  onAccept: ( allowedProtectedIds: string[] ) => void,
  onReject: () => void,
  onRequestChanges: ( request: string ) => void,
}) {

  const output = part.state === "output-available" ? part.output : undefined
  const protectedNodes = output?.protectedNodes ?? []
  const warnings = output?.warnings ?? []

  const [ allowedIds, setAllowedIds ] = useState<string[]>([])
  const [ notice, setNotice ] = useState<string | null>(null)

  const deniedIds = protectedNodes.map( p => p.id ).filter( id => !allowedIds.includes( id ) )
  const remainingOps = output?.ops ? countOps( withoutOpsFor( output.ops, deniedIds ) ) : 0

  const items = [
    {
      name: "review",
      required: true,
      prompt: "この変更案でよろしいですか？",
      description: "承認するとツリー編集画面で最終確認できます。保存するまで反映されません。",
      choices: [
        {
          value: "accept",
          label: "承認して適用",
          description: "変更をツリーに適用して確認する",
        },
        {
          value: "reject",
          label: "却下",
          description: "変更を破棄する",
        },
      ],
      input: { label: "修正を依頼", placeholder: "修正してほしい内容を入力..." },
    },
  ]

  const questionnaireInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="sticky bottom-2 isolate z-50 mx-auto w-full max-w-2xl px-6 pt-2">
      <div className="w-full rounded-3xl bg-popover p-4 text-sm text-popover-foreground shadow-lg ring-1 ring-foreground/5 dark:ring-foreground/10">

          { output?.diff && (
            <div className="mb-3 flex flex-wrap items-center gap-2 px-1">
              <span className="text-xs font-medium">変更内容</span>
              <DiffCountBadges diff={output.diff}/>
            </div>
          ) }

          { protectedNodes.length > 0 && (
            <div className="mb-3 flex flex-col gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-amber-900">
              <p className="text-xs font-medium">進捗のある繰り返しタスクが含まれています。許可したものだけ変更されます。</p>
              { protectedNodes.map( p => (
                <label key={p.id} className="flex cursor-pointer items-start gap-2 text-xs">
                  <Checkbox
                    className="mt-0.5"
                    checked={allowedIds.includes( p.id )}
                    onCheckedChange={checked => setAllowedIds( prev => checked ? [ ...prev, p.id ] : prev.filter( id => id !== p.id ) )}
                  />
                  <span>
                    「{p.task_name}」（{p.repetitions_completed}/{p.repetitions_required} 回完了）の
                    { p.actions.map( a => ACTION_LABELS[a] ?? a ).join( "・" ) }を許可
                  </span>
                </label>
              ) ) }
            </div>
          ) }

          { warnings.length > 0 && (
            <ul className="mb-3 list-disc rounded-xl bg-red-50 py-2 pr-3 pl-7 text-xs text-red-800">
              { warnings.map( w => <li key={w}>{w}</li> ) }
            </ul>
          ) }

          { notice && <p className="mb-2 px-1 text-xs text-red-600">{notice}</p> }

          <Questionnaire
            defaultItem="review"
            items={items}
            onSubmit={(event) => {

              event.preventDefault()

              if( !questionnaireInputRef.current ) return;

              const formData = new FormData(event.currentTarget);
              const answer = String(formData.get("review") ?? "").trim();

              if( answer === "accept" ) {
                if( remainingOps === 0 ) {
                  setNotice( "許可されていない変更を除くと、適用できる変更がありません。許可するか、修正を依頼してください。" )
                  return
                }
                onAccept( allowedIds );
              } else if( answer === "reject") {
                if( questionnaireInputRef.current?.value.trim().length > 0 )
                  onRequestChanges( questionnaireInputRef.current?.value );
                else
                  onReject()
              } else {
                onRequestChanges( answer )
              }

            }}
          >
            {items.map((question) => (
                <QuestionnaireItem
                  key={question.name}
                  name={question.name}
                  required={question.required}
                >
                  <QuestionnaireTitle>{question.prompt}</QuestionnaireTitle>
                  <QuestionnaireDescription>
                    {question.description}
                  </QuestionnaireDescription>
                  <QuestionnaireChoices>
                    {question.choices.map((choice) => (
                      <QuestionnaireChoice key={choice.value} value={choice.value}>
                        <span className="font-medium">{choice.label}</span>
                        {"description" in choice ? (
                          <span className="text-muted-foreground">
                            {choice.description}
                          </span>
                        ) : null}
                      </QuestionnaireChoice>
                    ))}
                    {"input" in question ? (
                      <QuestionnaireInput
                        aria-label={question.input.label}
                        placeholder={question.input.placeholder}
                        ref={questionnaireInputRef}
                      />
                    ) : null}
                  </QuestionnaireChoices>
                  <QuestionnaireError />
                </QuestionnaireItem>
              ))}
              <QuestionnaireActions>
                <QuestionnaireSubmit />
              </QuestionnaireActions>
          </Questionnaire>
      </div>
    </div>
  )
}
