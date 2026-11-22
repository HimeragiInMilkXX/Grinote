import { atom } from "jotai";

/** What the user is looking at, sent to the assistant so "this memo" / "this task" resolve. */
export type AssistantPageContext = {
    page: "materials" | "onair" | "tree" | "other",
    material_id?: number,
    node_id?: string,
};

export const assistantPageContextAtom = atom<AssistantPageContext>( { page: "other" } );
