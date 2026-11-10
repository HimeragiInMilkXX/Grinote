'use client'

import { MaterialArrangableColumns, MaterialFilterableColumns, MaterialPagination } from "@/types/materials"
import MaterialList from "@/components/material/material-list";
import { useCallback, useEffect, useRef, useState } from "react";
import Searchbar from "@/components/miscellaneous/search-bar";
import { useSetAtom } from "jotai";
import { isLoadingAtom } from "@/components/miscellaneous/loading-overlay";
import MaterialListOptionsPanel, { MaterialListOptionsPanelHandle } from "@/components/material/list-options/material-list-options-panel";
import { getProjectMaterials } from "@/app/project/[projectId]/materials/serverActions";

const MaterialListTab = ( { project_id }: { project_id: string }) => {

    const materialListOptionsPanelRef = useRef<MaterialListOptionsPanelHandle>(null);

    const [ materialPagination, setMaterialPagination ] = useState<MaterialPagination>();
    const [ searchQuery, setSearchQuery ] = useState("");

    const setIsLoading = useSetAtom( isLoadingAtom );

    const handleSearch = useCallback( async ( query: string = "", page: number = 1, pageSize: number = 10 ) => {

        try {

            setIsLoading(true)


            // Options(Filter, Arrange)
            if( !materialListOptionsPanelRef.current ) throw new Error( "Options not correctly fetched" );

            const { filter, arrange } = materialListOptionsPanelRef.current.getOptionsValues();

            // Arrange
            let orderList: Partial<Record<MaterialArrangableColumns, boolean>> = {};
            orderList[arrange.column] = arrange.direction === "asc";

            // Filter
            let filterList: Partial<Record<MaterialFilterableColumns, string>> = {};

            if( filter.enableFilterType ) filterList.type = filter.typeFilter;
            if( filter.enableFilterColor ) filterList.color = filter.colorFilter;
            if( filter.enableFilterLabel ) filterList.label = filter.labelFilter;

            // END OF OPTIONS


            const searchResult = await getProjectMaterials( project_id, query, page, pageSize, orderList, filterList )

            setMaterialPagination( searchResult )

        } finally {

            setSearchQuery( query );
            setIsLoading(false)

        }

    }, [ materialListOptionsPanelRef.current ])

    useEffect( () => {

        handleSearch()

    }, [])

    return (

        <div className="px-6 pb-6 rounded-xl shadow border flex flex-col gap-3 relative w-full max-w-full overflow-scroll scrollbar-none h-full">

            <div className="flex items-center gap-3 w-full sticky top-0 z-2 py-6 border-b bg-white">

                <Searchbar handleSearch={handleSearch} className="grow"/>
                <MaterialListOptionsPanel project_id={project_id} ref={materialListOptionsPanelRef}/>

            </div>

            <MaterialList materials={materialPagination?.materials}/>

        </div>

    )

}

export default MaterialListTab
