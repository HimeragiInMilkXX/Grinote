"use client"

import { type ProposeMaterialsToolPart } from "@/tools"
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
import { materialListVersionAtom, materialProposalReviewedAtom } from "@/atoms/material_atoms"
import { applyMaterialProposal } from "@/app/project/[projectId]/materials/serverActions"
import { useState } from "react"
import { toast } from "sonner"
import { ExternalLink, Link2, Link2Off, Search } from "lucide-react"
import type { ProposeMaterialsOutput } from "@/tools/propose_materials"

type ItemKey = string

/** Review card: one checkbox per item; accepting writes the ticked items to the DB right away. */
function MaterialProposalCard({ toolCallId, output }: { toolCallId: string, output: ProposeMaterialsOutput }) {

  const [ reviewed, setReviewed ] = useAtom( materialProposalReviewedAtom )
  const bumpVersion = useSetAtom( materialListVersionAtom )

  const { ops, materialNames, nodeNames } = output

  const allKeys: ItemKey[] = [
    ...ops.create_external.map( ( _, i ) => `c${i}` ),
    ...ops.link.map( ( _, i ) => `l${i}` ),
    ...ops.unlink.map( ( _, i ) => `u${i}` ),
  ]

  const [ checked, setChecked ] = useState<Set<ItemKey>>( new Set( allKeys ) )
  const [ busy, setBusy ] = useState( false )

  if( reviewed.includes( toolCallId ) ) return null

  const dismiss = () => setReviewed( prev => prev.includes( toolCallId ) ? prev : [ ...prev, toolCallId ] )

  const toggle = ( key: ItemKey, value: boolean ) => setChecked( prev => {
    const next = new Set( prev )
    if( value ) next.add( key ); else next.delete( key )
    return next
  } )

  const accept = async () => {
    setBusy( true )
    try {
      const res = await applyMaterialProposal( output.project_id, {
        create_external: ops.create_external.filter( ( _, i ) => checked.has( `c${i}` ) ),
        link: ops.link.filter( ( _, i ) => checked.has( `l${i}` ) ),
        unlink: ops.unlink.filter( ( _, i ) => checked.has( `u${i}` ) ),
      } )
      toast.success( `適用しました（新規マテリアル ${res.created.length}件）` )
      bumpVersion( v => v + 1 )
      dismiss()
    } catch( e ) {
      toast.error( String( e ) )
    } finally {
      setBusy( false )
    }
  }

  const nodeList = ( ids: string[] ) => ids.length ? ids.map( id => nodeNames[id] ?? id ).join( "、" ) : null

  const Row = ( { k, children }: { k: ItemKey, children: React.ReactNode } ) => (
    <label className="flex items-start gap-2 text-sm py-1 cursor-pointer">
      <Checkbox className="mt-0.5" checked={checked.has( k )} onCheckedChange={v => toggle( k, !!v )} />
      <div className="flex flex-col gap-0.5 min-w-0">{children}</div>
    </label>
  )

  return (
    <div className="rounded-lg border bg-background p-3 flex flex-col gap-2 mt-2">
      <p className="font-medium text-sm"> { output.summary } </p>

      { ops.create_external.length > 0 && <p className="text-xs text-muted-foreground"> 外部リンクとして追加 </p> }
      { ops.create_external.map( ( c, i ) => (
        <Row key={`c${i}`} k={`c${i}`}>
          <span className="flex items-center gap-1"> <ExternalLink size={12}/> { c.name } </span>
          <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 underline truncate" onClick={e => e.stopPropagation()}> { c.url } </a>
          { c.description && <span className="text-xs text-muted-foreground"> { c.description } </span> }
          { nodeList( c.node_ids ) && <span className="text-xs"> リンク先: { nodeList( c.node_ids ) } </span> }
        </Row>
      ) ) }

      { ops.link.length > 0 && <p className="text-xs text-muted-foreground"> リンクを追加 </p> }
      { ops.link.map( ( l, i ) => (
        <Row key={`l${i}`} k={`l${i}`}>
          <span className="flex items-center gap-1"> <Link2 size={12}/> { materialNames[l.material_id] ?? `#${l.material_id}` } → { nodeNames[l.node_id] ?? l.node_id } </span>
        </Row>
      ) ) }

      { ops.unlink.length > 0 && <p className="text-xs text-muted-foreground"> リンクを解除 </p> }
      { ops.unlink.map( ( l, i ) => (
        <Row key={`u${i}`} k={`u${i}`}>
          <span className="flex items-center gap-1"> <Link2Off size={12}/> { materialNames[l.material_id] ?? `#${l.material_id}` } ✕ { nodeNames[l.node_id] ?? l.node_id } </span>
        </Row>
      ) ) }

      { ops.suggestions.length > 0 && (
        <div className="flex flex-col gap-1 border-t pt-2">
          <p className="text-xs text-muted-foreground"> 探してみるとよいもの（自動では作成されません） </p>
          { ops.suggestions.map( ( s, i ) => (
            <div key={i} className="text-sm flex flex-col">
              <span className="flex items-center gap-1"> <Search size={12}/> { s.title } </span>
              { s.reason && <span className="text-xs text-muted-foreground"> { s.reason } </span> }
              { s.search_query && (
                <a className="text-xs text-blue-600 underline" target="_blank" rel="noopener noreferrer"
                  href={`https://www.google.com/search?q=${encodeURIComponent( s.search_query )}`}> 「{ s.search_query }」で検索 </a>
              ) }
              { nodeList( s.node_ids ) && <span className="text-xs"> 対象: { nodeList( s.node_ids ) } </span> }
            </div>
          ) ) }
        </div>
      ) }

      { output.warnings.length > 0 && <p className="text-xs text-amber-600"> { output.warnings.join( " " ) } </p> }

      <div className="flex gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={dismiss} disabled={busy}> { allKeys.length ? "却下" : "閉じる" } </Button>
        { allKeys.length > 0 && (
          <Button size="sm" onClick={accept} disabled={busy || checked.size === 0}> 選択した{ checked.size }件を適用 </Button>
        ) }
      </div>
    </div>
  )
}

export function ProposeMaterialsPart({
  part,
  isStreaming,
}: {
  part: ProposeMaterialsToolPart
  isStreaming: boolean
}) {

  if (part.state === "output-available") {
    const o = part.output
    return (
      <>
        <TraceLine>
          <TraceIcon>
            <StatusIcon />
          </TraceIcon>
          <TraceTitle>
            マテリアル提案（追加 {o.ops.create_external.length}・リンク {o.ops.link.length}・解除 {o.ops.unlink.length}・アイデア {o.ops.suggestions.length}）
          </TraceTitle>
        </TraceLine>
        {!isStreaming && <MaterialProposalCard toolCallId={part.toolCallId} output={o} />}
      </>
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
            <TraceTitle>マテリアル提案の作成に失敗しました</TraceTitle>
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
        {isStreaming ? "マテリアル提案を作成中..." : "マテリアル提案の作成が中断されました"}
      </TraceTitle>
    </TraceLine>
  )
}
