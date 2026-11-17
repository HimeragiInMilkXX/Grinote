"use client"

import { type ProposeGoalTreeToolPart } from "@/tools"
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

export function ProposeGoalTreePart({
  part,
  isStreaming,
}: {
  part: ProposeGoalTreeToolPart
  isStreaming: boolean
}) {

  if (part.state === "output-available") {
    return (
      <TraceCollapsible>
        <TraceCollapsibleTrigger>
          <TraceLine>
            <TraceIcon>
              <StatusIcon />
            </TraceIcon>
            <TraceTitle>
              Generated goal tree
            </TraceTitle>
          </TraceLine>
        </TraceCollapsibleTrigger>

        <TraceCollapsibleContent>
          {/* Display the tool's JSON output */}
          <pre className="max-h-96 overflow-auto whitespace-pre-wrap wrap-break-word rounded-md bg-muted p-4 text-xs">
            {JSON.stringify(part.output, null, 2)}
          </pre>
        </TraceCollapsibleContent>
      </TraceCollapsible>
    )
  }

  if (part.state === "output-error") {
    return (
      <TraceLine status="error">
        <TraceIcon>
          <StatusIcon status="error" />
        </TraceIcon>
        <TraceTitle>
          Failed to generate goal tree
        </TraceTitle>
      </TraceLine>
    )
  }

  // During loading
  return (
    <TraceLine status={isStreaming ? "running" : "error"}>
      <TraceIcon>
        <StatusIcon
          status={isStreaming ? "running" : "error"}
        />
      </TraceIcon>
      <TraceTitle>
        {isStreaming
          ? "Generating goal tree..."
          : "Goal-tree generation interrupted"}
      </TraceTitle>
    </TraceLine>
  )
}
