export const MODELS = [
  { id: "gemma4:12b", name: "Gemma 4" },
  { id: "qwen3.5:9b", name: "Qwen 3.5" },
]

export const DEFAULT_MODEL = MODELS[0].id

export interface GatewayModel {
  id: string
  name: string
}

export function isModelAllowed(id: string) {
  return MODELS.some((model) => model.id === id)
}
