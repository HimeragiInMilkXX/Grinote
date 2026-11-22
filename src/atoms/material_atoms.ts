import { atom } from "jotai";

/** Bumped whenever materials change (create/favourite/pin/link/delete) so lists reload. */
export const materialListVersionAtom = atom<number>( 0 );

/** Files dropped onto the material list; the create dialog consumes them. */
export const materialCreateQueueAtom = atom<File[] | null>( null );

/** An AI memo draft waiting to be written into a material's memo editor (not saved). */
export type MemoDraftRequest = { material_id: number, html: string, mode: "replace" | "append" };
export const memoDraftRequestAtom = atom<MemoDraftRequest | null>( null );

/** toolCallIds of propose_materials cards the user already accepted/rejected. */
export const materialProposalReviewedAtom = atom<string[]>( [] );

/** Material ids whose memo editor has unsaved changes (material ids are global, so no project scope needed). */
export const memoUnsavedAtom = atom<number[]>( [] );
