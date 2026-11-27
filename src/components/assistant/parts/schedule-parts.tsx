"use client"

import { type ListScheduleToolPart, type ProposeScheduleToolPart } from "@/tools"
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
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { useAtom, useSetAtom } from "jotai"
import { scheduleProposalReviewedAtom, scheduleVersionAtom } from "@/atoms/schedule_atoms"
import { applyScheduleChanges } from "@/lib/schedule/actions"
import { dayLabel } from "@/lib/next-action/labels"
import { useState } from "react"
import { toast } from "sonner"
import { AlertTriangle, ArrowRight, CalendarMinus, CalendarPlus } from "lucide-react"
import type { ProposeScheduleOutput } from "@/tools/propose_schedule"
import Link from "next/link"

function ErrorTrace({ title, errorText }: { title: string, errorText?: string }) {
  return (
    <TraceCollapsible>
      <TraceCollapsibleTrigger>
        <TraceLine status="error">
          <TraceIcon>
            <StatusIcon status="error" />
          </TraceIcon>
          <TraceTitle>{title}</TraceTitle>
        </TraceLine>
      </TraceCollapsibleTrigger>
      <TraceCollapsibleContent>
        <CodeBlock size="sm" variant="destructive">
          <CodeBlockContent wrap className="max-h-64">
            {errorText}
          </CodeBlockContent>
        </CodeBlock>
      </TraceCollapsibleContent>
    </TraceCollapsible>
  )
}

function PendingTrace({ isStreaming, running, aborted }: { isStreaming: boolean, running: string, aborted: string }) {
  return (
    <TraceLine status={isStreaming ? "running" : "error"}>
      <TraceIcon>
        <StatusIcon status={isStreaming ? "running" : "error"} />
      </TraceIcon>
      <TraceTitle>{isStreaming ? running : aborted}</TraceTitle>
    </TraceLine>
  )
}

/** Trace line for the read-only list_schedule tool. */
export function ScheduleReadPart({ part, isStreaming }: { part: ListScheduleToolPart, isStreaming: boolean }) {

  if (part.state === "output-available") {
    const planned = part.output.days.reduce((s, d) => s + d.entries.length, 0)
    return (
      <TraceLine>
        <TraceIcon>
          <StatusIcon />
        </TraceIcon>
        <TraceTitle>スケジュールを読み込みました（{part.output.days.length}日分・予定{planned}件）</TraceTitle>
      </TraceLine>
    )
  }

  if (part.state === "output-error") return <ErrorTrace title="スケジュールの読み込みに失敗しました" errorText={part.errorText} />

  return <PendingTrace isStreaming={isStreaming} running="スケジュールを読み込み中..." aborted="スケジュールを読み込めませんでした" />
}

