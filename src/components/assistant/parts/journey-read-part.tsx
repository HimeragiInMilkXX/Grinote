"use client"

import { type ListJourneyToolPart, type ReadJourneyEntryToolPart } from "@/tools"
import { StatusIcon } from "@/components/assistant/status-icon"
import { CodeBlock, CodeBlockContent } from "@/components/ui/code-block"
import {
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from "@/components/ui/trace"

/** Trace line for the read-only journey tools (list_journey / read_journey_entry). */
export function JourneyReadPart({
  part,
  isStreaming,
}: {
  part: ListJourneyToolPart | ReadJourneyEntryToolPart
  isStreaming: boolean
}) {

  const target = part.type === "tool-read_journey_entry"
    ? "ジャーニーの記録"
    : "ジャーニー"

  if (part.state === "output-available") {
    const detail = part.type === "tool-list_journey"
      ? `（${part.output.entries.length}件）`
      : part.output?.task_name ? `「${part.output.task_name}」` : ""
    return (
      <TraceLine>
        <TraceIcon>
          <StatusIcon />
        </TraceIcon>
        <TraceTitle>{target}を読み込みました{detail}</TraceTitle>
      </TraceLine>
    )
  }

  if (part.state === "output-error") {
    return (
      <TraceCollapsible>
        <TraceCollapsibleTrigger>
          <TraceLine status="error">
            <TraceIcon>
              <StatusIcon status="error" />
            </TraceIcon>
            <TraceTitle>{target}の読み込みに失敗しました</TraceTitle>
          </TraceLine>
        </TraceCollapsibleTrigger>
        <TraceCollapsibleContent>
          <CodeBlock size="sm" variant="destructive">
            <CodeBlockContent wrap className="max-h-64">
              {part.errorText}
            </CodeBlockContent>
          </CodeBlock>
        </TraceCollapsibleContent>
      </TraceCollapsible>
    )
  }

  return (
    <TraceLine status={isStreaming ? "running" : "error"}>
      <TraceIcon>
        <StatusIcon status={isStreaming ? "running" : "error"} />
      </TraceIcon>
      <TraceTitle>
        {target}を{isStreaming ? "読み込み中..." : "読み込めませんでした"}
      </TraceTitle>
    </TraceLine>
  )
}
