"use client"

import { fetchPlayableMaterial, fetchReadonlyMaterial, getMaterial } from "@/app/project/[projectId]/materials/serverActions";
import { supported_audio_format } from "@/lib/file-formats";
import { Material } from "@/types/materials";
import { useEffect, useState } from "react";
import ExternalView from "./external/external-view";
import MaterialViewerHeader from "./material-viewer-header";
import MemoSection from "./memo/memo-section";
import MemoView from "./memo/memo-view";
import AudioView from "./playable/audio-view";
import VideoView from "./playable/video-view";
import ImageView from "./readonly/image-view";
import PdfView from "./readonly/pdf/pdf-view";

/** Renders any material by type, with the shared header and (for non-memo types) a memo section at the bottom. */
const MaterialViewer = ( { project_id, material_id, memoHeightClass }: { project_id: string, material_id: number, memoHeightClass?: string } ) => {

    const [ material, setMaterial ] = useState<Material | null>( null );
    const [ media, setMedia ] = useState<{ url: string, ext: string | undefined } | null>( null );
    const [ error, setError ] = useState<string | null>( null );

    useEffect( () => {

        let cancelled = false;

        setMaterial( null );
        setMedia( null );
        setError( null );

        getMaterial( project_id, material_id ).then( async res => {

            if( cancelled ) return;

            setMaterial( res );

            if( res.type === "readonlys" ) {
                const m = await fetchReadonlyMaterial( res );
                if( !cancelled ) setMedia( m );
            } else if( res.type === "playables" ) {
                const m = await fetchPlayableMaterial( res );
                if( !cancelled ) setMedia( m );
            }

        } ).catch( e => { if( !cancelled ) setError( String( e ) ) } );

        return () => { cancelled = true };

    }, [ project_id, material_id ] );

    if( error ) return <p className="p-6 text-red-500"> マテリアルを読み込めませんでした: { error } </p>;

    if( !material ) return <p className="p-6 text-muted-foreground"> 読み込み中… </p>;

    const title = <MaterialViewerHeader material={material} onChange={patch => setMaterial( m => m ? { ...m, ...patch } : m )} />;

    let view: React.ReactNode = null;

    switch( material.type ) {

        case "memos": return <MemoView material={material} title={title} heightClass={memoHeightClass} />;

        case "externals": view = <ExternalView src={material.link} title={title} />; break;

        case "readonlys":
            if( media ) view = media.ext === "pdf" ? <PdfView src={media.url} title={title} /> : <ImageView src={media.url} title={title} />;
            break;

        case "playables":
            if( media ) view = supported_audio_format.includes( media.ext ?? "" ) ? <AudioView src={media.url} title={title} /> : <VideoView src={media.url} title={title} />;
            break;

    }

    return (
        <>
            { view ?? <p className="p-6 text-muted-foreground"> 読み込み中… </p> }
            <MemoSection material={material} heightClass={memoHeightClass} />
        </>
    );

}

export default MaterialViewer
