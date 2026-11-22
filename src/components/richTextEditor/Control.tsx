'use client'

import { useState, useEffect } from 'react'
import { Editor } from '@tiptap/core'
import { Toggle } from '@/components/ui/toggle' // shadcn-ui toggle component

interface ControlProps {
    className?: string // React uses className instead of class
    editor: Editor
    title: string
    editorKey: string | Record<string, unknown> // RENAMED from 'key' because 'key' is reserved in React!
    onChange: () => void
    isActive?: (editor: Editor) => boolean
    children: React.ReactNode // React uses React.ReactNode instead of ReactElement
}

export default function Control({
    className = '',
    editor,
    title,
    editorKey,
    onChange,
    isActive,
    children
}: ControlProps) {

    // Replicating createEditorTransaction behavior:
    // Tracks active state and updates on every editor transaction
    const checkActive = () => {
        if (isActive) return isActive(editor)
        return typeof editorKey === 'string' ? editor.isActive(editorKey) : editor.isActive(editorKey)
    }

    const [isPressed, setIsPressed] = useState(() => editor ? checkActive() : false)

    useEffect(() => {
        if (!editor) return

        const handleTransaction = () => setIsPressed(checkActive())

        // Listen to Tiptap transaction events
        editor.on('transaction', handleTransaction)
        
        // Run once on mount to set initial state
        handleTransaction()

        // Cleanup subscription on unmount
        return () => {
            editor.off('transaction', handleTransaction)
        }
    // editorKey may be an inline object, so depend on its serialized form
    }, [editor, JSON.stringify(editorKey), isActive])

    return (
        <Toggle
            pressed={isPressed}
            onPressedChange={onChange}
            className={`${className} p-1.5`}
            title={title}
            type="button"
        >
            {children}
        </Toggle>
    )
}