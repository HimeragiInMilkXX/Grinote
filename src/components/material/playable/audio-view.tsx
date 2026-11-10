"use client"

import { useState, useEffect, useMemo } from "react";

import WavesurferPlayer from '@wavesurfer/react'
import WaveSurfer from "wavesurfer.js";
import Timeline from 'wavesurfer.js/dist/plugins/timeline.esm.js'

import { Slider } from "@/components/ui/slider"
import { Button } from "@/components/ui/button";
import { Pause, Play, Volume1, Volume2, VolumeOff, ZoomIn } from "lucide-react";
import { cn } from "cn";

const AudioView = ( { src, className = "" }: { src: string, className?: string } ) => {


    const [ wavesurfer, setWavesurfer ] = useState<WaveSurfer | null>(null);
    const [ isPlaying, setIsPlaying ] = useState(false);

    const onReady = ( ws: WaveSurfer ) => {

        setWavesurfer( ws )
        setIsPlaying(false)

    }

    const onPlayPause = () => {

        wavesurfer && wavesurfer.playPause();

    }

    const plugins = useMemo( () => {

        return [
            Timeline.create({ container: '#audio-view-timeline' })
        ]

    }, [])

    // Zoom
    const [ minPxPerSec, setMinPxPerSec ] = useState(0);

    useEffect( () => {

        wavesurfer?.zoom(minPxPerSec)

    }, [ minPxPerSec ])

    // Volume
    const [ volume, setVolume ] = useState(0.5);

    useEffect( () => {

        wavesurfer?.setVolume(volume);

    }, [ volume, wavesurfer ])

    return (

        <>
            <div className="w-full flex justify-between px-3 items-center sticky top-0 z-2 bg-white py-6 border-b">
                <h3 className="text-2xl"> マテリアル名 </h3>
                {/* Play */}
                <Button variant="ghost" className={`${ isPlaying ? "bg-red-300 hover:bg-red-400" : "bg-green-300 hover:bg-green-400"} py-3 px-4.5`} onClick={onPlayPause}> { isPlaying ? <div className="flex items-center gap-1.5 leading-tight">Pause <Pause/></div> : <div className="flex items-center gap-1.5 leading-tight">Play <Play/></div> } </Button>
            </div>
            <div className={cn( className, "flex flex-col gap-3 w-full" )}>
                <div className="flex flex-col gap-6 pb-3 overflow-auto py-6 min-h-fit max-w-full">
                    <WavesurferPlayer
                        height={100}
                        waveColor="black"
                        plugins={plugins}
                        url={src}
                        onReady={onReady}
                        onPlay={() => setIsPlaying(true)}
                        onPause={() => setIsPlaying(false)}
                    />
                    <div id="audio-view-timeline"/>
                    <div className="items-center flex justify-between ">
                        {/* Volume */}
                        <div className="flex items-center gap-1.5 grow-[0.3]">
                                {
                                    volume >= 0.5 ? <Volume2 size={16}/> :
                                    volume > 0 ? <Volume1 size={16}/> :
                                    <VolumeOff size={16}/>
                                }
                                <Slider value={[volume]} max={1} onValueChange={(value: number) => setVolume(value)} step={0.01} className="grow"/>
                        </div>
                        {/* Zoom */}
                        <div className="flex items-center grow-[0.2] gap-1.5">
                            <ZoomIn size={16}/>
                            <Slider value={[minPxPerSec]} max={400} onValueChange={(value: number) => setMinPxPerSec(value)} step={1} className="grow"/>
                        </div>
                    </div>
                </div>
            </div>
        </>
    )

}

export default AudioView
