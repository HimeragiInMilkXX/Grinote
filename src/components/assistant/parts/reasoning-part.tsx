"use client"

import * as React from "react"

import { type ReasoningMessagePart } from "@/tools"
import { StatusIcon } from "@/components/assistant/status-icon"
import {
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceDescription,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from "@/components/ui/trace"

export function ReasoningPart({
  part,
  isStreaming,
  duration,
}: {
  part: ReasoningMessagePart
  isStreaming: boolean
  duration?: number
}) {
  const [open, setOpen] = React.useState<boolean>()
  const running = isStreaming && part.state === "streaming"
  // The stream ended while this block was still being written.
  const cutOff = !isStreaming && part.state === "streaming"
  const status = running ? "running" : cutOff ? "error" : undefined

  const line = (
    <TraceLine status={status}>
      <TraceIcon>
        <StatusIcon status={status} />
      </TraceIcon>
      <TraceTitle>
        {running ? "Thinking" : cutOff ? "思考が中断されました" : "Thought"}
      </TraceTitle>
      {!running && !cutOff && duration !== undefined && (
        <TraceDescription>
          {Math.max(1, Math.round(duration / 1000))}s
        </TraceDescription>
      )}
    </TraceLine>
  )

  if (!part.text) {
    return line
  }

  // Open while the model thinks, then close, unless the person toggled it.
  return (
    <TraceCollapsible open={open ?? running} onOpenChange={setOpen}>
      <TraceCollapsibleTrigger>{line}</TraceCollapsibleTrigger>
      <TraceCollapsibleContent className="whitespace-pre-wrap">
        {part.text}
      </TraceCollapsibleContent>
    </TraceCollapsible>
  )
}
