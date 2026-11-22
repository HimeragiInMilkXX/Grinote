"use client"

import { type DraftMemoToolPart } from "@/tools"
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
import { Button } from "@/components/ui/button"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { useAtom, useSetAtom } from "jotai"
import { materialListVersionAtom, materialProposalReviewedAtom, memoDraftRequestAtom } from "@/atoms/material_atoms"
import { currentMaterialTabAtom, openedMaterialTabsAtom } from "@/components/material/material-tabs"
import { saveMaterial } from "@/app/project/[projectId]/materials/serverActions"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import type { DraftMemoOutput } from "@/tools/draft_memo"
import { assistantDrawerOpenAtom } from "@/components/assistant/assistant-drawer"

/** Preview + insert buttons. Inserting puts the HTML into the memo editor unsaved; the user saves it there. */
function MemoDraftCard({ toolCallId, output, markdown }: { toolCallId: string, output: DraftMemoOutput, markdown: string }) {

  // the reviewed list is shared with material proposals (toolCallIds are unique)
  const [ reviewed, setReviewed ] = useAtom( materialProposalReviewedAtom )
  const setDraftRequest = useSetAtom( memoDraftRequestAtom )
  const setOpenedTabs = useSetAtom( openedMaterialTabsAtom )
  const setCurrentTab = useSetAtom( currentMaterialTabAtom )
  const bumpVersion = useSetAtom( materialListVersionAtom )
  const setDrawerOpen = useSetAtom( assistantDrawerOpenAtom )
  const router = useRouter()
  const [ busy, setBusy ] = useState( false )

  if( reviewed.includes( toolCallId ) ) return null

  const dismiss = () => setReviewed( prev => prev.includes( toolCallId ) ? prev : [ ...prev, toolCallId ] )

  const openTab = ( id: number, name: string ) => {
    setOpenedTabs( ot => ot.some( t => t.id === id ) ? ot : [ ...ot, { id, name } ] )
    setCurrentTab( String( id ) )
    // close the drawer so the editor with the inserted draft is visible
    setDrawerOpen( false )
    router.push( `/project/${output.project_id}/materials` )
  }

  const insert = ( mode: "replace" | "append" ) => {
    if( output.material_id === null ) return
    setDraftRequest( { material_id: output.material_id, html: output.html, mode } )
    openTab( output.material_id, output.material_name ?? "" )
    dismiss()
  }

  const createNew = async () => {
    setBusy( true )
    try {
      const material = await saveMaterial( output.project_id,
        { type: "memos", name: output.title, label: "", color: "#000000", description: "", file: undefined, link: undefined },
        { content: output.html } )
      bumpVersion( v => v + 1 )
      toast.success( `メモ「${material.name}」を作成しました` )
      openTab( material.id, material.name )
      dismiss()
    } catch( e ) {
      toast.error( String( e ) )
    } finally {
      setBusy( false )
    }
  }

  return (
    <div className="rounded-lg border bg-background p-3 flex flex-col gap-2 mt-2">
      <p className="text-sm font-medium">
        メモ下書き「{ output.title }」{ output.material_name && <span className="text-muted-foreground font-normal"> → { output.material_name } </span> }
      </p>
      <div className="typeset typeset-docs max-h-72 overflow-y-auto rounded border bg-muted/40 p-3 text-sm">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{ markdown }</ReactMarkdown>
      </div>
      <p className="text-xs text-muted-foreground"> 挿入してもまだ保存されません。エディタで確認して保存してください。 </p>
      <div className="flex flex-wrap gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={dismiss} disabled={busy}> 却下 </Button>
        <Button variant="outline" size="sm" onClick={createNew} disabled={busy}> 新規メモとして作成 </Button>
        { output.material_id !== null && <>
          <Button variant="outline" size="sm" onClick={() => insert( "replace" )} disabled={busy}> 置換で挿入 </Button>
          <Button size="sm" onClick={() => insert( "append" )} disabled={busy}> 追記で挿入 </Button>
        </> }
      </div>
    </div>
  )
}

export function DraftMemoPart({
  part,
  isStreaming,
}: {
  part: DraftMemoToolPart
  isStreaming: boolean
}) {

  if (part.state === "output-available") {
    return (
      <>
        <TraceLine>
          <TraceIcon>
            <StatusIcon />
          </TraceIcon>
          <TraceTitle>メモ下書き「{part.output.title}」を作成しました</TraceTitle>
        </TraceLine>
        {!isStreaming && <MemoDraftCard toolCallId={part.toolCallId} output={part.output} markdown={part.input.markdown} />}
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
            <TraceTitle>メモ下書きの作成に失敗しました</TraceTitle>
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
        {isStreaming ? "メモを書いています..." : "メモ下書きの作成が中断されました"}
      </TraceTitle>
    </TraceLine>
  )
}
