"use client"

import { type ProposeGoalTreeToolPart } from "@/tools"
import { StatusIcon } from "@/components/assistant/status-icon"
import {
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from "@/components/ui/trace"
import { ChangeList, DiffCountBadges } from "@/components/flow/generated/change-format"

export function ProposeGoalTreePart({
  part,
  isStreaming,
}: {
  part: ProposeGoalTreeToolPart
  isStreaming: boolean
}) {

  if (part.state === "output-available") {
    const diff = part.output?.diff
    return (
      <TraceCollapsible>
        <TraceCollapsibleTrigger>
          <TraceLine>
            <TraceIcon>
              <StatusIcon />
            </TraceIcon>
            <TraceTitle>
              <span className="inline-flex flex-wrap items-center gap-2">
                ツリー変更案 {diff && <DiffCountBadges diff={diff} />}
              </span>
            </TraceTitle>
          </TraceLine>
        </TraceCollapsibleTrigger>

        <TraceCollapsibleContent>
          <div className="flex flex-col gap-3 rounded-md bg-muted p-3">
            {part.output?.goal && <p className="text-xs font-medium">{part.output.goal}</p>}
            {diff ? <ChangeList diff={diff} /> : null}
            <details>
              <summary className="cursor-pointer text-[11px] text-muted-foreground">JSON</summary>
              <pre className="max-h-72 overflow-auto whitespace-pre-wrap wrap-break-word text-[10px]">
                {JSON.stringify(part.output, null, 2)}
              </pre>
            </details>
          </div>
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
          ツリー変更案の作成に失敗しました
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
          ? "ツリー変更案を作成中..."
          : "ツリー変更案の作成が中断されました"}
      </TraceTitle>
    </TraceLine>
  )
}
