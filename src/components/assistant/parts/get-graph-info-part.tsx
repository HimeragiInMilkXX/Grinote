import { type GetGraphInfoToolPart } from "@/tools"
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

export function GetGraphInfoPart({
  part,
  isStreaming,
}: {
  part: GetGraphInfoToolPart
  isStreaming: boolean
}) {
  const target = part.input?.project_id
    ? `the graph information for id “${part.input.project_id}”`
    : "the graph information"

  if (part.state === "output-available") {
    return (
      <TraceLine>
        <TraceIcon>
          <StatusIcon />
        </TraceIcon>
        <TraceTitle>Fetched {target}</TraceTitle>
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
            <TraceTitle>Failed to fetch {target}</TraceTitle>
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
        {isStreaming ? "Fetching" : "Failed to fetch"} {target}
      </TraceTitle>
    </TraceLine>
  )
}
