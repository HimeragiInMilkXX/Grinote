"use client"

import { PROJECT_COLORS, projectColorStyle, type ProjectColor } from "@/lib/projects/colors";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { useRef, type KeyboardEvent } from "react";

type Props = {
    value: ProjectColor | undefined;
    onChange: ( value: ProjectColor ) => void;
    disabled?: boolean;
    id?: string;
    "aria-invalid"?: boolean;
    "aria-labelledby"?: string;
};

/** Swatch radio group over the preset project palette (src/lib/projects/colors.ts). */
const ProjectColorPicker = ( { value, onChange, disabled = false, id, ...aria }: Props ) => {

    const refs = useRef<( HTMLButtonElement | null )[]>( [] );
    const selectedIndex = Math.max( 0, PROJECT_COLORS.findIndex( c => c.key === value ) );

    const move = ( e: KeyboardEvent, index: number ) => {

        const delta = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
        if( delta === 0 ) return;

        e.preventDefault();
        const next = ( index + delta + PROJECT_COLORS.length ) % PROJECT_COLORS.length;
        onChange( PROJECT_COLORS[ next ].key );
        refs.current[ next ]?.focus();

    };

    return (

        <div className="flex flex-col gap-2">

            <div id={id} role="radiogroup" aria-disabled={disabled} className="flex flex-wrap gap-2" { ...aria }>

                { PROJECT_COLORS.map( ( color, index ) => {

                    const selected = color.key === value;

                    return (
                        <button
                            key={color.key}
                            ref={ el => { refs.current[ index ] = el } }
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            aria-label={color.label}
                            title={color.label}
                            disabled={disabled}
                            tabIndex={ index === selectedIndex ? 0 : -1 }
                            onClick={ () => onChange( color.key ) }
                            onKeyDown={ e => move( e, index ) }
                            className={cn(
                                "size-8 rounded-full grid place-items-center text-white transition-all outline-none",
                                "focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-default",
                                color.dot,
                                selected ? "ring-2 ring-offset-2 ring-foreground/70" : "hover:scale-110 disabled:hover:scale-100",
                                disabled && !selected && "opacity-40",
                            )}
                        >
                            { selected && <Check size={16} strokeWidth={3}/> }
                        </button>
                    );

                })}

            </div>

            <span className="text-xs text-muted-foreground"> 選択中: { value ? projectColorStyle( value ).label : "未選択" } </span>

        </div>

    );

};

export default ProjectColorPicker;
