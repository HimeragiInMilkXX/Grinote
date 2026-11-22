'use client'

import { Material, MaterialArrangableColumns, MaterialFilterableColumns, MaterialPagination } from "@/types/materials"
import MaterialList from "@/components/material/material-list";
import { useCallback, useEffect, useRef, useState } from "react";
import Searchbar from "@/components/miscellaneous/search-bar";
import { useAtomValue, useSetAtom } from "jotai";
import { isLoadingAtom } from "@/components/miscellaneous/loading-overlay";
import MaterialListOptionsPanel, { MaterialListOptionsPanelHandle } from "@/components/material/list-options/material-list-options-panel";
import { getPinnedMaterials, getProjectMaterials } from "@/app/project/[projectId]/materials/serverActions";
import { materialCreateQueueAtom, materialListVersionAtom } from "@/atoms/material_atoms";
import { MATERIAL_PIN_LIMIT } from "@/lib/materials/config";
import { Button } from "../ui/button";
import { ChevronLeft, ChevronRight, Heart, Pin, Upload } from "lucide-react";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 10;

const MaterialListTab = ( { project_id }: { project_id: string }) => {

    const materialListOptionsPanelRef = useRef<MaterialListOptionsPanelHandle>(null);

    const [ materialPagination, setMaterialPagination ] = useState<MaterialPagination>();
    const [ pinned, setPinned ] = useState<Material[]>( [] );
    const [ searchQuery, setSearchQuery ] = useState("");
    const [ page, setPage ] = useState( 1 );
    const [ favouriteOnly, setFavouriteOnly ] = useState( false );
    const [ isDragging, setIsDragging ] = useState( false );

    const setIsLoading = useSetAtom( isLoadingAtom );
    const setCreateQueue = useSetAtom( materialCreateQueueAtom );
    const version = useAtomValue( materialListVersionAtom );

    const handleSearch = useCallback( async ( query: string = "", nextPage: number = 1, pageSize: number = PAGE_SIZE ) => {

        try {

            setIsLoading(true)


            // Options(Filter, Arrange)
            if( !materialListOptionsPanelRef.current ) throw new Error( "Options not correctly fetched" );

            const { filter, arrange } = materialListOptionsPanelRef.current.getOptionsValues();

            // Arrange
            const orderList: Partial<Record<MaterialArrangableColumns, boolean>> = { [arrange.column]: arrange.direction === "asc" };

            // Filter
            const filterList: Partial<Record<MaterialFilterableColumns, string>> = {};

            if( filter.enableFilterType ) filterList.type = filter.typeFilter;
            if( filter.enableFilterColor ) filterList.color = filter.colorFilter;
            if( filter.enableFilterLabel ) filterList.label = filter.labelFilter;

            // END OF OPTIONS


            const [ searchResult, pinnedResult ] = await Promise.all( [
                getProjectMaterials( project_id, query, nextPage, pageSize, orderList, filterList, { favouriteOnly } ),
                getPinnedMaterials( project_id ),
            ] );

            setMaterialPagination( searchResult )
            setPinned( pinnedResult )
            setPage( nextPage )

        } finally {

            setSearchQuery( query );
            setIsLoading(false)

        }

    }, [ project_id, setIsLoading, favouriteOnly ])

    // Re-run the last search (keeps the current query and page) e.g. after editing/deleting a row
    const reloadList = useCallback( () => handleSearch( searchQuery, page ), [ handleSearch, searchQuery, page ] )

    // initial load + whenever the favourite filter changes
    useEffect( () => {

        handleSearch( searchQuery )

    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ handleSearch ])

    // reload when materials change elsewhere (favourite/pin/link/create/delete)
    useEffect( () => {

        if( version === 0 ) return;

        reloadList();

    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ version ])

    // ---- drag & drop files to create materials ----
    const hasFiles = ( e: React.DragEvent ) => Array.from( e.dataTransfer.types ).includes( "Files" );

    const onDragOver = ( e: React.DragEvent ) => {
        if( !hasFiles( e ) ) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        setIsDragging( true );
    }

    const onDragLeave = ( e: React.DragEvent ) => {
        // ignore leave events fired when moving between children
        if( e.currentTarget.contains( e.relatedTarget as Node | null ) ) return;
        setIsDragging( false );
    }

    const onDrop = ( e: React.DragEvent ) => {
        if( !hasFiles( e ) ) return;
        e.preventDefault();
        setIsDragging( false );
        const files = Array.from( e.dataTransfer.files );
        if( files.length > 0 ) setCreateQueue( files );
    }

    const totalPages = materialPagination?.totalPages ?? 1;

    return (

        <div className="px-6 pb-6 rounded-xl shadow border flex flex-col gap-3 relative w-full max-w-full overflow-scroll scrollbar-none h-full"
            onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>

            { isDragging && (
                <div className="absolute inset-0 z-10 bg-yellow-100/80 border-4 border-dashed border-yellow-400 rounded-xl flex flex-col items-center justify-center gap-3 pointer-events-none">
                    <Upload size={48}/>
                    <p className="text-lg font-medium"> ドロップしてマテリアルを作成 </p>
                </div>
            ) }

            <div className="flex items-center gap-3 w-full sticky top-0 z-2 py-6 border-b bg-white">

                <Searchbar handleSearch={handleSearch} className="grow"/>
                <Button variant="ghost" aria-pressed={favouriteOnly} title="お気に入りのみ表示"
                    className={cn( "py-4 px-3 flex items-center gap-1.5 border", favouriteOnly && "bg-red-100 border-red-300" )}
                    onClick={() => setFavouriteOnly( f => !f )}>
                    <Heart size={14} className={cn( favouriteOnly && "fill-red-500 text-red-500" )}/> お気に入り
                </Button>
                <MaterialListOptionsPanel project_id={project_id} ref={materialListOptionsPanelRef} version={version}/>

            </div>

            { pinned.length > 0 && (
                <section className="flex flex-col gap-1.5">
                    <h4 className="text-sm font-medium flex items-center gap-1.5 text-muted-foreground"> <Pin size={14}/> ピン留め（{pinned.length}/{MATERIAL_PIN_LIMIT}） </h4>
                    <MaterialList materials={pinned} reloadList={reloadList} className="bg-blue-50/50 rounded-md"/>
                </section>
            ) }

            <MaterialList materials={materialPagination?.materials ?? []} reloadList={reloadList}/>

            { materialPagination && materialPagination.materials.length === 0 && pinned.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6"> マテリアルがありません。ファイルをここにドロップするか「＋」から作成できます。 </p>
            ) }

            { totalPages > 1 && (
                <div className="flex items-center justify-center gap-3">
                    <Button variant="outline" size="icon" disabled={page <= 1} onClick={() => handleSearch( searchQuery, page - 1 )}> <ChevronLeft/> </Button>
                    <span className="text-sm"> { page } / { totalPages } </span>
                    <Button variant="outline" size="icon" disabled={page >= totalPages} onClick={() => handleSearch( searchQuery, page + 1 )}> <ChevronRight/> </Button>
                </div>
            ) }

        </div>

    )

}

export default MaterialListTab
