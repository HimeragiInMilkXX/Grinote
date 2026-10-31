"use client"

import { atom } from "jotai";

export const treeRequiresSaveActionAtom = atom<{ projectId: string | null, requiresSave: boolean }>({

    projectId: null,
    requiresSave: false

})