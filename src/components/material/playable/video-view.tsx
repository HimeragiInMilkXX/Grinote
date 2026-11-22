"use client"

import { VideoPlayer } from '@videojs/react/video';
import { YouTubeVideo } from '@videojs/react/media/youtube-video';
import { VideoSkin } from '@/components/videojs/video/skin';
import { cn } from "cn";

const VideoView = ( { src, className = "", title }: { src: string, className?: string, title?: React.ReactNode } ) => {

    return (
        <>
            <div className="w-full flex justify-between px-3 items-center sticky top-0 z-2 bg-white py-6 border-b gap-3">
                { title ?? <h3 className="text-2xl"> マテリアル名 </h3> }
            </div>
            <div className={cn( className, "flex flex-col gap-3 w-full" )}>
                <div className="pb-3 overflow-auto max-w-full pt-3">
                    <VideoPlayer>
                        <VideoSkin className="aspect-video">
                            <YouTubeVideo src={src} />
                        </VideoSkin>
                    </VideoPlayer>
                </div>
            </div>
        </>
    )

}

export default VideoView
