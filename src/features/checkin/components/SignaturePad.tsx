"use client"

import SignatureCanvas from "react-signature-canvas"
import { useRef, useState } from "react"
import { tokens } from "@/lib/design-tokens"

interface SignaturePadProps {
    onSignatureChange: (base64: string | null) => void
}

export function SignaturePad({ onSignatureChange }: SignaturePadProps) {
    const sigRef = useRef<SignatureCanvas>(null)
    const [isEmpty, setIsEmpty] = useState(true)

    const handleEnd = () => {
        if (sigRef.current) {
            const base64 = sigRef.current.toDataURL("image/png")
            onSignatureChange(base64)
            setIsEmpty(sigRef.current.isEmpty())
        }
    }

    const handleClear = () => {
        sigRef.current?.clear()
        onSignatureChange(null)
        setIsEmpty(true)
    }

    return (
        <div className="space-y-2">
            <label className="text-sm font-semibold text-ink-2">
                Firma Digital<span className="text-danger ml-0.5">*</span>
            </label>
            <div
                className="relative border-2 border-dashed border-rule rounded-xl overflow-hidden bg-sunk/50 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all"
                style={{ touchAction: "none" }}
            >
                <SignatureCanvas
                    ref={sigRef}
                    onEnd={handleEnd}
                    penColor={tokens.ink}
                    canvasProps={{
                        className: "w-full h-40",
                        style: { width: "100%", height: "160px" }
                    }}
                />
                {isEmpty && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-ink-3 text-sm font-medium">
                        Firma aquí
                    </div>
                )}
            </div>
            <div className="flex justify-end">
                <button
                    type="button"
                    onClick={handleClear}
                    className="text-xs font-semibold text-ink-3 hover:text-ink-2 transition-colors py-1 px-2 -mr-2"
                >
                    Limpiar firma
                </button>
            </div>
        </div>
    )
}
