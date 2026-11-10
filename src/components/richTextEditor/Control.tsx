'use client'

import { useState, useEffect } from 'react'
import { Editor } from '@tiptap/core'
import { Toggle } from '@/components/ui/toggle' // shadcn-ui toggle component

interface ControlProps {
    className?: string // React uses className instead of class
    editor: Editor
    title: string
    editorKey: string | any // RENAMED from 'key' because 'key' is reserved in React!
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
    const [isPressed, setIsPressed] = useState(() => {
        if (!editor) return false
        return isActive ? isActive(editor) : editor.isActive(editorKey)
    })

    useEffect(() => {
        if (!editor) return

        const handleTransaction = () => {
            const active = isActive ? isActive(editor) : editor.isActive(editorKey)
            setIsPressed(active)
        }

        // Listen to Tiptap transaction events
        editor.on('transaction', handleTransaction)
        
        // Run once on mount to set initial state
        handleTransaction()

        // Cleanup subscription on unmount
        return () => {
            editor.off('transaction', handleTransaction)
        }
    }, [editor, editorKey, isActive])

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