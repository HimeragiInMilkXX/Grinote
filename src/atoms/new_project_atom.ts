"use client";

import { intervalToSeconds } from "@/utils/utils";
import { atom, getDefaultStore } from "jotai";

export type NewProjectInformationDraft = {

    character_id?: number;
    final_goal?: string;
    achieve_date_goal?: Date;
    character_given_name?: string;
    description?: string;
    name?: string;
    daily_time_goal?: { hours: number, minutes: number, seconds: number };
    work_days?: number[];

}

export type NewProjectInformation = {

    character_id: number;
    final_goal: string;
    achieve_date_goal: Date;
    character_given_name: string;
    description?: string;
    name: string;
    daily_time_goal: { hours: number, minutes: number, seconds: number };
    work_days: number[];

}

const newProjectAtom = atom<NewProjectInformationDraft>({})

const store = getDefaultStore();

export const updateNewProjectAtomValue = ( value: Partial<NewProjectInformationDraft> ) => {

    store.set( newProjectAtom, { ...store.get( newProjectAtom ), ...value } )

}

export const clearNewProjectAtomValue = () => store.set( newProjectAtom, {} );

export const getNewProjectValueAtomValue = (): NewProjectInformationDraft => store.get( newProjectAtom ) ?? {};

export const isCompleteProjectInformation = ( draft: NewProjectInformationDraft ): draft is NewProjectInformation => {

    return (

        draft.character_id !== undefined &&

        draft.final_goal !== undefined &&
        draft.final_goal.trim() != "" &&

        draft.achieve_date_goal !== undefined &&

        draft.character_given_name !== undefined &&
        draft.character_given_name.trim() != "" &&

        draft.name !== undefined &&
        draft.name.trim() !== "" &&

        draft.daily_time_goal !== undefined &&
        intervalToSeconds( draft.daily_time_goal ) >= 120 &&

        draft.work_days !== undefined &&
        draft.work_days.length > 0

    )

}