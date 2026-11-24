import "server-only"

import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { createOpenAICompatible } from "@ai-sdk/openai-compatible"

import {
  createFallbackModel,
  type FallbackEntry,
  type FallbackHooks,
} from "@/lib/ai/fallback"

import {
  DEFAULT_MODEL,
  FALLBACK_MODEL_IDS,
  MODELS,
  getModelInfo,
  type GatewayModel,
} from "@/lib/ai/models"

const baseURL = process.env.AI_BASE_URL ?? "http://localhost:11434/v1"
const apiKey = process.env.AI_API_KEY || "ollama"

const provider = createOpenAICompatible({
  name: "grinote",
  baseURL,
  apiKey,
})

// Same server, but sends the JSON schema as `response_format: json_schema`
// (Ollama constrains the output to it). Used for the task report analysis.
const structuredProvider = createOpenAICompatible({
  name: "grinote-structured",
  baseURL,
  apiKey,
  supportsStructuredOutputs: true,
})

// Gemini (Google AI Studio key). Structured output is native.
const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY?.trim() || undefined,
})

export function hasGeminiKey() {
  return Boolean(process.env.GEMINI_API_KEY?.trim())
}

function isUsable(model: GatewayModel) {
  return model.provider !== "google" || hasGeminiKey()
}

/** Models shown in the picker: cloud models are hidden while their key is missing. */
export function getAvailableModels(): GatewayModel[] {
  return MODELS.filter(isUsable)
}

/** The default model, or the first available one when its key is missing. */
export function getDefaultModelId() {
  const preferred = getModelInfo(DEFAULT_MODEL)
  if (preferred && isUsable(preferred)) return preferred.id
  return getAvailableModels()[0]?.id ?? DEFAULT_MODEL
}

export function isGoogleModel(modelId: string) {
  return getModelInfo(modelId)?.provider === "google"
}

/**
 * Models to try in order. A cloud model falls back to the local ones; a local
 * model has no fallback (they all run on the same Ollama server).
 */
export function getModelChain(modelId: string): string[] {
  if (!isGoogleModel(modelId)) return [modelId]
  const fallbacks = FALLBACK_MODEL_IDS.filter((id) => id !== modelId)
  return hasGeminiKey() ? [modelId, ...fallbacks] : fallbacks
}

export function getChatModel(modelId: string) {
  return isGoogleModel(modelId) ? google(modelId) : provider.chatModel(modelId)
}

export function getStructuredModel(modelId: string) {
  return isGoogleModel(modelId)
    ? google(modelId)
    : structuredProvider.chatModel(modelId)
}

/**
 * The selected model wrapped with its fallback chain (see `getModelChain`).
 * `localCallOptions` apply to Ollama models only (e.g. `temperature: 0`).
 */
export function getModelWithFallback(
  modelId: string,
  {
    structured = false,
    localCallOptions,
    ...hooks
  }: FallbackHooks & {
    structured?: boolean
    localCallOptions?: FallbackEntry["callOptions"]
  } = {}
) {
  const make = structured ? getStructuredModel : getChatModel
  return createFallbackModel(
    getModelChain(modelId).map((id) => ({
      model: make(id),
      callOptions: isGoogleModel(id) ? undefined : localCallOptions,
    })),
    {
      ...hooks,
      onFallback: (info) => {
        console.warn("[ai] fallback", info.from, "→", info.to, info.error)
        hooks.onFallback?.(info)
      },
    }
  )
}
