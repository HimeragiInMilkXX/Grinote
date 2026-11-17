import "server-only"

import { createOpenAICompatible } from "@ai-sdk/openai-compatible"

const provider = createOpenAICompatible({
  name: "grinote",
  baseURL: process.env.AI_BASE_URL ?? "http://localhost:11434/v1",
  apiKey: process.env.AI_API_KEY || "ollama",
})

export function getChatModel(modelId: string) {
  return provider.chatModel(modelId)
}
