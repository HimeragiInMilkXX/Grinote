"use client"

import { useEffect, useState } from "react";
import { cn } from "cn";
import Lightbox from "yet-another-react-lightbox";

// Import core lightbox styles
import "yet-another-react-lightbox/styles.css";

// Import Zoom and Rotate plugins
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import Rotate from "yet-another-react-lightbox/plugins/rotate";
import Inline from "yet-another-react-lightbox/plugins/inline";
import { buttonVariants } from "@/components/ui/button";
import { Download } from "lucide-react";

const ImageView = ( { src, alt = 'image', className = "" }: { src: string, alt?: string, className?: string } ) => {

    return (

        <>
            <div className="w-full flex justify-between px-3 items-center sticky top-0 z-2 bg-white py-6 border-b">
                <h3 className="text-2xl"> マテリアル名 </h3>
                <a className={cn( buttonVariants({variant: "ghost"}), "bg-green-300! py-3 px-4.5" )} href={src} target="_blank" download> ダウンロード <Download/> </a>
            </div>
            <div className={cn( className, "flex flex-col gap-3 w-full h-full" )}>
                <Lightbox
                    slides={[{ src, alt }]}
                    plugins={[Inline, Zoom, Rotate]}
                    render={{
                        buttonPrev: () => null,
                        buttonNext: () => null,
                        buttonClose: () => null
                    }}
                    zoom={{
                        maxZoomPixelRatio: 5,
                        zoomInMultiplier: 2,
                        scrollToZoom: true,
                    }}
                    rotate={{
                        buttons: "both",
                    }}
                    styles={{ root: { "--yarl__color_backdrop": "rgba(0,0,0,0.02)" } }}
                    carousel={{ finite: true }}
                    controller={{ disableSwipeNavigation: true }}
                    className="min-w-200 min-h-150 h-full"
                />
            </div>
        </>

    )

}

export default ImageView
