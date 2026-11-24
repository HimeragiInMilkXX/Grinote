// Client-safe model list (no env reads here; see provider.ts for availability).

export type ModelProvider = "google" | "ollama"

export interface GatewayModel {
  id: string
  name: string
  provider: ModelProvider
  /** Heading in the model picker. */
  group: string
}

export const CLOUD_GROUP = "クラウド"
export const LOCAL_GROUP = "ローカル（予備）"

export const MODELS: GatewayModel[] = [
  { id: "gemini-4-hydrogen", name: "Gemini 4 Hydrogen", provider: "google", group: CLOUD_GROUP },
  { id: "gpt-oss:20b", name: "GPT-OSS 20B", provider: "ollama", group: LOCAL_GROUP },
  { id: "qwen3.5:9b", name: "Qwen 3.5", provider: "ollama", group: LOCAL_GROUP },
  { id: "gemma4:12b", name: "Gemma 4", provider: "ollama", group: LOCAL_GROUP },
]

export const DEFAULT_MODEL = MODELS[0].id

/** Tried in this order when a cloud model fails before answering. */
export const FALLBACK_MODEL_IDS = ["gpt-oss:20b", "qwen3.5:9b", "gemma4:12b"]

export function getModelInfo(id: string): GatewayModel | undefined {
  return MODELS.find((model) => model.id === id)
}

export function isModelAllowed(id: string) {
  return MODELS.some((model) => model.id === id)
}
