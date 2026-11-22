'use client'

import React, { useState, useEffect } from 'react'
import { ChainedCommands, Editor } from '@tiptap/core'
import Control from './Control'
import Separator from './Separater'
import {
    Bold, Italic, Underline, Strikethrough, Code,
    Heading1, Heading2, Heading3, Heading4, Heading5, Heading6, Heading,
    List, ListOrdered, AlignLeft, AlignCenter, AlignRight, AlignJustify,
    Subscript as SubscriptIcon, Superscript as SuperscriptIcon,
    Quote, Link as LinkIcon, Image, Table, Undo, Redo,
    ALargeSmall, ChevronDown, SquareCode, LucideIcon
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Icon } from '@iconify/react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu'
import { uploadEmbeddedImage } from '../../app/project/[projectId]/materials/serverActions'
import { HexAlphaColorPicker } from "react-colorful";
import PopoverSimplfied from '../miscellaneous/popover'

type Command = ( chain: ChainedCommands ) => ChainedCommands

const FONT_SIZES = [ 8, 10, 12, 14, 16, 18, 24, 36 ]
const LINE_HEIGHTS = [ "1", "1.5", "2", "2.5", "3" ]
const HEADINGS: { level: 1 | 2 | 3 | 4 | 5 | 6, icon: LucideIcon }[] = [
    { level: 1, icon: Heading1 },
    { level: 2, icon: Heading2 },
    { level: 3, icon: Heading3 },
    { level: 4, icon: Heading4 },
    { level: 5, icon: Heading5 },
    { level: 6, icon: Heading6 },
]
const ALIGNMENTS: { value: 'left' | 'center' | 'right' | 'justify', title: string, icon: LucideIcon }[] = [
    { value: 'left', title: 'Align left', icon: AlignLeft },
    { value: 'center', title: 'Align center', icon: AlignCenter },
    { value: 'right', title: 'Align right', icon: AlignRight },
    { value: 'justify', title: 'Align justify', icon: AlignJustify },
]

const dropdownItemClass = "cursor-pointer px-2 py-1 hover:bg-gray-100 rounded"
const dropdownTriggerClass = "flex items-center gap-1 p-1.5 rounded hover:bg-gray-300"

/** Popover with a color picker and a reset button; the trigger draws an icon with a colored underline. */
const ColorPickerPopover = ( { color, onChange, children }: { color: string, onChange: ( color: string ) => void, children: React.ReactNode } ) => (
    <PopoverSimplfied

        trigger={
            <Button variant="outline" size="icon" className="h-fit rounded-none p-1.5 bg-transparent border-0">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 22h16" stroke={color} strokeWidth="4"/>
                    {children}
                </svg>
            </Button>
        }

        content={
            <div className='flex flex-col gap-1.5'>
                <HexAlphaColorPicker color={color} onChange={onChange}/>
                <Button variant="ghost" className="text-left" onClick={() => onChange("")}> Reset Color </Button>
            </div>
        }

    />
)

interface ToolbarContentsProps {
    editor: Editor
}

