"use client"

import { projectSettingsDirtyAtom } from "@/atoms/project_settings_atoms";
import { useSetAtom } from "jotai";
import { useEffect } from "react";

/**
 * Mirrors the settings form's dirty state into `projectSettingsDirtyAtom` (so the project
 * navigation asks before leaving) and warns on reload / closing the browser tab.
 */
export const useUnsavedSettings = ( dirty: boolean ) => {

    const setDirty = useSetAtom( projectSettingsDirtyAtom );

    useEffect( () => { setDirty( dirty ) }, [ dirty, setDirty ] );

    // the edits are gone once the page unmounts
    useEffect( () => () => setDirty( false ), [ setDirty ] );

    useEffect( () => {

        if( !dirty ) return;

        const handleBeforeUnload = ( e: BeforeUnloadEvent ) => e.preventDefault();

        window.addEventListener( "beforeunload", handleBeforeUnload );

        return () => window.removeEventListener( "beforeunload", handleBeforeUnload );

    }, [ dirty ] );

}
