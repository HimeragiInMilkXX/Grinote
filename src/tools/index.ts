import {
  type FinishReason,
  type InferUITools,
  type UIDataTypes,
  type UIMessage,
} from "ai"

import { askUser } from "./ask_user"
import { githubRepo } from "./github_repo"
import { webSearch } from "./web_search"
import { proposeGoalTree } from "./propose_goal_tree"
import { getProjectInformation } from "./get_project_info"
import { getGraphInformation } from "./get_graph_info"
import { listMaterials } from "./list_materials"
import { readMaterial } from "./read_material"
import { proposeMaterials } from "./propose_materials"
import { draftMemo } from "./draft_memo"
import { listJourney } from "./list_journey"
import { readJourneyEntry } from "./read_journey_entry"
import { listSchedule } from "./list_schedule"
import { proposeSchedule } from "./propose_schedule"

const baseTools = {
  github_repo: githubRepo,
  ask_user: askUser,
  web_search: webSearch,
  propose_goal_tree: proposeGoalTree,
  get_project_info: getProjectInformation,
  get_graph_info: getGraphInformation,
  list_materials: listMaterials,
  read_material: readMaterial,
  propose_materials: proposeMaterials,
  draft_memo: draftMemo,
  list_journey: listJourney,
  read_journey_entry: readJourneyEntry,
  list_schedule: listSchedule,
  propose_schedule: proposeSchedule,
}

export function getTools(modelId: string) {
  return baseTools
}

export type ChatUIMessage = UIMessage<
  {
    // Milliseconds per reasoning part, keyed by its index in the message.
    reasoningDurations?: Record<number, number>
    // Set by the route when the turn ends; missing means the stream was cut off.
    finishReason?: FinishReason
    // The model returned only reasoning, so the route nudged it once more.
    autoRetried?: boolean
    // Set when a fallback model answered instead of the selected one.
    answeredBy?: string
  },
  UIDataTypes,
  InferUITools<typeof baseTools>
>

export type ChatMessagePart = ChatUIMessage["parts"][number]

export type TextMessagePart = Extract<ChatMessagePart, { type: "text" }>

export type ReasoningMessagePart = Extract<
  ChatMessagePart,
  { type: "reasoning" }
>

export type SourceUrlPart = Extract<ChatMessagePart, { type: "source-url" }>

export type GithubRepoToolPart = Extract<
  ChatMessagePart,
  { type: "tool-github_repo" }
>

export type AskUserToolPart = Extract<
  ChatMessagePart,
  { type: "tool-ask_user" }
>

export type WebSearchToolPart = Extract<
  ChatMessagePart,
  { type: "tool-web_search" }
>

export type ProposeGoalTreeToolPart = Extract<
  ChatUIMessage["parts"][number],
  { type: "tool-propose_goal_tree" }
>

export type GetProjectInfoToolPart = Extract<
  ChatMessagePart,
  { type: "tool-get_project_info"}
>

export type GetGraphInfoToolPart = Extract<
  ChatMessagePart,
  { type: "tool-get_graph_info"}
>

export type ListMaterialsToolPart = Extract<
  ChatMessagePart,
  { type: "tool-list_materials" }
>

export type ReadMaterialToolPart = Extract<
  ChatMessagePart,
  { type: "tool-read_material" }
>

export type ProposeMaterialsToolPart = Extract<
  ChatMessagePart,
  { type: "tool-propose_materials" }
>

export type DraftMemoToolPart = Extract<
  ChatMessagePart,
  { type: "tool-draft_memo" }
>

export type ListJourneyToolPart = Extract<
  ChatMessagePart,
  { type: "tool-list_journey" }
>

export type ReadJourneyEntryToolPart = Extract<
  ChatMessagePart,
  { type: "tool-read_journey_entry" }
>

export type ListScheduleToolPart = Extract<
  ChatMessagePart,
  { type: "tool-list_schedule" }
>

export type ProposeScheduleToolPart = Extract<
  ChatMessagePart,
  { type: "tool-propose_schedule" }
>
