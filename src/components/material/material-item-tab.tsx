"use client"

import { fetchPlayableMaterial, fetchReadonlyMaterial, getMaterial } from "@/app/project/[projectId]/materials/serverActions";
import { Material } from "@/types/materials"
import { useEffect, useState } from "react"
import MemoView from "./memo/memo-view";
import ExternalView from "./external/external-view";
import PdfView from "./readonly/pdf/pdf-view";
import ImageView from "./readonly/image-view";
import { supported_audio_format } from "@/lib/file-formats";
import AudioView from "./playable/audio-view";
import VideoView from "./playable/video-view";
import { TabsContent } from "../ui/tabs";
import { cn } from "cn";

const MaterialItemTab = ( { className = '', project_id, material_id }: { className?: string, project_id: string, material_id: number } ) => {

    const [ material, setMaterial ] = useState<Material | null>(null);
    const [ renderView, setRenderView ] = useState<React.ReactNode>();

    useEffect( () => {

        getMaterial( project_id, material_id ).then( res => {

            setMaterial( res );

            switch( res.type ) {

                case "memos": setRenderView( <MemoView material={res}/>); break;
                case "externals": setRenderView( <ExternalView src={res.link}/> ); break;

                case "readonlys":
                    fetchReadonlyMaterial( res ).then( ( { url, ext } ) =>
                        setRenderView( ext === "pdf" ? <PdfView src={url}/> : <ImageView src={url}/> ));
                    break;

                case "playables":
                    fetchPlayableMaterial( res ).then( ( { url, ext } ) =>
                        setRenderView( supported_audio_format.includes(ext ?? "") ? <AudioView src={url}/> : <VideoView src={url}/> ) );
                    break;

            }

        } )

    }, [material_id])

    return (
        <TabsContent value={String(material_id)} className={cn(className, "px-6 pb-6 rounded-xl shadow border flex flex-col gap-3 relative w-full max-w-full overflow-scroll scrollbar-none")}>{renderView}</TabsContent>
    )
}

export default MaterialItemTab
