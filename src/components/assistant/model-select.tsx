"use client"

import * as React from "react"

import { type GatewayModel } from "@/lib/ai/models"
import { AssistantPopup } from "@/components/assistant/theme-provider"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export function ModelSelect({
  models,
  value,
  onValueChange,
}: {
  models: GatewayModel[]
  value: string
  onValueChange: (value: string) => void
}) {
  const items = React.useMemo(
    () => models.map((model) => ({ label: model.name, value: model.id })),
    [models]
  )

  // One labelled group per `group` (クラウド / ローカル（予備）), in list order.
  const groups = React.useMemo(() => {
    const byGroup = new Map<string, GatewayModel[]>()
    for (const model of models) {
      byGroup.set(model.group, [...(byGroup.get(model.group) ?? []), model])
    }
    return [...byGroup]
  }, [models])

  return (
    <Select
      items={items}
      value={value}
      onValueChange={(next) => {
        if (typeof next === "string") onValueChange(next)
      }}
    >
      <SelectTrigger aria-label="Model" className="bg-background">
        <SelectValue />
      </SelectTrigger>
      <SelectContent
        alignItemWithTrigger={false}
        render={(props) => <AssistantPopup {...props} />}
      >
        {groups.map(([group, groupModels]) => (
          <SelectGroup key={group}>
            {groups.length > 1 && <SelectLabel>{group}</SelectLabel>}
            {groupModels.map((model) => (
              <SelectItem key={model.id} value={model.id}>
                {model.name}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  )
}
