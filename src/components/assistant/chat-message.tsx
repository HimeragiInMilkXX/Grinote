"use client"

import {
  type ChatMessagePart,
  type ChatUIMessage,
  type TextMessagePart,
} from "@/tools"
import { MessageActions } from "@/components/assistant/message-actions"
import { AskUserPart } from "@/components/assistant/parts/ask-user-part"
import { GithubRepoPart } from "@/components/assistant/parts/github-repo-part"
import { ReasoningPart } from "@/components/assistant/parts/reasoning-part"
import { SourcesPart } from "@/components/assistant/parts/sources-part"
import { TextPart } from "@/components/assistant/parts/text-part"
import { WebSearchPart } from "@/components/assistant/parts/web-search-part"
import { Bubble, BubbleContent } from "@/components/ui/bubble"
import { Message, MessageContent } from "@/components/ui/message"
import { Trace } from "@/components/ui/trace"
import { ProposeGoalTreePart } from "./parts/propose-goal-tree-part"
import { GetProjectInfoPart } from "./parts/get-project-info-part"
import { GetGraphInfoPart } from "./parts/get-graph-info-part"

type StepPart = Extract<
  ChatMessagePart,
  {
    type: "reasoning" | "tool-github_repo" | "tool-ask_user" | "tool-web_search" | "tool-propose_goal_tree" | "tool-get_project_info" | "tool-get_graph_info"
  }
>

export function ChatMessage({
  message,
  isStreaming = false,
  onRetry,
}: {
  message: ChatUIMessage
  isStreaming?: boolean
  onRetry?: () => void
}) {
  if (message.role === "user") {
    return (
      <Message align="end">
        <MessageContent>
          <Bubble align="end" variant="muted">
            <BubbleContent>
              {message.parts
                .filter((part) => part.type === "text")
                .map((part) => part.text)
                .join("")}
            </BubbleContent>
          </Bubble>
        </MessageContent>
      </Message>
    )
  }

  const blocks = groupParts(message.parts)
  const reasoningParts = message.parts.filter(
    (part) => part.type === "reasoning"
  )
  const text = blocks
    .flatMap((block) => (Array.isArray(block) ? [] : block.text))
    .join("\n\n")

  return (
    <Message align="start">
      <MessageContent>
        {blocks.map((block, index) =>
          Array.isArray(block) ? (
            <Trace key={index}>
              {block.map((part, partIndex) => {
                switch (part.type) {
                  case "reasoning":
                    return (
                      <ReasoningPart
                        key={partIndex}
                        part={part}
                        isStreaming={isStreaming}
                        duration={
                          message.metadata?.reasoningDurations?.[
                            reasoningParts.indexOf(part)
                          ]
                        }
                      />
                    )
                  case "tool-github_repo":
                    return (
                      <GithubRepoPart
                        key={part.toolCallId}
                        part={part}
                        isStreaming={isStreaming}
                      />
                    )
                  case "tool-ask_user":
                    return <AskUserPart key={part.toolCallId} part={part} />
                  case "tool-web_search":
                    return (
                      <WebSearchPart
                        key={part.toolCallId}
                        part={part}
                        isStreaming={isStreaming}
                      />
                    )
                  case "tool-get_project_info":
                    return (
                      <GetProjectInfoPart
                        key={part.toolCallId}
                        part={part}
                        isStreaming={isStreaming}
                      />
                    )
                  case "tool-get_graph_info":
                    return (
                      <GetGraphInfoPart
                        key={part.toolCallId}
                        part={part}
                        isStreaming={isStreaming}
                      />
                    )
                  case "tool-propose_goal_tree":
                    return (
                      <ProposeGoalTreePart
                        key={part.toolCallId}
                        part={part}
                        isStreaming={isStreaming}
                      />
                    )
                }
              })}
            </Trace>
          ) : (
            <TextPart key={index} part={block} />
          )
        )}
        {!isStreaming && <SourcesPart parts={message.parts} />}
        {!isStreaming && text && (
          <MessageActions text={text} onRetry={onRetry} />
        )}
      </MessageContent>
    </Message>
  )
}

// Text splits the steps into runs, and each run of steps gets its own Trace.
function groupParts(parts: ChatMessagePart[]) {
  return mergeTextParts(parts).reduce<(TextMessagePart | StepPart[])[]>(
    (blocks, part) => {
      if (part.type === "text") {
        if (part.text.trim()) {
          blocks.push(part)
        }
        return blocks
      }

      if (!isStepPart(part)) {
        return blocks
      }

      const last = blocks.at(-1)
      if (Array.isArray(last)) {
        last.push(part)
      } else {
        blocks.push([part])
      }
      return blocks
    },
    []
  )
}

function isStepPart(part: ChatMessagePart): part is StepPart {
  // An unanswered question shows in the QuestionCard, not in the Trace.
  if (part.type === "tool-ask_user") {
    return part.state === "output-available"
  }

  return (
    part.type === "reasoning" ||
    part.type === "tool-github_repo" ||
    part.type === "tool-web_search" ||
    part.type === "tool-propose_goal_tree" ||
    part.type === "tool-get_project_info" ||
    part.type === "tool-get_graph_info"
  )
}

// Web search replies stream one text part per citation, so join them back
// into one markdown document.
function mergeTextParts(parts: ChatMessagePart[]) {
  return parts
    .filter((part) => part.type !== "source-url")
    .reduce<ChatMessagePart[]>((merged, part) => {
      const last = merged.at(-1)
      if (part.type === "text" && last?.type === "text") {
        merged[merged.length - 1] = { ...part, text: last.text + part.text }
        return merged
      }
      merged.push(part)
      return merged
    }, [])
}
