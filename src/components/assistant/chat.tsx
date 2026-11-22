"use client"

import { ChatMessage } from "@/components/assistant/chat-message"
import { PromptForm } from "@/components/assistant/prompt-form"
import { QuestionCard } from "@/components/assistant/question-card"
import { StatusIcon } from "@/components/assistant/status-icon"
import { Suggestions } from "@/components/assistant/suggestions"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import { Message, MessageContent } from "@/components/ui/message"
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller"
import { Trace, TraceIcon, TraceLine, TraceTitle } from "@/components/ui/trace"
import { useChatContext } from "@/providers/chat-provider"
import { ProposalQuestionCard } from "./proposal-question-card"
import { useAtom, useSetAtom } from "jotai"
import { graphEditRequestAtom } from "@/atoms/graph_edit_request_atom"
import { graphEditReviewedProposalAtom } from "@/atoms/graph_edit_reviewed_proposal_atom"
import { redirect } from "next/navigation"

export function Chat({ project_id }: { project_id: string }) {

  const setGraphEditRequest = useSetAtom(graphEditRequestAtom);

  const { messages, sendMessage, regenerate, status, stop, error, addToolOutput, setModel, resolvedModel, isBusy, lastMessage, pendingQuestion, pendingProposal, models } = useChatContext();

  const [ reviewedIds, setReviewedIds ] = useAtom<string[]>( graphEditReviewedProposalAtom );

  const dismissProposal = (toolCallId: string) => {
    setReviewedIds((previous) =>
      previous.includes(toolCallId)
        ? previous
        : [...previous, toolCallId]
    );
  };

  return (
    <div className="mx-auto flex min-h-0 w-full flex-1 flex-col">
      <p className="p-6 self-end text-xs leading-tight text-gray-300 font-medium"> Grinoteアシスタント </p>
      {/* Default display when the chat is empty */}
      {messages.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-6">
          <Empty>
            <EmptyHeader>
              <EmptyTitle>What can I help with?</EmptyTitle>
              <EmptyDescription>
                Pick a model and start asking for advices. Learn how to break down your goals!
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Suggestions
                onSelect={(prompt) =>
                  sendMessage(
                    { text: prompt },
                    { body: { model: resolvedModel, project_id } }
                  )
                }
              />
            </EmptyContent>
          </Empty>
        </div>
      ) : (
        <MessageScrollerProvider>
          <MessageScroller className="flex-1">
            <MessageScrollerViewport>
              <MessageScrollerContent className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 py-6">
                {messages.map((message) => (
                  <MessageScrollerItem
                    key={message.id}
                    messageId={message.id}
                    scrollAnchor={message.role === "user"}
                  >
                    <ChatMessage
                      message={message}
                      isStreaming={isBusy && message.id === lastMessage?.id}
                      onRetry={
                        !isBusy && message.id === lastMessage?.id
                          ? () =>
                              regenerate({
                                messageId: message.id,
                                body: { model: resolvedModel, project_id },
                              })
                          : undefined
                      }
                    />
                  </MessageScrollerItem>
                ))}
                {status === "submitted" && (
                  <MessageScrollerItem messageId="thinking">
                    <Message>
                      <MessageContent>
                        <Trace>
                          <TraceLine status="running">
                            <TraceIcon>
                              <StatusIcon status="running" />
                            </TraceIcon>
                            <TraceTitle>Thinking</TraceTitle>
                          </TraceLine>
                        </Trace>
                      </MessageContent>
                    </Message>
                  </MessageScrollerItem>
                )}
              </MessageScrollerContent>
              {pendingQuestion && (
                <QuestionCard
                  part={pendingQuestion}
                  onAnswer={(toolCallId, answer) =>
                    addToolOutput({
                      tool: "ask_user",
                      toolCallId,
                      output: answer,
                      options: { body: { model: resolvedModel, project_id } },
                    })
                  }
                />
              )}

              {/* Review on Proposal */}
              {(!isBusy && pendingProposal && !reviewedIds.includes(pendingProposal.toolCallId)) && (
                <ProposalQuestionCard
                  part={pendingProposal}
                  key={pendingProposal.toolCallId}
                  onAccept={() => {
                    setGraphEditRequest({
                      project_id,
                      edges: pendingProposal.output?.graph.edges!,
                      nodes: pendingProposal.output?.graph.nodes!
                    })
                    dismissProposal(pendingProposal.toolCallId)
                    redirect(`/project/${project_id}/tree?isInitialEditMode=true`)
                  }}
                  onReject={() => dismissProposal(pendingProposal.toolCallId)}
                  onRequestChanges={request => {
                    sendMessage({ text: `Please revise the proposed goal tree. My requested changes: ${request}` }, { body: { model: resolvedModel, project_id } })
                    dismissProposal(pendingProposal.toolCallId)
                  }}
                />
              )}
            </MessageScrollerViewport>
            <MessageScrollerButton />
          </MessageScroller>
        </MessageScrollerProvider>
      )}

      <div className="mx-auto flex w-full max-w-2xl flex-col gap-2 px-6 pb-6">
        {error && (
          <Alert variant="destructive">
            <AlertTitle>Request failed</AlertTitle>
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        )}
        <PromptForm
          models={models}
          model={resolvedModel}
          onModelChange={setModel}
          isBusy={isBusy}
          onSubmit={(text) =>
            sendMessage({ text }, { body: { model: resolvedModel, project_id } })
          }
          onStop={() => stop()}
        />
      </div>
    </div>
  )
}
