'use client'

import React, { useState, useEffect } from 'react'
import { Editor } from '@tiptap/core'
import Control from './Control'
import Separator from './Separater'
import {
    Bold, Italic, Underline, Strikethrough, Code,
    Heading1, Heading2, Heading3, Heading4, Heading5, Heading6, Heading,
    List, ListOrdered, AlignLeft, AlignCenter, AlignRight, AlignJustify,
    Subscript as SubscriptIcon, Superscript as SuperscriptIcon,
    Quote, Link as LinkIcon, Image, Table, Undo, Redo,
    ALargeSmall, ChevronDown, SquareCode
} from 'lucide-react'
 // Base UI Dropdown
import { Button } from '@/components/ui/button' // shadcn-ui button
import { Icon } from '@iconify/react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu'
import { uploadEmbeddedImage } from '../../app/project/[projectId]/materials/serverActions'
import { HexAlphaColorPicker } from "react-colorful";
import PopoverSimplfied from '../miscellaneous/popover'

interface ToolbarContentsProps {
    editor: Editor
}

export default function ToolbarContents({ editor }: ToolbarContentsProps) {

    // Helper to run editor commands
    function cmd(action: string, arg?: any) {
        editor.chain().focus()[action](arg).run()
    }

    function setColor(color: string) {
        editor.chain().focus().setColor(color).run()
    }

    function setHighlight(color: string) {
        editor.chain().focus().setBackgroundColor(color).run()
    }

    function setLink() {
        const url = prompt('Enter link:')
        if (url) editor.chain().focus().setLink({ href: url }).run()
    }

    function addTable() {
        editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
    }

    function onImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (!file) return

        uploadEmbeddedImage(file).then((res) => {
            editor.chain().focus().setImage({ src: res }).run()
        })
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
                    <Control editorKey="bold" editor={editor} onChange={() => cmd('toggleBold')} title="Bold">
                        <Bold className="w-4 h-4" />
                    </Control>
                    <Control editorKey="italic" editor={editor} onChange={() => cmd('toggleItalic')} title="Italic">
                        <Italic className="w-4 h-4" />
                    </Control>
                    <Control editorKey="underline" editor={editor} onChange={() => cmd('toggleUnderline')} title="Underline">
                        <Underline className="w-4 h-4" />
                    </Control>
                    <Control editorKey="strike" editor={editor} onChange={() => cmd('toggleStrike')} title="Strikethrough">
                        <Strikethrough className="w-4 h-4" />
                    </Control>

                    {/* Font Size Dropdown (Base UI) */}
                    <DropdownMenu>
                        <DropdownMenuTrigger className="flex items-center gap-1 p-1.5 rounded hover:bg-gray-300">
                            <ALargeSmall className="w-4 h-4" /><ChevronDown className="w-3 h-3" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="flex flex-col gap-1.5 bg-white p-3 px-4.5 border border-gray-400 shadow-md rounded-md z-50">
                            <DropdownMenuItem className="cursor-pointer px-2 py-1 hover:bg-gray-100 rounded" onClick={() => cmd('unsetFontSize')}> Unset </DropdownMenuItem>
                            <DropdownMenuItem className="cursor-pointer px-2 py-1 hover:bg-gray-100 rounded" onClick={() => cmd('setFontSize', '8px')}> 8 </DropdownMenuItem>
                            <DropdownMenuItem className="cursor-pointer px-2 py-1 hover:bg-gray-100 rounded" onClick={() => cmd('setFontSize', '10px')}> 10 </DropdownMenuItem>
                            <DropdownMenuItem className="cursor-pointer px-2 py-1 hover:bg-gray-100 rounded" onClick={() => cmd('setFontSize', '12px')}> 12 </DropdownMenuItem>
                            <DropdownMenuItem className="cursor-pointer px-2 py-1 hover:bg-gray-100 rounded" onClick={() => cmd('setFontSize', '14px')}> 14 </DropdownMenuItem>
                            <DropdownMenuItem className="cursor-pointer px-2 py-1 hover:bg-gray-100 rounded" onClick={() => cmd('setFontSize', '16px')}> 16 </DropdownMenuItem>
                            <DropdownMenuItem className="cursor-pointer px-2 py-1 hover:bg-gray-100 rounded" onClick={() => cmd('setFontSize', '18px')}> 18 </DropdownMenuItem>
                            <DropdownMenuItem className="cursor-pointer px-2 py-1 hover:bg-gray-100 rounded" onClick={() => cmd('setFontSize', '24px')}> 24 </DropdownMenuItem>
                            <DropdownMenuItem className="cursor-pointer px-2 py-1 hover:bg-gray-100 rounded" onClick={() => cmd('setFontSize', '36px')}> 36 </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Text Color Picker */}
                    <PopoverSimplfied

                        trigger={
                            <Button variant="outline" size="icon" className="h-fit rounded-none p-1.5 bg-transparent border-0">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M4 22h16" stroke={currentColor} strokeWidth="4"/>
                                    <path d="m6 16 6-12 6 12"/>
                                    <path d="M8 12h8"/>
                                </svg>
                            </Button>
                        }

                        content={
                            <div className='flex flex-col gap-1.5'>

                                <HexAlphaColorPicker color={currentColor} onChange={setColor}/>
                                <Button variant="ghost" className="text-left" onClick={() => setColor("")}> Reset Color </Button>

                            </div>
                        }

                    />


                    {/* Highlight Picker */}
                    <PopoverSimplfied

                        trigger={
                            <Button variant="outline" size="icon" className="h-fit rounded-none p-1.5 bg-transparent border-0">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M4 22h16" stroke={currentHighlight} strokeWidth="4"/>
                                    <g transform="scale(0.85)" origin="top">
                                        <path d="m9 11-6 6v3h9l3-3"/>
                                        <path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/>
                                    </g>
                                </svg>
                            </Button>
                        }

                        content={
                            <div className='flex flex-col gap-1.5'>

                                <HexAlphaColorPicker color={currentHighlight} onChange={setHighlight}/>
                                <Button variant="ghost" className="text-left" onClick={() => setHighlight("")}> Reset Color </Button>

                            </div>
                        }

                    />

                    {/* Heading Dropdown (Base UI - No asChild) */}
                    <DropdownMenu>
                        <DropdownMenuTrigger className="flex items-center gap-1 p-1.5 rounded hover:bg-gray-300">
                            <Heading className="w-4 h-4" /><ChevronDown className="w-3 h-3" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="flex bg-white p-2 border border-gray-400 shadow-md rounded-md z-50 gap-1">
                            <DropdownMenuItem className="cursor-pointer p-1 hover:bg-gray-100 rounded" onClick={() => cmd('toggleHeading', { level: 1 })}> <Heading1 className="w-4 h-4" /> </DropdownMenuItem>
                            <DropdownMenuItem className="cursor-pointer p-1 hover:bg-gray-100 rounded" onClick={() => cmd('toggleHeading', { level: 2 })}> <Heading2 className="w-4 h-4" /> </DropdownMenuItem>
                            <DropdownMenuItem className="cursor-pointer p-1 hover:bg-gray-100 rounded" onClick={() => cmd('toggleHeading', { level: 3 })}> <Heading3 className="w-4 h-4" /> </DropdownMenuItem>
                            <DropdownMenuItem className="cursor-pointer p-1 hover:bg-gray-100 rounded" onClick={() => cmd('toggleHeading', { level: 4 })}> <Heading4 className="w-4 h-4" /> </DropdownMenuItem>
                            <DropdownMenuItem className="cursor-pointer p-1 hover:bg-gray-100 rounded" onClick={() => cmd('toggleHeading', { level: 5 })}> <Heading5 className="w-4 h-4" /> </DropdownMenuItem>
                            <DropdownMenuItem className="cursor-pointer p-1 hover:bg-gray-100 rounded" onClick={() => cmd('toggleHeading', { level: 6 })}> <Heading6 className="w-4 h-4" /> </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                </div>

                <Separator />

                {/* Group 2: Lists, Alignments & Line Heights */}
                <div className="flex items-center gap-1.5">

                    <DropdownMenu>
                        <DropdownMenuTrigger className="flex items-center gap-1 p-1.5 rounded hover:bg-gray-300">
                            <List className="w-4 h-4" /><ChevronDown className="w-3 h-3" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="flex flex-col gap-1.5 bg-white p-3 border border-gray-400 shadow-md rounded-md z-50">
                            <DropdownMenuItem onClick={() => cmd('toggleBulletList')} className="flex gap-3 cursor-pointer items-center p-1 hover:bg-gray-100 rounded"><List className="w-4 h-4" /> Dotted</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => cmd('toggleOrderedList')} className="flex gap-3 cursor-pointer items-center p-1 hover:bg-gray-100 rounded"><ListOrdered className="w-4 h-4" /> Number</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <Control editorKey={{ textAlign: 'left' }} editor={editor} title="Align left" onChange={() => cmd('setTextAlign', 'left')}> <AlignLeft className="w-4 h-4" /> </Control>
                    <Control editorKey={{ textAlign: 'center' }} editor={editor} title="Align center" onChange={() => cmd('setTextAlign', 'center')}> <AlignCenter className="w-4 h-4" /> </Control>
                    <Control editorKey={{ textAlign: 'right' }} editor={editor} title="Align right" onChange={() => cmd('setTextAlign', 'right')}> <AlignRight className="w-4 h-4" /> </Control>
                    <Control editorKey={{ textAlign: 'justify' }} editor={editor} title="Align justify" onChange={() => cmd('setTextAlign', 'justify')}> <AlignJustify className="w-4 h-4" /> </Control>

                    <DropdownMenu>
                        <DropdownMenuTrigger className="p-1.5 rounded hover:bg-gray-300 flex items-center">
                            <Icon icon="tabler:line-height" width={20} height={20} />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="flex flex-col gap-1 bg-white p-3 border border-gray-400 shadow-md rounded-md z-50 max-h-48 overflow-y-auto">
                            <DropdownMenuItem className="cursor-pointer px-2 py-1 hover:bg-gray-100 rounded" onClick={() => cmd('unsetLineHeight')}> Unset </DropdownMenuItem>
                            <DropdownMenuItem className="cursor-pointer px-2 py-1 hover:bg-gray-100 rounded" onClick={() => cmd('toggleTextStyle', { lineHeight: '1' })}> 100% </DropdownMenuItem>
                            <DropdownMenuItem className="cursor-pointer px-2 py-1 hover:bg-gray-100 rounded" onClick={() => cmd('toggleTextStyle', { lineHeight: '1.5' })}> 150% </DropdownMenuItem>
                            <DropdownMenuItem className="cursor-pointer px-2 py-1 hover:bg-gray-100 rounded" onClick={() => cmd('toggleTextStyle', { lineHeight: '2' })}> 200% </DropdownMenuItem>
                            <DropdownMenuItem className="cursor-pointer px-2 py-1 hover:bg-gray-100 rounded" onClick={() => cmd('toggleTextStyle', { lineHeight: '2.5' })}> 250% </DropdownMenuItem>
                            <DropdownMenuItem className="cursor-pointer px-2 py-1 hover:bg-gray-100 rounded" onClick={() => cmd('toggleTextStyle', { lineHeight: '3' })}> 300% </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                </div>

                <Separator />

                {/* Group 3: Subscript, Superscript & Blockquote */}
                <div className="flex items-center gap-1.5">
                    <Control editorKey="subscript" editor={editor} onChange={() => cmd('toggleSubscript')} title="Subscript"> <SubscriptIcon className="w-4 h-4" /> </Control>
                    <Control editorKey="superscript" editor={editor} onChange={() => cmd('toggleSuperscript')} title="Superscript"> <SuperscriptIcon className="w-4 h-4" /> </Control>
                    <Control editorKey="blockquote" editor={editor} onChange={() => cmd('toggleBlockquote')} title="Blockquote"> <Quote className="w-4 h-4" /> </Control>
                </div>

            </div>

            {/* Bottom Row Controls */}
            <div className="flex gap-1.5 items-center">
                <Button variant="outline" size="icon" className="h-fit rounded-none p-1.5" onClick={setLink}> <LinkIcon className="w-4 h-4" /> </Button>

                <Button variant="outline" size="icon" className="h-fit rounded-none p-1.5">
                    <label htmlFor="image" className="cursor-pointer"><Image className="w-4 h-4" /></label>
                </Button>
                <input type="file" accept="image/*" onChange={onImageUpload} hidden name="image" id="image"/>

                <Control editorKey="codeBlock" editor={editor} onChange={() => cmd('toggleCodeBlock')} title="Code block"> <SquareCode className="w-4 h-4" /> </Control>
                <Control editorKey="code" editor={editor} onChange={() => cmd('toggleCode')} title="Code"> <Code className="w-4 h-4" /> </Control>

                <Button variant="outline" size="icon" className="h-fit rounded-none p-1.5" onClick={addTable}> <Table className="w-4 h-4" /> </Button>

                <Button variant="outline" size="icon" className="h-fit p-1.5" onClick={() => cmd('undo')}> <Undo className="w-4 h-4" /> </Button>
                <Button variant="outline" size="icon" className="h-fit p-1.5" onClick={() => cmd('redo')}> <Redo className="w-4 h-4" /> </Button>
            </div>

        </div>
    )
}