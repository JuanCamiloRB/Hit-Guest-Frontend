"use client"

import { useState, useEffect } from "react"
import { Camera, CheckCircle2, ScanLine, RotateCcw, ImageIcon } from "lucide-react"

interface DocumentUploadProps {
  label: string
  value: string | null
  onChange: (value: string | null) => void
  required?: boolean
  id?: string
}

export function DocumentUpload({
  label,
  value,
  onChange,
  required = false,
  id,
}: DocumentUploadProps) {
  const [state, setState] = useState<"idle" | "scanning" | "done">(
    value ? "done" : "idle"
  )
  const [progress, setProgress] = useState(0)
  const [tempBase64, setTempBase64] = useState<string | null>(null)

  // Simulate scanning
  useEffect(() => {
    if (state === "scanning") {
      const interval = setInterval(() => {
        setProgress((prev) => prev + 20)
      }, 250)
      return () => clearInterval(interval)
    }
  }, [state])

  // Watch for completion
  useEffect(() => {
    if (state === "scanning" && progress >= 100) {
      setState("done")
      if (tempBase64) {
        onChange(tempBase64)
      }
    }
  }, [state, progress, tempBase64, onChange])

  const startScan = () => {
    setState("scanning")
    setProgress(0)
  }

  const reset = () => {
    setState("idle")
    setProgress(0)
    onChange(null)
  }

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-semibold text-slate-700">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>

      <div
        id={id}
        className={`
          relative w-full rounded-2xl border-2 border-dashed overflow-hidden
          transition-all duration-300
          ${state === "done"
            ? "border-green-300 bg-green-50/50"
            : state === "scanning"
            ? "border-brand-blue/40 bg-brand-blue/5"
            : "border-slate-200 bg-slate-50 hover:border-brand-purple/30 hover:bg-brand-purple/5"
          }
        `}
      >
        {/* Idle State */}
        {state === "idle" && (
          <label className="w-full p-6 flex flex-col items-center gap-3 cursor-pointer group">
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) {
                  startScan()
                  const reader = new FileReader()
                  reader.onload = (event) => {
                    if (event.target?.result) {
                      setTempBase64(event.target.result as string)
                    }
                  }
                  reader.readAsDataURL(file)
                }
              }}
            />
            <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-100 group-hover:bg-brand-purple/5 group-hover:border-brand-purple/20 transition-all">
              <Camera size={28} className="text-brand-purple" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-slate-700">
                Tomar foto o subir archivo
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                Asegura buena iluminación y evita reflejos
              </p>
            </div>
          </label>
        )}

        {/* Scanning State */}
        {state === "scanning" && (
          <div className="p-6 flex flex-col items-center gap-4">
            {/* Scanner visual */}
            <div className="relative w-36 h-24 bg-white/60 rounded-xl border border-brand-blue/20 flex items-center justify-center overflow-hidden">
              <IdCardPlaceholder />
              <div className="absolute inset-0 bg-brand-blue/10 flex items-center justify-center">
                <ScanLine className="text-brand-blue animate-pulse w-8 h-8" />
              </div>
              <div
                className="absolute bottom-0 left-0 bg-brand-blue/30 w-full transition-all duration-300"
                style={{ height: `${progress}%` }}
              />
            </div>

            <div className="w-full space-y-2">
              <p className="text-sm font-semibold text-brand-blue text-center animate-pulse">
                Procesando documento...
              </p>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-brand-blue h-full transition-all duration-300 rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Done State */}
        {state === "done" && (
          <div className="p-5 flex items-center gap-4">
            <div className="bg-green-100 p-2.5 rounded-xl">
              <CheckCircle2 size={24} className="text-green-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-green-700">
                Documento capturado
              </p>
              <p className="text-xs text-green-600/70 mt-0.5">
                Datos cifrados de forma segura
              </p>
            </div>
            <button
              type="button"
              onClick={reset}
              className="p-2 rounded-lg hover:bg-green-100/50 text-green-600 transition-colors"
              title="Volver a tomar"
            >
              <RotateCcw size={18} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function IdCardPlaceholder() {
  return (
    <div className="flex flex-col gap-1.5 p-2.5 w-full h-full opacity-20">
      <div className="flex gap-2">
        <div className="w-8 h-8 bg-slate-400 rounded-md" />
        <div className="flex flex-col gap-1 flex-1 py-0.5">
          <div className="h-1.5 w-full bg-slate-400 rounded-full" />
          <div className="h-1.5 w-2/3 bg-slate-400 rounded-full" />
        </div>
      </div>
      <div className="mt-auto h-1.5 w-full bg-slate-400 rounded-full" />
    </div>
  )
}