export default function ToolbarContents({ editor }: ToolbarContentsProps) {

    // Run a focused, chained editor command
    const run = ( command: Command ) => command( editor.chain().focus() ).run()

    function setColor(color: string) {
        run( c => color ? c.setColor(color) : c.unsetColor() )
    }

    function setHighlight(color: string) {
        run( c => color ? c.setBackgroundColor(color) : c.unsetBackgroundColor() )
    }

    function setLink() {
        const url = prompt('Enter link:')
        if (url) run( c => c.setLink({ href: url }) )
    }

    function onImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (!file) return

        uploadEmbeddedImage(file).then((res) => run( c => c.setImage({ src: res }) ))
    }

    const [currentColor, setCurrentColor] = useState<string>("#000000")
    const [currentHighlight, setCurrentHighlight] = useState<string>("#FFFFFF")

    // Sync active color and highlight states with Tiptap selection/transactions
    useEffect(() => {
        if (!editor) return

        const updateColor = () => {
            const textStyle = editor.getAttributes("textStyle")
            setCurrentColor(textStyle.color ?? "#000000")
            setCurrentHighlight(textStyle.backgroundColor ?? "#FFFFFF")
        }

        updateColor() // initial
        editor.on("selectionUpdate", updateColor)
        editor.on("transaction", updateColor)

        return () => {
            editor.off("selectionUpdate", updateColor)
            editor.off("transaction", updateColor)
        }
    }, [editor])

    return (
        <div className="flex flex-col py-6 px-7.5 gap-1.5 relative w-full">

            <div className="flex flex-wrap items-center">

                {/* Group 1: Basic Formatting & Font Controls */}
                <div className="flex items-center gap-1.5">
                    <Control editorKey="bold" editor={editor} onChange={() => run( c => c.toggleBold() )} title="Bold">
                        <Bold className="w-4 h-4" />
                    </Control>
                    <Control editorKey="italic" editor={editor} onChange={() => run( c => c.toggleItalic() )} title="Italic">
                        <Italic className="w-4 h-4" />
                    </Control>
                    <Control editorKey="underline" editor={editor} onChange={() => run( c => c.toggleUnderline() )} title="Underline">
                        <Underline className="w-4 h-4" />
                    </Control>
                    <Control editorKey="strike" editor={editor} onChange={() => run( c => c.toggleStrike() )} title="Strikethrough">
                        <Strikethrough className="w-4 h-4" />
                    </Control>

                    {/* Font Size Dropdown */}
                    <DropdownMenu>
                        <DropdownMenuTrigger className={dropdownTriggerClass}>
                            <ALargeSmall className="w-4 h-4" /><ChevronDown className="w-3 h-3" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="flex flex-col gap-1.5 bg-white p-3 px-4.5 border border-gray-400 shadow-md rounded-md z-50">
                            <DropdownMenuItem className={dropdownItemClass} onClick={() => run( c => c.unsetFontSize() )}> Unset </DropdownMenuItem>
                            { FONT_SIZES.map( size => (
                                <DropdownMenuItem key={size} className={dropdownItemClass} onClick={() => run( c => c.setFontSize(`${size}px`) )}> {size} </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Text Color Picker */}
                    <ColorPickerPopover color={currentColor} onChange={setColor}>
                        <path d="m6 16 6-12 6 12"/>
                        <path d="M8 12h8"/>
                    </ColorPickerPopover>

                    {/* Highlight Picker */}
                    <ColorPickerPopover color={currentHighlight} onChange={setHighlight}>
                        <g transform="scale(0.85)">
                            <path d="m9 11-6 6v3h9l3-3"/>
                            <path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/>
                        </g>
                    </ColorPickerPopover>

                    {/* Heading Dropdown */}
                    <DropdownMenu>
                        <DropdownMenuTrigger className={dropdownTriggerClass}>
                            <Heading className="w-4 h-4" /><ChevronDown className="w-3 h-3" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="flex bg-white p-2 border border-gray-400 shadow-md rounded-md z-50 gap-1">
                            { HEADINGS.map( ( { level, icon: HeadingIcon } ) => (
                                <DropdownMenuItem key={level} className="cursor-pointer p-1 hover:bg-gray-100 rounded" onClick={() => run( c => c.toggleHeading({ level }) )}> <HeadingIcon className="w-4 h-4" /> </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>

                </div>

                <Separator />

                {/* Group 2: Lists, Alignments & Line Heights */}
                <div className="flex items-center gap-1.5">

                    <DropdownMenu>
                        <DropdownMenuTrigger className={dropdownTriggerClass}>
                            <List className="w-4 h-4" /><ChevronDown className="w-3 h-3" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="flex flex-col gap-1.5 bg-white p-3 border border-gray-400 shadow-md rounded-md z-50">
                            <DropdownMenuItem onClick={() => run( c => c.toggleBulletList() )} className="flex gap-3 cursor-pointer items-center p-1 hover:bg-gray-100 rounded"><List className="w-4 h-4" /> Dotted</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => run( c => c.toggleOrderedList() )} className="flex gap-3 cursor-pointer items-center p-1 hover:bg-gray-100 rounded"><ListOrdered className="w-4 h-4" /> Number</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    { ALIGNMENTS.map( ( { value, title, icon: AlignIcon } ) => (
                        <Control key={value} editorKey={{ textAlign: value }} editor={editor} title={title} onChange={() => run( c => c.setTextAlign(value) )}> <AlignIcon className="w-4 h-4" /> </Control>
                    ))}

                    <DropdownMenu>
                        <DropdownMenuTrigger className="p-1.5 rounded hover:bg-gray-300 flex items-center">
                            <Icon icon="tabler:line-height" width={20} height={20} />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="flex flex-col gap-1 bg-white p-3 border border-gray-400 shadow-md rounded-md z-50 max-h-48 overflow-y-auto">
                            <DropdownMenuItem className={dropdownItemClass} onClick={() => run( c => c.unsetLineHeight() )}> Unset </DropdownMenuItem>
                            { LINE_HEIGHTS.map( lineHeight => (
                                <DropdownMenuItem key={lineHeight} className={dropdownItemClass} onClick={() => run( c => c.toggleTextStyle({ lineHeight }) )}> { Number(lineHeight) * 100 }% </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>

                </div>

                <Separator />

                {/* Group 3: Subscript, Superscript & Blockquote */}
                <div className="flex items-center gap-1.5">
                    <Control editorKey="subscript" editor={editor} onChange={() => run( c => c.toggleSubscript() )} title="Subscript"> <SubscriptIcon className="w-4 h-4" /> </Control>
                    <Control editorKey="superscript" editor={editor} onChange={() => run( c => c.toggleSuperscript() )} title="Superscript"> <SuperscriptIcon className="w-4 h-4" /> </Control>
                    <Control editorKey="blockquote" editor={editor} onChange={() => run( c => c.toggleBlockquote() )} title="Blockquote"> <Quote className="w-4 h-4" /> </Control>
                </div>

            </div>

            {/* Bottom Row Controls */}
            <div className="flex gap-1.5 items-center">
                <Button variant="outline" size="icon" className="h-fit rounded-none p-1.5" onClick={setLink}> <LinkIcon className="w-4 h-4" /> </Button>

                <Button variant="outline" size="icon" className="h-fit rounded-none p-1.5">
                    <label htmlFor="image" className="cursor-pointer"><Image className="w-4 h-4" /></label>
                </Button>
                <input type="file" accept="image/*" onChange={onImageUpload} hidden name="image" id="image"/>

                <Control editorKey="codeBlock" editor={editor} onChange={() => run( c => c.toggleCodeBlock() )} title="Code block"> <SquareCode className="w-4 h-4" /> </Control>
                <Control editorKey="code" editor={editor} onChange={() => run( c => c.toggleCode() )} title="Code"> <Code className="w-4 h-4" /> </Control>

                <Button variant="outline" size="icon" className="h-fit rounded-none p-1.5" onClick={() => run( c => c.insertTable({ rows: 3, cols: 3, withHeaderRow: true }) )}> <Table className="w-4 h-4" /> </Button>

                <Button variant="outline" size="icon" className="h-fit p-1.5" onClick={() => run( c => c.undo() )}> <Undo className="w-4 h-4" /> </Button>
                <Button variant="outline" size="icon" className="h-fit p-1.5" onClick={() => run( c => c.redo() )}> <Redo className="w-4 h-4" /> </Button>
            </div>

        </div>
    )
}
