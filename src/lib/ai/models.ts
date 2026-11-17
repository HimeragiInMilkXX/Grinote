export const MODELS = [
  { id: "qwen3.5:9b", name: "Qwen 3.5" },
  { id: "llama3.1:8b", name: "Llama 3.1" },
]

export const DEFAULT_MODEL = MODELS[0].id

export interface GatewayModel {
  id: string
  name: string
}

export function isModelAllowed(id: string) {
  return MODELS.some((model) => model.id === id)
}
