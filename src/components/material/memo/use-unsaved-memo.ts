"use client"

import { memoUnsavedAtom } from "@/atoms/material_atoms";
import { useAtom } from "jotai";
import { useCallback, useEffect } from "react";

/**
 * Tracks unsaved memo edits for one material in `memoUnsavedAtom`, so tabs, sheets and the project
 * navigation can warn before the edits are lost. Also warns on reload / closing the browser tab.
 */
export const useUnsavedMemo = ( material_id: number ) => {

    const [ unsavedIds, setUnsavedIds ] = useAtom( memoUnsavedAtom );

    const dirty = unsavedIds.includes( material_id );

    const markDirty = useCallback( () => setUnsavedIds( ids => ids.includes( material_id ) ? ids : [ ...ids, material_id ] ), [ material_id, setUnsavedIds ] );

    const markSaved = useCallback( () => setUnsavedIds( ids => ids.filter( id => id !== material_id ) ), [ material_id, setUnsavedIds ] );

    // the edits are gone once the editor unmounts
    useEffect( () => () => setUnsavedIds( ids => ids.filter( id => id !== material_id ) ), [ material_id, setUnsavedIds ] );

    useEffect( () => {

        if( !dirty ) return;

        const handleBeforeUnload = ( e: BeforeUnloadEvent ) => e.preventDefault();

        window.addEventListener( "beforeunload", handleBeforeUnload );

        return () => window.removeEventListener( "beforeunload", handleBeforeUnload );

    }, [ dirty ] );

    return { dirty, markDirty, markSaved };

}

export const UNSAVED_MEMO_CONFIRM = "保存されていないメモの変更があります。破棄しますか？";
