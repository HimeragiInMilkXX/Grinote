'use client'

import { Tabs, TabsContent, TabsList } from "../ui/tabs"
import MaterialListTab from "./material-list-tab";
import { atom, useAtom, useSetAtom } from "jotai";
import { useEffect } from "react";
import { assistantPageContextAtom } from "@/atoms/assistant_page_context_atom";
import { memoUnsavedAtom } from "@/atoms/material_atoms";
import { UNSAVED_MEMO_CONFIRM } from "./memo/use-unsaved-memo";
import { useAtomValue } from "jotai";
import MaterialItemTab from "./material-item-tab";
import MaterialTabTrigger from "./material-tab-trigger";
import { Home } from "lucide-react";
import MaterialCreatePanel from "./create/material-create-panel";

export const openedMaterialTabsAtom = atom<{ id: number, name: string }[]>([

]);

export const currentMaterialTabAtom = atom<string>("list")

const MaterialTabs = ( { project_id }: { project_id: string }) => {

    const [ openedTabs, setOpenedTabs ] = useAtom(openedMaterialTabsAtom)

    const [ currentTab, setCurrentTab ] = useAtom(currentMaterialTabAtom);

    // tell the assistant which material is open
    const setPageContext = useSetAtom( assistantPageContextAtom );

    useEffect( () => {

        setPageContext( { page: "materials", material_id: currentTab === "list" ? undefined : Number( currentTab ) } );

    }, [ currentTab, setPageContext ] );

    useEffect( () => () => setPageContext( { page: "other" } ), [ setPageContext ] );

    const unsavedMemoIds = useAtomValue( memoUnsavedAtom );

    const closeTab = ( id: number ) => {

        if( unsavedMemoIds.includes( id ) && !window.confirm( UNSAVED_MEMO_CONFIRM ) ) return;

        setOpenedTabs( ot => ot.filter( tab => tab.id != id ) );
        setCurrentTab( "list" )

    }

    return (
        <Tabs className="flex-row-reverse p-6 gap-0 h-screen" orientation="vertical" value={currentTab} onValueChange={setCurrentTab}>
            <TabsList className="bg-transparent! gap-3 p-0! h-full! relative justify-between">

                <div className="max-h-full pb-12">
                    <div className="flex flex-col overflow-scroll scrollbar-none max-h-full box-border">
                        { openedTabs?.map( ( { id, name } ) => <MaterialTabTrigger closeTab={closeTab} value={String(id)} key={id} label={name} unsaved={unsavedMemoIds.includes( id )}/> )}
                    </div>
                </div>

                <div className="flex flex-col">

                    <MaterialCreatePanel project_id={project_id}/>
                    <MaterialTabTrigger value="list" label={ <Home size={16}/> }/>

                </div>

            </TabsList>

            <TabsContent value="list" className="grow">
                <MaterialListTab project_id={project_id} />
            </TabsContent>
            {openedTabs?.map(({ id }) => <MaterialItemTab key={project_id + id} material_id={id} project_id={project_id} className="grow" />)}

        </Tabs>
    )
}

export default MaterialTabs
