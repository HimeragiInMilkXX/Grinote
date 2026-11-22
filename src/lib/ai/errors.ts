// Turns an error from the model provider into a short Japanese message for the
// assistant drawer. The raw error is logged on the server, never sent.

type ErrorLike = {
  name?: unknown
  message?: unknown
  code?: unknown
  statusCode?: unknown
  responseBody?: unknown
  cause?: unknown
  lastError?: unknown
}

export const CHAT_ERROR_MESSAGES = {
  connection:
    "AIサーバーに接続できません。Ollamaが起動しているか確認してください。",
  context: "会話が長すぎます。新しいチャットを始めてください。",
  timeout: "応答がタイムアウトしました。もう一度お試しください。",
  fallback: "エラーが発生しました。もう一度お試しください。",
} as const

export function modelNotFoundMessage(modelId: string) {
  return `モデル「${modelId}」が見つかりません。別のモデルを選んでください。`
}

export function describeChatError(error: unknown, modelId: string): string {
  const chain = errorChain(error)
  const text = chain
    .flatMap((e) => [e.name, e.message, e.code, e.responseBody])
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase()
  const statusCodes = chain
    .map((e) => e.statusCode)
    .filter((value): value is number => typeof value === "number")

  if (
    /econnrefused|enotfound|econnreset|fetch failed|failed to fetch|cannot connect|connect error|socket hang up/.test(
      text
    )
  ) {
    return CHAT_ERROR_MESSAGES.connection
  }

  if (
    /context length|context window|maximum context|too many tokens|prompt is too long|exceeds the (model's )?(context|maximum)/.test(
      text
    )
  ) {
    return CHAT_ERROR_MESSAGES.context
  }

  if (
    statusCodes.includes(404) ||
    /model ['"`]?[^\s'"`]*['"`]? not found|model not found|no such model|try pulling it/.test(
      text
    )
  ) {
    return modelNotFoundMessage(modelId)
  }

  if (/timeout|timed out|etimedout/.test(text)) {
    return CHAT_ERROR_MESSAGES.timeout
  }

  return CHAT_ERROR_MESSAGES.fallback
}

// Follow cause / lastError (RetryError) so wrapped provider errors are seen.
function errorChain(error: unknown): ErrorLike[] {
  const chain: ErrorLike[] = []
  let current: unknown = error
  while (current && typeof current === "object" && chain.length < 6) {
    const e = current as ErrorLike
    chain.push(e)
    current = e.lastError ?? e.cause
  }
  if (typeof error === "string") {
    chain.push({ message: error })
  }
  return chain
}
