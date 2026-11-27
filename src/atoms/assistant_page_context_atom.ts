import { atom } from "jotai";

/** What the user is looking at, sent to the assistant so "this memo" / "this task" resolve. */
export type AssistantPageContext = {
    page: "materials" | "onair" | "tree" | "schedule" | "other",
    material_id?: number,
    node_id?: string,
    /** schedule page: the day the user has open ("YYYY-MM-DD") */
    day?: string,
};

export const assistantPageContextAtom = atom<AssistantPageContext>( { page: "other" } );
