import type {
  LanguageModelV4,
  LanguageModelV4CallOptions,
  LanguageModelV4StreamPart,
} from "@ai-sdk/provider"

export interface FallbackEntry {
  model: LanguageModelV4
  /** Per-model overrides (e.g. `temperature: 0` only for local models). */
  callOptions?: Partial<LanguageModelV4CallOptions>
}

export interface FallbackHooks {
  /** A model failed before answering and the next one is tried. */
  onFallback?: (info: { from: string; to: string; error: unknown }) => void
  /** A model started answering (called once per model call). */
  onModel?: (modelId: string) => void
}

// Parts that come before any real output; an error right after them still
// means the model never answered.
const LEADING_PARTS = new Set<LanguageModelV4StreamPart["type"]>([
  "stream-start",
  "response-metadata",
])

/**
 * One LanguageModel that tries each entry in order. It moves on only when a
 * model fails before producing output (HTTP error, bad key, quota, unknown
 * model, or an error as the first stream part); once output has started it
 * never switches. The model that worked is tried first on later calls (later
 * tool steps of the same reply).
 */
export function createFallbackModel(
  entries: FallbackEntry[],
  hooks: FallbackHooks = {}
): LanguageModelV4 {
  if (entries.length === 0) throw new Error("createFallbackModel needs at least one model")

  let start = 0

  const optionsFor = (index: number, options: LanguageModelV4CallOptions) => ({
    ...options,
    ...entries[index].callOptions,
  })

  async function attempt<T>(
    options: LanguageModelV4CallOptions,
    call: (index: number) => Promise<T>
  ): Promise<T> {
    let lastError: unknown
    for (let index = start; index < entries.length; index++) {
      try {
        const result = await call(index)
        start = index
        hooks.onModel?.(entries[index].model.modelId)
        return result
      } catch (error) {
        lastError = error
        const next = entries[index + 1]
        if (options.abortSignal?.aborted || !next) throw error
        hooks.onFallback?.({
          from: entries[index].model.modelId,
          to: next.model.modelId,
          error,
        })
      }
    }
    throw lastError
  }

  const primary = entries[0].model

  return {
    specificationVersion: "v4",
    provider: primary.provider,
    modelId: primary.modelId,
    get supportedUrls() {
      return entries[start].model.supportedUrls
    },

    doGenerate(options) {
      return attempt(options, (index) =>
        Promise.resolve(entries[index].model.doGenerate(optionsFor(index, options)))
      )
    },

    doStream(options) {
      return attempt(options, async (index) => {
        const result = await entries[index].model.doStream(optionsFor(index, options))
        const reader = result.stream.getReader()

        // Hold the leading parts until the first real one shows up.
        const buffered: LanguageModelV4StreamPart[] = []
        let first: ReadableStreamReadResult<LanguageModelV4StreamPart>
        while (true) {
          first = await reader.read()
          if (first.done || !LEADING_PARTS.has(first.value.type)) break
          buffered.push(first.value)
        }

        if (!first.done && first.value.type === "error") {
          reader.cancel().catch(() => {})
          throw first.value.error
        }
        if (!first.done) buffered.push(first.value)
        const finished = first.done

        const stream = new ReadableStream<LanguageModelV4StreamPart>({
          start(controller) {
            for (const part of buffered) controller.enqueue(part)
            if (finished) controller.close()
          },
          async pull(controller) {
            if (finished) return
            const { done, value } = await reader.read()
            if (done) controller.close()
            else controller.enqueue(value)
          },
          cancel(reason) {
            return reader.cancel(reason)
          },
        })

        return { ...result, stream }
      })
    },
  }
}
