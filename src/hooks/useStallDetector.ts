import * as React from "react"

// Flags a reply as stalled when `signature` (a fingerprint of the streaming
// message) hasn't changed for `ms` while `active`. Nothing is aborted; the UI
// just offers to stop and retry.
export function useStallDetector(
  signature: string,
  active: boolean,
  ms = 45_000
) {
  const [stalledSignature, setStalledSignature] = React.useState<string | null>(
    null
  )
  const [restarts, setRestarts] = React.useState(0)

  React.useEffect(() => {
    if (!active) {
      // A new request may start with the same signature; don't carry it over.
      setStalledSignature(null)
      return
    }
    const timeout = setTimeout(() => setStalledSignature(signature), ms)
    return () => clearTimeout(timeout)
  }, [signature, active, ms, restarts])

  const isStalled = active && stalledSignature === signature

  const dismiss = React.useCallback(() => {
    setStalledSignature(null)
    setRestarts((count) => count + 1)
  }, [])

  return { isStalled, dismiss }
}
