import type { ChatUIMessage } from "@/tools"

// What went wrong with the last assistant turn, if anything. The assistant
// drawer shows a fallback card with a matching action for each issue.
export type ReplyIssue =
  | "error"
  | "stopped"
  | "interrupted"
  | "empty"
  | "length"
  | "step-limit"

export function getReplyIssue({
  lastMessage,
  isBusy,
  hasError,
  stoppedByUser,
}: {
  lastMessage: ChatUIMessage | undefined
  isBusy: boolean
  hasError: boolean
  stoppedByUser: boolean
}): ReplyIssue | null {
  if (isBusy) return null
  if (hasError) return "error"
  if (!lastMessage || lastMessage.role !== "assistant") return null

  const finishReason = lastMessage.metadata?.finishReason

  // No finish chunk reached the client: the stream was cut off.
  if (!finishReason) {
    return stoppedByUser ? "stopped" : "interrupted"
  }

  if (finishReason === "error") return "interrupted"

  const parts = lastMessage.parts
  const hasText = parts.some(
    (part) => part.type === "text" && part.text.trim() !== ""
  )
  const hasTool = parts.some((part) => part.type.startsWith("tool-"))

  if (finishReason === "length") {
    return hasText ? "length" : "empty"
  }

  if (finishReason === "tool-calls") {
    // Waiting for the user's answer is not a dead end.
    const waitingForUser = parts.some(
      (part) =>
        part.type === "tool-ask_user" &&
        (part.state === "input-streaming" || part.state === "input-available")
    )
    return waitingForUser ? null : "step-limit"
  }

  if (!hasText && !hasTool) return "empty"

  return null
}

// A route 400 comes back as the JSON body in error.message.
export function readableErrorMessage(error: Error | undefined) {
  if (!error) return undefined
  try {
    const parsed = JSON.parse(error.message) as { error?: unknown }
    if (typeof parsed?.error === "string") return parsed.error
  } catch {
    // not JSON
  }
  return error.message
}
