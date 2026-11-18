import { tool } from "ai"
import { z } from "zod"

export const askUser = tool({
  description:
    "Display a questionnaire for essential missing information that materially changes the goal, scope, branch, or schedule. " +
    "Bundle questions into ONE call, preferably 1-3 questions, each with exactly 3 short, distinct choices. The user can also answer in their own words. " +
    "After calling, stop and WAIT for user answers in the tool output before making dependent plans or proposals. " +
    "Do not invent the output or ask again for information already in project tools or this conversation. " +
    "Do not use to approve a generated tree: propose_goal_tree already has its own review card.",
  inputSchema: z.object({
    questions: z
      .array(
        z.object({
          question: z.string().describe("The question to ask"),
          choices: z
            .array(z.string())
            .length(3)
            .describe("Exactly three short answer choices"),
        })
      )
      .min(1)
      .describe("The questions to ask the user"),
  }),
  outputSchema: z
    .array(z.object({ question: z.string(), answer: z.string() }))
    .describe("The user's answer to each question"),
})
