'use client'

import { RefObject, useEffect, useImperativeHandle, useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
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
    /** Replace the whole document (e.g. an AI draft). Not saved until the owner saves. */
    setHTML: ( html: string ) => void
    /** Append HTML at the end of the document. */
    appendHTML: ( html: string ) => void
    isReady: () => boolean
}

export interface RichTextEditorProps {
    classes?: string
    ref?: RefObject<EditorRef | null>;
    content?: string;
    /** Material that owns embedded images (uploads go to materials/{id}/memo) */
    material_id: number;
    /** Height of the editing surface, default h-[80vh] */
    heightClass?: string;
    /** Called whenever the user (or an inserted AI draft) changes the document; not called when `content` is loaded */
    onChange?: () => void;
}

const RichTextEditor = ({ ref, classes = "", content, material_id, heightClass = "h-[80vh]", onChange }: RichTextEditorProps) => {

    // latest callback without re-creating the editor
    const onChangeRef = useRef( onChange )
    useEffect( () => { onChangeRef.current = onChange }, [ onChange ] )

    // useEditor handles creation and lifecycle automatically in React
    const editor = useEditor({
        extensions: [
            // StarterKit v3 already bundles Underline, Link and CodeBlock
            StarterKit.configure({
                link: { openOnClick: false },
                codeBlock: { exitOnArrowDown: true },
            }),
            CleanImageResize.configure({ inline: true, allowBase64: true }),
            TextAlign.configure({ types: ['heading', 'paragraph'] }),
            TextStyleKit,
            Color,
            TableKit,
            Superscript,
            Subscript,
            EditorMetadata
        ],
        editorProps: {
            attributes: {
                class: "bg-white box-border p-4 w-full min-h-full outline-none", 
                style: "scrollbar-width: none"
            }
        },
        immediatelyRender: false, // Required for Next.js SSR hydration safety
        content: content ?? "",
        onUpdate: () => onChangeRef.current?.()
    })

    useEffect( () => {

        // loading saved content isn't a user change
        editor?.commands.setContent(content ?? "", { emitUpdate: false })

    }, [editor, content])

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

        },
        setHTML: ( html: string ) => { editor?.commands.setContent( html, { emitUpdate: true } ) },
        appendHTML: ( html: string ) => { editor?.chain().focus( "end" ).insertContent( html ).run() },
        isReady: () => !!editor && !editor.isDestroyed,
    }), [editor])

    return (
        <div className={`border-2 ${classes}`}>
            {/* Toolbar Container */}
            <div className="flex flex-wrap items-center gap-1 bg-slate-50 border-b">
                {editor && <ToolbarContents editor={editor} material_id={material_id} />}
            </div>

            {/* Main Editor Surface using Tiptap's built-in EditorContent component */}
            <div className={`${heightClass} bg-white overflow-y-scroll rounded-lg editor p-4.5`}>
                <EditorContent editor={editor} className="h-full" />
            </div>
        </div>
    )
}

export default RichTextEditor