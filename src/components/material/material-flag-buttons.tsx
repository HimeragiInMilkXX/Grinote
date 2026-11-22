"use client"

import { Heart, Pin } from "lucide-react"
import { cn } from "@/lib/utils"

/** Heart (favourite) and pin icon buttons. */
export const MaterialFlagButtons = ( { isFavourite, isPinned, onFavourite, onPin, size = 16, className = "" }: {
    isFavourite: boolean,
    isPinned: boolean,
    onFavourite: () => void,
    onPin: () => void,
    size?: number,
    className?: string,
} ) => (
    <div className={cn( "flex items-center gap-1", className )}>
        <button type="button" title={isFavourite ? "お気に入り解除" : "お気に入り"} aria-pressed={isFavourite}
            onClick={e => { e.stopPropagation(); onFavourite(); }}
            className="p-1 rounded hover:bg-muted cursor-pointer">
            <Heart size={size} className={cn( isFavourite ? "fill-red-500 text-red-500" : "text-muted-foreground" )} />
        </button>
        <button type="button" title={isPinned ? "ピン留め解除" : "ピン留め"} aria-pressed={isPinned}
            onClick={e => { e.stopPropagation(); onPin(); }}
            className="p-1 rounded hover:bg-muted cursor-pointer">
            <Pin size={size} className={cn( isPinned ? "fill-blue-500 text-blue-500 rotate-45" : "text-muted-foreground" )} />
        </button>
    </div>
)
