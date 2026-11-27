import { atom } from "jotai";
import type { ScheduleHighlight } from "@/lib/schedule/types";

/**
 * Tree nodes with pending schedule entries today (node id → highlight), for TaskNode.
 * Display only: never part of the node data, so it is never saved with the tree.
 */
export const scheduleTodayHighlightAtom = atom<Record<string, ScheduleHighlight>>( {} );

/** toolCallIds of propose_schedule cards the user accepted or dismissed (cards hide once reviewed). */
export const scheduleProposalReviewedAtom = atom<string[]>( [] );

/** Bumped after the schedule changes outside the schedule page (e.g. the assistant's card), so open views reload. */
export const scheduleVersionAtom = atom( 0 );
