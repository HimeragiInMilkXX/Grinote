import type { TreeChangeOps } from "@/lib/tree/tree-changes";
import { atom } from "jotai";

/** An accepted AI proposal waiting to be applied in the tree editor. Nothing is saved until the tree is saved. */
export type GraphEditRequest = {

    project_id: string;
    goal: string;
    ops: TreeChangeOps;
    /** Repeating tasks with progress that the user allowed the proposal to change. */
    allowedProtectedIds: string[];
    /** Warnings from drafting, e.g. work records that deleting will remove. */
    warnings: string[];

}

export const graphEditRequestAtom = atom<GraphEditRequest | null>(null);
