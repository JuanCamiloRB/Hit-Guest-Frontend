"use client"

import { useEffect } from "react"
import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import {
    Bold,
    Italic,
    Strikethrough,
    Heading2,
    List,
    ListOrdered,
    Undo2,
    Redo2,
    Code,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { SHORTCODE_LABELS } from "../../types/document"

interface DocumentEditorProps {
    value: string
    onChange: (html: string) => void
    shortcodes?: string[]
}

function ToolbarButton({
    active,
    disabled,
    onClick,
    title,
    children,
}: {
    active?: boolean
    disabled?: boolean
    onClick: () => void
    title: string
    children: React.ReactNode
}) {
    return (
        <button
            type="button"
            title={title}
            disabled={disabled}
            onClick={onClick}
            className={cn(
                "h-8 w-8 inline-flex items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 disabled:opacity-40 disabled:cursor-not-allowed",
                active && "bg-[var(--color-brand-purple)]/10 text-[var(--color-brand-purple)]",
            )}
        >
            {children}
        </button>
    )
}

export function DocumentEditor({ value, onChange, shortcodes = [] }: DocumentEditorProps) {
    const editor = useEditor({
        extensions: [StarterKit],
        content: value || "",
        immediatelyRender: false,
        editorProps: {
            attributes: {
                class: "min-h-[260px] px-4 py-3 focus:outline-none",
            },
        },
        onUpdate: ({ editor }) => onChange(editor.getHTML()),
    })

    // Sync external value changes (e.g. when loading an existing document) without
    // clobbering the cursor while the user is typing.
    useEffect(() => {
        if (!editor) return
        const current = editor.getHTML()
        if (value !== current && value !== undefined) {
            editor.commands.setContent(value || "", { emitUpdate: false })
        }
    }, [value, editor])

    const insertShortcode = (key: string) => {
        if (!editor) return
        editor.chain().focus().insertContent(`{{${key}}}`).run()
    }

    if (!editor) {
        return (
            <div className="rounded-xl border border-slate-200 bg-slate-50 min-h-[320px] animate-pulse" />
        )
    }

    return (
        <div className="space-y-3">
            <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
                {/* Toolbar */}
                <div className="flex items-center gap-0.5 border-b border-slate-100 bg-slate-50/60 px-2 py-1.5 flex-wrap">
                    <ToolbarButton title="Negrita" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
                        <Bold size={15} />
                    </ToolbarButton>
                    <ToolbarButton title="Cursiva" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
                        <Italic size={15} />
                    </ToolbarButton>
                    <ToolbarButton title="Tachado" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}>
                        <Strikethrough size={15} />
                    </ToolbarButton>
                    <div className="w-px h-5 bg-slate-200 mx-1" />
                    <ToolbarButton title="Título" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
                        <Heading2 size={15} />
                    </ToolbarButton>
                    <ToolbarButton title="Lista" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
                        <List size={15} />
                    </ToolbarButton>
                    <ToolbarButton title="Lista numerada" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
                        <ListOrdered size={15} />
                    </ToolbarButton>
                    <ToolbarButton title="Bloque de código" active={editor.isActive("codeBlock")} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
                        <Code size={15} />
                    </ToolbarButton>
                    <div className="w-px h-5 bg-slate-200 mx-1" />
                    <ToolbarButton title="Deshacer" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}>
                        <Undo2 size={15} />
                    </ToolbarButton>
                    <ToolbarButton title="Rehacer" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}>
                        <Redo2 size={15} />
                    </ToolbarButton>
                </div>

                {/* Editable area */}
                <EditorContent
                    editor={editor}
                    className={cn(
                        "text-sm text-slate-700 leading-relaxed",
                        "[&_.ProseMirror]:min-h-[260px]",
                        "[&_h2]:text-lg [&_h2]:font-bold [&_h2]:my-2",
                        "[&_p]:my-2",
                        "[&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-2",
                        "[&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-2",
                        "[&_strong]:font-bold",
                        "[&_pre]:bg-slate-100 [&_pre]:rounded-lg [&_pre]:p-3 [&_pre]:text-xs [&_pre]:my-2",
                    )}
                />
            </div>

            {/* Shortcode panel */}
            {shortcodes.length > 0 && (
                <div className="rounded-xl border border-violet-100 bg-violet-50/50 p-3">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-violet-600 mb-2">
                        Variables disponibles
                    </p>
                    <p className="text-[11px] text-violet-500 mb-2.5">
                        Haz clic para insertar la variable en la posición del cursor. Se reemplazará con datos reales de la reserva.
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                        {shortcodes.map((key) => (
                            <button
                                key={key}
                                type="button"
                                onClick={() => insertShortcode(key)}
                                title={`Inserta {{${key}}}`}
                                className="inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-white px-2.5 py-1 text-[11px] font-medium text-violet-700 transition-colors hover:bg-violet-100 hover:border-violet-300"
                            >
                                <span className="font-mono text-violet-400 leading-none">+</span>
                                {SHORTCODE_LABELS[key] ?? key}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