/** Review card: one checkbox per change; applying writes the ticked ones right away (re-validated on the server). */
function ScheduleProposalCard({ toolCallId, output }: { toolCallId: string, output: ProposeScheduleOutput }) {

  const [ reviewed, setReviewed ] = useAtom( scheduleProposalReviewedAtom )
  const bumpVersion = useSetAtom( scheduleVersionAtom )
  const { ops, nodeNames, itemInfo } = output

  const allKeys = [
    ...ops.add.map( ( _, i ) => `a${i}` ),
    ...ops.move.map( ( _, i ) => `m${i}` ),
    ...ops.remove.map( ( _, i ) => `r${i}` ),
  ]

  const [ checked, setChecked ] = useState<Set<string>>( new Set( allKeys ) )
  const [ busy, setBusy ] = useState( false )
  const [ problems, setProblems ] = useState<string[]>( [] )

  if( reviewed.includes( toolCallId ) ) return null

  const dismiss = () => setReviewed( prev => prev.includes( toolCallId ) ? prev : [ ...prev, toolCallId ] )

  const toggle = ( key: string, value: boolean ) => setChecked( prev => {
    const next = new Set( prev )
    if( value ) next.add( key ); else next.delete( key )
    return next
  } )

  const accept = async () => {
    setBusy( true )
    setProblems( [] )
    try {
      const res = await applyScheduleChanges( output.project_id, {
        add: ops.add.filter( ( _, i ) => checked.has( `a${i}` ) ),
        move: ops.move.filter( ( _, i ) => checked.has( `m${i}` ) ),
        remove: ops.remove.filter( ( _, i ) => checked.has( `r${i}` ) ),
      } )
      bumpVersion( v => v + 1 )
      if( !res.ok ) {
        // e.g. the schedule changed since the draft was made
        toast.error( res.message )
        setProblems( res.problems ?? [] )
        return
      }
      toast.success( "スケジュールに適用しました", res.warnings.length ? { description: res.warnings.join( "\n" ) } : undefined )
      dismiss()
    } catch( e ) {
      toast.error( String( e ) )
    } finally {
      setBusy( false )
    }
  }

  const label = ( key: string ) => key ? dayLabel( key, output.today ) : "?"

  const Row = ( { k, children }: { k: string, children: React.ReactNode } ) => (
    <label className="flex items-start gap-2 py-1 text-sm cursor-pointer">
      <Checkbox className="mt-0.5" checked={checked.has( k )} onCheckedChange={v => toggle( k, !!v )} />
      <div className="flex min-w-0 flex-col gap-0.5">{children}</div>
    </label>
  )

  return (
    <div className="mt-2 flex flex-col gap-2 rounded-lg border bg-background p-3">
      <p className="text-sm font-medium"> { output.summary } </p>

      { ops.add.length > 0 && <p className="text-xs text-muted-foreground"> 予定に追加 </p> }
      { ops.add.map( ( a, i ) => (
        <Row key={`a${i}`} k={`a${i}`}>
          <span className="flex items-center gap-1"><CalendarPlus size={12}/> { label( a.date ) }：{ nodeNames[ a.node_id ] ?? a.node_id }{ a.count > 1 ? ` ×${a.count}` : "" }</span>
        </Row>
      ) ) }

      { ops.move.length > 0 && <p className="text-xs text-muted-foreground"> 日付を変更 </p> }
      { ops.move.map( ( m, i ) => (
        <Row key={`m${i}`} k={`m${i}`}>
          <span className="flex items-center gap-1">{ itemInfo[ m.item_id ]?.name ?? m.item_id }：{ label( itemInfo[ m.item_id ]?.date ?? "" ) } <ArrowRight size={12}/> { label( m.date ) }</span>
        </Row>
      ) ) }

      { ops.remove.length > 0 && <p className="text-xs text-muted-foreground"> 予定から外す </p> }
      { ops.remove.map( ( r, i ) => (
        <Row key={`r${i}`} k={`r${i}`}>
          <span className="flex items-center gap-1"><CalendarMinus size={12}/> { label( itemInfo[ r.item_id ]?.date ?? "" ) }：{ itemInfo[ r.item_id ]?.name ?? r.item_id }</span>
        </Row>
      ) ) }

      { output.days.length > 0 && (
        <ul className="flex flex-col gap-0.5 border-t pt-2 text-xs text-muted-foreground" aria-label="1日の合計（すべて適用した場合）">
          { output.days.map( d => (
            <li key={d.key} className={ d.over ? "text-amber-700 dark:text-amber-300" : undefined }>
              { label( d.key ) }：{ d.beforeMinutes }分 → { d.afterMinutes }分{ d.goalMinutes ? `（目標 ${d.goalMinutes}分）` : "" }
            </li>
          ) ) }
        </ul>
      ) }

      { output.warnings.length > 0 && (
        <ul className="flex flex-col gap-0.5 text-xs text-amber-700 dark:text-amber-300">
          { output.warnings.map( w => <li key={w} className="flex gap-1"><AlertTriangle className="mt-0.5 size-3 shrink-0"/> { w }</li> ) }
        </ul>
      ) }

      { problems.length > 0 && (
        <ul className="flex flex-col gap-0.5 rounded bg-destructive/10 p-2 text-xs text-destructive" role="alert">
          { problems.map( p => <li key={p}>{ p }</li> ) }
        </ul>
      ) }

      <div className="flex items-center justify-end gap-2">
        <Link href={`/project/${output.project_id}/schedule`} className="mr-auto text-xs text-muted-foreground underline"> スケジュールを開く </Link>
        <Button variant="outline" size="sm" onClick={dismiss} disabled={busy}> 却下 </Button>
        <Button size="sm" onClick={accept} disabled={busy || checked.size === 0}> 選択した{ checked.size }件を適用 </Button>
      </div>
    </div>
  )
}

export function ProposeSchedulePart({ part, isStreaming }: { part: ProposeScheduleToolPart, isStreaming: boolean }) {

  if (part.state === "output-available") {
    const o = part.output
    return (
      <>
        <TraceLine>
          <TraceIcon>
            <StatusIcon />
          </TraceIcon>
          <TraceTitle>
            スケジュール提案（追加 {o.ops.add.reduce( ( s, a ) => s + a.count, 0 )}・移動 {o.ops.move.length}・削除 {o.ops.remove.length}）
          </TraceTitle>
        </TraceLine>
        {!isStreaming && <ScheduleProposalCard toolCallId={part.toolCallId} output={o} />}
      </>
    )
  }

  if (part.state === "output-error") return <ErrorTrace title="スケジュール提案の作成に失敗しました" errorText={part.errorText} />

  return <PendingTrace isStreaming={isStreaming} running="スケジュール提案を作成中..." aborted="スケジュール提案の作成が中断されました" />
}
