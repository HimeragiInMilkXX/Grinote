import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  isStepCount,
  streamText,
  toUIMessageStream,
  validateUIMessages,
  type FinishReason,
  type InferUIMessageChunk,
  type ModelMessage,
  type TextStreamPart,
  type ToolSet,
} from "ai"

import {
  DEFAULT_MODEL,
  isModelAllowed,
} from "@/lib/ai/models"
import { getChatModel } from "@/lib/ai/provider"
import { describeChatError } from "@/lib/ai/errors"
import {
  getTools,
  type ChatUIMessage,
} from "@/tools"
import { generateSystemPrompt, parsePageContext } from "@/lib/ai/system-prompt"

export const maxDuration = 60

const MAX_OUTPUT_TOKENS = 8192
// material research chains list_materials, get_graph_info, web_search and propose_materials
const MAX_STEPS = 8

// Sent (hidden from the UI) when the model thought but returned nothing.
const EMPTY_REPLY_NUDGE =
  "考えた内容をもとに、ユーザーへの回答を文章で簡潔に伝えてください。"

export async function POST(req: Request) {
  let body: { model?: unknown, project_id: string, context?: unknown }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 })
  }

  const model = (body as { model?: unknown })?.model
  const modelId = typeof model === "string" ? model : DEFAULT_MODEL

  const projectId = body.project_id;

  if (typeof projectId !== "string" || !projectId) {
    return Response.json({ error: "project_id is required." }, { status: 400 })
  }

  const pageContext = parsePageContext(body.context)

  if (!isModelAllowed(modelId)) {
    return Response.json(
      { error: `Model ${modelId} is not available.` },
      { status: 400 }
    )
  }

  const tools = getTools(modelId)

  // Validate the shape of every message and tool part before trusting it.
  let messages: ChatUIMessage[]
  try {
    messages = await validateUIMessages<ChatUIMessage>({
      messages: (body as { messages?: unknown })?.messages,
      tools: tools as Parameters<typeof validateUIMessages>[0]["tools"],
    })
  } catch {
    return Response.json({ error: "Invalid messages." }, { status: 400 })
  }

  const modelMessages = await convertToModelMessages(messages)
  const system = generateSystemPrompt(projectId, pageContext)

  const run = (input: ModelMessage[], steps: number) =>
    streamText({
      model: getChatModel(modelId),
      messages: input,
      tools,
      stopWhen: isStepCount(steps),
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      abortSignal: req.signal,
      system,
    })

  // Log the real cause, send the user a short readable message.
  const onError = (error: unknown) => {
    console.error("[chat]", error)
    return describeChatError(error, modelId)
  }

  // A reply after ask_user continues the last message, so count its parts.
  const lastMessage = messages.at(-1)
  let reasoningCount =
    lastMessage?.role === "assistant"
      ? lastMessage.parts.filter((part) => part.type === "reasoning").length
      : 0
  const reasoningStarts = new Map<string, { index: number; time: number }>()

  // The AI SDK does not time reasoning, so time each block here.
  const messageMetadata = ({ part }: { part: TextStreamPart<ToolSet> }) => {
    if (part.type === "reasoning-start") {
      reasoningStarts.set(part.id, {
        index: reasoningCount++,
        time: Date.now(),
      })
    }

    const start =
      part.type === "reasoning-end"
        ? reasoningStarts.get(part.id)
        : undefined

    if (!start) {
      return undefined
    }

    return {
      reasoningDurations: { [start.index]: Date.now() - start.time },
    }
  }

  const stream = createUIMessageStream<ChatUIMessage>({
    onError,
    execute: async ({ writer }) => {
      // writer.merge drains in the background; copy each run in order so the
      // retry and the final finish chunk never overtake earlier chunks.
      const pipe = async (ui: ReadableStream<InferUIMessageChunk<ChatUIMessage>>) => {
        const reader = ui.getReader()
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          writer.write(value)
        }
      }

      const first = run(modelMessages, MAX_STEPS)
      await pipe(
        toUIMessageStream<ToolSet, ChatUIMessage>({
          stream: first.stream,
          sendSources: true,
          sendFinish: false,
          messageMetadata,
          onError,
        })
      )

      let steps: Awaited<typeof first.steps>
      let finishReason: FinishReason
      try {
        steps = await first.steps
        finishReason = await first.finishReason
      } catch {
        // The error chunk was already sent (or the user stopped); with no
        // finish chunk the client shows its fallback card.
        return
      }

      // Only reasoning came back (often the token budget went to thinking):
      // nudge the model once more inside the same reply.
      const isEmptyTurn =
        steps.every(
          (step) => step.text.trim() === "" && step.toolCalls.length === 0
        ) &&
        (finishReason === "stop" ||
          finishReason === "length" ||
          finishReason === "other")

      let autoRetried = false
      if (isEmptyTurn && !req.signal.aborted) {
        autoRetried = true
        const second = run(
          [...modelMessages, { role: "user", content: EMPTY_REPLY_NUDGE }],
          Math.max(1, MAX_STEPS - steps.length)
        )
        await pipe(
          toUIMessageStream<ToolSet, ChatUIMessage>({
            stream: second.stream,
            sendSources: true,
            sendStart: false,
            sendFinish: false,
            messageMetadata,
            onError,
          })
        )
        try {
          finishReason = await second.finishReason
        } catch {
          return
        }
      }

      if (req.signal.aborted) return

      writer.write({
        type: "finish",
        finishReason,
        messageMetadata: { finishReason, autoRetried },
      })
    },
  })

  return createUIMessageStreamResponse({ stream })
}
