"use client"

import {
  CircleAlertIcon,
  CircleSlashIcon,
  HourglassIcon,
  MessageCircleQuestionIcon,
  RefreshCcwIcon,
  ScissorsIcon,
  SquareIcon,
  StepForwardIcon,
} from "lucide-react"

import { type ReplyIssue } from "@/lib/ai/reply-status"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

export type FallbackKind = ReplyIssue | "stalled"

export type FallbackActions = {
  retry: () => void
  sendText: (text: string) => void
  wait: () => void
  stopAndRetry: () => void
}

// Follow-up prompts sent as a normal user message.
const CONTINUE_TEXT = "続きをお願いします。"
const NEXT_STEP_TEXT = "続けてください。"
const ANSWER_TEXT = "考えた内容をもとに回答してください。"

type Action = { label: string; icon: React.ReactNode; onClick: () => void }

export function ReplyFallback({
  kind,
  errorMessage,
  autoRetried,
  actions,
}: {
  kind: FallbackKind
  errorMessage?: string
  autoRetried?: boolean
  actions: FallbackActions
}) {
  const retry: Action = {
    label: "再試行",
    icon: <RefreshCcwIcon />,
    onClick: actions.retry,
  }

  // The user stopped it on purpose: a quiet line, not an alert.
  if (kind === "stopped") {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <CircleSlashIcon className="size-3.5" />
        <span>停止しました</span>
        <FallbackButton action={retry} />
      </div>
    )
  }

  const content: Record<
    Exclude<FallbackKind, "stopped">,
    {
      icon: React.ReactNode
      title: string
      description?: string
      destructive?: boolean
      actions: Action[]
    }
  > = {
    error: {
      icon: <CircleAlertIcon />,
      title: "応答の取得に失敗しました",
      description: errorMessage,
      destructive: true,
      actions: [retry],
    },
    interrupted: {
      icon: <CircleAlertIcon />,
      title: "応答が途中で止まりました",
      description: "接続が切れたか、モデルが応答を中断しました。",
      destructive: true,
      actions: [retry],
    },
    empty: {
      icon: <MessageCircleQuestionIcon />,
      title: "考えましたが、返答がありませんでした",
      description: autoRetried
        ? "自動で再試行しましたが、返答がありませんでした。もう一度試すか、別のモデルを選んでください。"
        : "もう一度試すか、別のモデルを選んでください。",
      actions: [
        retry,
        {
          label: "回答を求める",
          icon: <StepForwardIcon />,
          onClick: () => actions.sendText(ANSWER_TEXT),
        },
      ],
    },
    length: {
      icon: <ScissorsIcon />,
      title: "出力の上限に達したため途中で切れました",
      actions: [
        {
          label: "続きを生成",
          icon: <StepForwardIcon />,
          onClick: () => actions.sendText(CONTINUE_TEXT),
        },
      ],
    },
    "step-limit": {
      icon: <StepForwardIcon />,
      title: "処理ステップの上限に達しました",
      description: "作業の途中で止まっています。続けますか？",
      actions: [
        {
          label: "続ける",
          icon: <StepForwardIcon />,
          onClick: () => actions.sendText(NEXT_STEP_TEXT),
        },
      ],
    },
    stalled: {
      icon: <HourglassIcon />,
      title: "応答が止まっているようです",
      description: "モデルの読み込み中の可能性もあります。",
      actions: [
        { label: "待つ", icon: <HourglassIcon />, onClick: actions.wait },
        {
          label: "停止して再試行",
          icon: <SquareIcon />,
          onClick: actions.stopAndRetry,
        },
      ],
    },
  }

  const view = content[kind]

  return (
    <Alert variant={view.destructive ? "destructive" : "default"}>
      {view.icon}
      <AlertTitle>{view.title}</AlertTitle>
      <AlertDescription className="flex flex-col gap-2">
        {view.description && <div>{view.description}</div>}
        <div className="flex flex-wrap gap-1.5">
          {view.actions.map((action) => (
            <FallbackButton key={action.label} action={action} />
          ))}
        </div>
      </AlertDescription>
    </Alert>
  )
}

function FallbackButton({ action }: { action: Action }) {
  return (
    <Button
      type="button"
      variant="outline"
      size="xs"
      onClick={action.onClick}
    >
      {action.icon}
      {action.label}
    </Button>
  )
}
