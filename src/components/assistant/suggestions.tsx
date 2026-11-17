"use client"

import { Button } from "@/components/ui/button"

const suggestions = [
  {
    label: "Break down my goal",
    prompt: "Let's work on breaking down my large goal!",
  },
  {
    label: "Details of the project",
    prompt: "Digest the details of this project, also suggest me some improvements to the settings to maximize productivity"
  },
  {
    label: "Analysis of graph",
    prompt: "Analyze my current breakdown and graph for me"
  }
]

export function Suggestions({
  onSelect,
}: {
  onSelect: (prompt: string) => void
}) {
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {suggestions.map((suggestion) => (
        <Button
          key={suggestion.label}
          variant="outline"
          size="sm"
          onClick={() => onSelect(suggestion.prompt)}
        >
          {suggestion.label}
        </Button>
      ))}
    </div>
  )
}
