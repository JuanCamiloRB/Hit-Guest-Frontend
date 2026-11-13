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
    Plus,
} from "lucide-react"
import { Icon } from "@/components/ui/icon"
import { Note } from "@/components/ui/note"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { SHORTCODE_LABELS } from "../../types/document"
import { Skeleton } from "@/components/ui/skeleton"
import { UnstyledButton } from "@/components/ui/unstyled-button"
import { Surface } from "@/components/ui/card"

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
        <UnstyledButton
            type="button"
            title={title}
            disabled={disabled}
            onClick={onClick}
            className={cn(
                "h-8 w-8 inline-flex items-center justify-center rounded-md text-ink-3 transition-colors hover:bg-sunk hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed",
                active && "bg-primary/10 text-primary",
            )}
        >
            {children}
        </UnstyledButton>
    )
}

export function DocumentEditor({ value, onChange, shortcodes = [] }: DocumentEditorProps) {
    const editor = useEditor({
        extensions: [StarterKit],
        content: value || "",
        immediatelyRender: false,
        editorProps: {
            attributes: {
                class: "min-h-65 px-4 py-3 focus:outline-none",
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
            <Skeleton className="min-h-80 rounded-xl" />
        )
    }

    return (
        <div className="space-y-3">
            <Surface flat className="overflow-hidden">
                {/* Toolbar */}
                <div className="flex items-center gap-0.5 border-b border-rule bg-sunk/50 px-2 py-1.5 flex-wrap">
                    <ToolbarButton title="Negrita" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
                        <Icon icon={Bold} />
                    </ToolbarButton>
                    <ToolbarButton title="Cursiva" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
                        <Icon icon={Italic} />
                    </ToolbarButton>
                    <ToolbarButton title="Tachado" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}>
                        <Icon icon={Strikethrough} />
                    </ToolbarButton>
                    <div className="w-px h-5 bg-sunk mx-1" />
                    <ToolbarButton title="Título" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
                        <Icon icon={Heading2} />
                    </ToolbarButton>
                    <ToolbarButton title="Lista" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
                        <Icon icon={List} />
                    </ToolbarButton>
                    <ToolbarButton title="Lista numerada" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
                        <Icon icon={ListOrdered} />
                    </ToolbarButton>
                    <ToolbarButton title="Bloque de código" active={editor.isActive("codeBlock")} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
                        <Icon icon={Code} />
                    </ToolbarButton>
                    <div className="w-px h-5 bg-sunk mx-1" />
                    <ToolbarButton title="Deshacer" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}>
                        <Icon icon={Undo2} />
                    </ToolbarButton>
                    <ToolbarButton title="Rehacer" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}>
                        <Icon icon={Redo2} />
                    </ToolbarButton>
                </div>

                {/* Editable area */}
                <EditorContent
                    editor={editor}
                    className={cn(
                        "text-sm text-ink-2 leading-relaxed",
                        "[&_.ProseMirror]:min-h-65",
                        "[&_h2]:text-lg [&_h2]:font-bold [&_h2]:my-2",
                        "[&_p]:my-2",
                        "[&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-2",
                        "[&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-2",
                        "[&_strong]:font-bold",
                        "[&_pre]:bg-sunk [&_pre]:rounded-lg [&_pre]:p-3 [&_pre]:text-xs [&_pre]:my-2",
                    )}
                />
            </Surface>

            {/* Shortcode panel */}
            {shortcodes.length > 0 && (
                <Note as="div" tone="accent">
                    <p className="text-xs font-bold text-primary mb-2">
                        Variables disponibles
                    </p>
                    <p className="text-xs text-primary mb-2.5">
                        Haz clic para insertar la variable en la posición del cursor. Se reemplazará con datos reales de la reserva.
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                        {shortcodes.map((key) => (
                            <Button
                                key={key}
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => insertShortcode(key)}
                                title={`Inserta {{${key}}}`}
                            >
                                <Icon icon={Plus} />
                                {SHORTCODE_LABELS[key] ?? key}
                            </Button>
                        ))}
                    </div>
                </Note>
            )}
        </div>
    )
}
