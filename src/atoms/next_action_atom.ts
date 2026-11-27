import { atom } from "jotai";
import type { PlanItemRole } from "@/lib/next-action/types";

/**
 * Tree nodes that are part of the saved next action (node id → role), for the highlight in
 * TaskNode. Display only: never part of the node data, so it is never saved with the tree.
 */
export const nextActionHighlightAtom = atom<Record<string, PlanItemRole>>( {} );
