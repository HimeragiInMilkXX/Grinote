"use client"

import { atom } from "jotai";

/** The settings form has unsaved edits (read by the project navigation's leave guard). */
export const projectSettingsDirtyAtom = atom<boolean>( false );
