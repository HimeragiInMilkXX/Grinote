"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

type Theme = "light" | "dark"
type ThemePreference = Theme | "system"

const STORAGE_KEY = "assistant-theme"
const ThemeContext = React.createContext({
  resolvedTheme: "light" as Theme,
  fontClassName: "",
})

export function ThemeProvider({
  children,
  fontClassName,
}: {
  children: React.ReactNode
  fontClassName: string
}) {
  const [preference, setPreference] = React.useState<ThemePreference>("system")
  const [systemDark, setSystemDark] = React.useState(false)
  const resolvedTheme =
    preference === "system" ? (systemDark ? "dark" : "light") : preference

  React.useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)")
    setSystemDark(media.matches)

    try {
      const stored = window.localStorage.getItem(STORAGE_KEY)
      if (stored === "light" || stored === "dark" || stored === "system") {
        setPreference(stored)
      }
    } catch {
      // System preference remains available when storage is disabled.
    }

    function onSystemChange(event: MediaQueryListEvent) {
      setSystemDark(event.matches)
    }

    function onStorage(event: StorageEvent) {
      if (event.key === STORAGE_KEY || event.key === null) {
        setPreference(
          event.newValue === "light" || event.newValue === "dark"
            ? event.newValue
            : "system"
        )
      }
    }

    media.addEventListener("change", onSystemChange)
    window.addEventListener("storage", onStorage)
    return () => {
      media.removeEventListener("change", onSystemChange)
      window.removeEventListener("storage", onStorage)
    }
  }, [])

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (
        event.defaultPrevented ||
        event.repeat ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        event.key.toLowerCase() !== "d"
      ) {
        return
      }

      const target = event.target
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
      ) {
        return
      }

      const next = resolvedTheme === "dark" ? "light" : "dark"
      setPreference(next)
      try {
        window.localStorage.setItem(STORAGE_KEY, next)
      } catch {
        // Keep the toggle working for this page when storage is unavailable.
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [resolvedTheme])

  return (
    <ThemeContext.Provider value={{ resolvedTheme, fontClassName }}>
      <div
        className={cn(
          "assistant-scope flex h-svh min-h-0 w-full flex-col bg-background font-sans text-foreground",
          fontClassName,
          resolvedTheme === "dark" && "dark"
        )}
        style={{ colorScheme: resolvedTheme }}
      >
        {children}
      </div>
    </ThemeContext.Provider>
  )
}

// Shared UI portals stay unchanged. Their render hooks place this theme scope
// around the actual popup, which retains every Base UI prop and its ref.
export function AssistantPopup(props: React.ComponentPropsWithRef<"div">) {
  const { resolvedTheme, fontClassName } = React.useContext(ThemeContext)

  return (
    <div
      className={cn(
        "assistant-scope contents",
        fontClassName,
        resolvedTheme === "dark" && "dark"
      )}
      style={{ colorScheme: resolvedTheme }}
    >
      <div {...props} />
    </div>
  )
}
