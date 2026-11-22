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
import { useRef } from "react"

export function ProposalQuestionCard({
  key, part, onAccept, onReject, onRequestChanges
}: {
  key: string,
  part: ProposeGoalTreeToolPart
  onAccept: () => void,
  onReject: () => void,
  onRequestChanges: ( request: string ) => void,
}) {
  const items = [
    {
      name: "review",
      required: true,
      prompt: "Does this breakdown look right",
      description: "Review the recommended changes",
      choices: [
        {
          value: "accept",
          label: "Accept and Insert",
          description: "Accept the changes and insert into graph",
        },
        {
          value: "reject",
          label: "Reject changes",
          description: "Reject the changes and cancel operation",
        },
      ],
      input: { label: "Request Changes", placeholder: "Type your request..." },
    },
  ]

  const questionnaireInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="sticky bottom-2 isolate z-50 mx-auto w-full max-w-2xl px-6 pt-2">
      <div className="w-full rounded-3xl bg-popover p-4 text-sm text-popover-foreground shadow-lg ring-1 ring-foreground/5 dark:ring-foreground/10">
          <Questionnaire
            defaultItem="review"
            items={items}
            onSubmit={(event) => {

              event.preventDefault()

              if( !questionnaireInputRef.current ) return;

              const formData = new FormData(event.currentTarget);
              const answer = String(formData.get("review") ?? "").trim();

              
              if( answer === "accept" ) {
                onAccept();
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
