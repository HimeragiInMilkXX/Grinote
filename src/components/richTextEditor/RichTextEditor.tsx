'use client'

import { RefObject, useEffect, useImperativeHandle } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import CodeBlock from '@tiptap/extension-code-block'
import TextAlign from '@tiptap/extension-text-align'
import { TextStyleKit } from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import { TableKit } from '@tiptap/extension-table'
import Superscript from '@tiptap/extension-superscript'
import Subscript from '@tiptap/extension-subscript'
import { CleanImageResize } from './CleanImageResize'
import ToolbarContents from './ToolbarContents'
import './styles.css'
import { EditorMetadata } from './EditorMetadata'

export type EditorRef = {
    getHTML: () => string
    getAllImageUrls: () => string[]
}

export interface RichTextEditorProps {
    classes?: string
    ref?: RefObject<EditorRef | null>;
    content?: string;
}

const RichTextEditor = ({ ref, classes = "", content }: RichTextEditorProps) => {

    // useEditor handles creation and lifecycle automatically in React
    const editor = useEditor({
        extensions: [
            StarterKit,
            Underline,
            Link.configure({ openOnClick: false }),
            CleanImageResize.configure({ inline: true, allowBase64: true }),
            CodeBlock.configure({ exitOnArrowDown: true }),
            TextAlign.configure({ types: ['heading', 'paragraph'] }),
            TextStyleKit,
            Color,
            TableKit,
            Superscript.configure({}),
            Subscript,
            EditorMetadata
        ],
        editorProps: {
            attributes: {
                class: "bg-white box-border p-4 w-full h-[80vh] overflow-y-scroll outline-none", 
                style: "scrollbar-width: none"
            }
        },
        immediatelyRender: false, // Required for Next.js SSR hydration safety
        content: content ?? ""
    })

    useEffect( () => {

        editor?.commands.setContent(content ?? "")

    }, [content])

    // Expose getHTML via React's useImperativeHandle (replaces Solid's ref callback parameter)
    useImperativeHandle(ref, () => ({
        getHTML: () => editor?.getHTML() || '',
        getAllImageUrls: () => {

            const imageUrls: string[] = [];

            editor?.state.doc.descendants( node => {

                if( node.type.name === 'imageResize' )
                    if( node.attrs.src )
                        imageUrls.push( node.attrs.src )

            })

            return imageUrls

        }
    }), [editor])

    return (
        <div className={`border-2 ${classes}`}>
            {/* Toolbar Container */}
            <div className="flex flex-wrap items-center gap-1 bg-slate-50 border-b">
                {editor && <ToolbarContents editor={editor} />}
            </div>

            {/* Main Editor Surface using Tiptap's built-in EditorContent component */}
            <div className="h-[80vh] bg-white overflow-y-scroll rounded-lg editor p-4.5">
                <EditorContent editor={editor} />
            </div>
        </div>
    )
}

export default RichTextEditor