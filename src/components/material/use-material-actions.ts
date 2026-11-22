"use client"

import { setMaterialFavourite, setMaterialPinned } from "@/app/project/[projectId]/materials/serverActions";
import { materialListVersionAtom } from "@/atoms/material_atoms";
import { Material } from "@/types/materials";
import { useSetAtom } from "jotai";
import { toast } from "sonner";

type Flags = Pick<Material, "id" | "project_id" | "is_favourite" | "pinned_at">;

/** Favourite / pin toggles shared by rows, context menus and the viewer header. Returns the new value, or null on failure. */
export const useMaterialActions = () => {

    const bumpVersion = useSetAtom( materialListVersionAtom );

    const toggleFavourite = async ( material: Flags ): Promise<boolean | null> => {

        try {
            await setMaterialFavourite( material.project_id, material.id, !material.is_favourite );
            bumpVersion( v => v + 1 );
            return !material.is_favourite;
        } catch( e ) {
            toast.error( String( e ) );
            return null;
        }

    }

    const togglePin = async ( material: Flags ): Promise<string | null | false> => {

        try {
            const pinned = !material.pinned_at;
            const res = await setMaterialPinned( material.project_id, material.id, pinned );
            if( !res.ok ) { toast.warning( res.message ); return false; }
            bumpVersion( v => v + 1 );
            return pinned ? new Date().toISOString() : null;
        } catch( e ) {
            toast.error( String( e ) );
            return false;
        }

    }

    return { toggleFavourite, togglePin, bumpVersion };

}
