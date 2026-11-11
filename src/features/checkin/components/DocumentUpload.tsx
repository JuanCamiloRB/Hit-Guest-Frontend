"use client"

import { useState, useEffect } from "react"
import { Camera, CheckCircle2, ScanLine, RotateCcw } from "lucide-react"
import { prepareImageForUpload } from "@/lib/image-upload"
import { UnstyledButton } from "@/components/ui/unstyled-button"
import { Label } from "@/components/ui/label"
import { FileInput } from "@/components/ui/file-input"

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

  // Animación de "escaneo" (puramente visual: no hay OCR acá, la foto se manda
  // después con el formulario).
  //
  // Un solo efecto, y el final vive DENTRO del temporizador. Antes eran dos: uno
  // que subía el progreso y otro que observaba `progress >= 100` para cerrar. Esa
  // separación hacía que el cierre dependiera de un re-render intermedio, y
  // cualquier cosa que alterara `progress` desde afuera podía dispararlo — el
  // final de la animación no es un estado que haya que vigilar, es el último paso
  // de la animación misma.
  const STEPS = 5
  const STEP_MS = 250
  useEffect(() => {
    if (state !== "scanning" || !tempBase64) return
    let step = 0
    const interval = setInterval(() => {
      step += 1
      setProgress(step * (100 / STEPS))
      if (step >= STEPS) {
        clearInterval(interval)
        setState("done")
        onChange(tempBase64)
      }
    }, STEP_MS)
    return () => clearInterval(interval)
  }, [state, tempBase64, onChange])

  const startScan = () => {
    setState("scanning")
    setProgress(0)
  }

  const reset = () => {
    setState("idle")
    setProgress(0)
    setTempBase64(null)
    onChange(null)
  }

  return (
    <div className="space-y-1.5">
      <Label variant="plain" className="text-sm font-semibold text-ink-2">
        {label}
        {required && <span className="text-danger ml-0.5">*</span>}
      </Label>

      <div
        id={id}
        className={`
          relative w-full rounded-xl border-2 border-dashed overflow-hidden
          transition-all duration-300
          ${state === "done"
            ? "border-success/40 bg-success-sunk/50"
            : state === "scanning"
            ? "border-secondary/40 bg-secondary/5"
            : "border-rule bg-sunk/50 hover:border-primary/30 hover:bg-primary/5"
          }
        `}
      >
        {/* Idle State */}
        {state === "idle" && (
          <Label variant="plain" className="w-full p-6 flex flex-col items-center gap-3 cursor-pointer group">
            <FileInput

              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) {
                  // Esta foto viaja en base64 dentro del JSON de «completar», por
                  // el mismo proxy de 4 MB que corta la subida de documentos; en
                  // base64 pesa un tercio más. Se recomprime antes de leerla.
                  void prepareImageForUpload(file).then((prepared) => {
                    const reader = new FileReader()
                    reader.onload = (event) => {
                      if (event.target?.result) {
                        setTempBase64(event.target.result as string)
                        // La animación empieza solo cuando la imagen ya está en
                        // memoria. Antes arrancaba primero y el efecto capturaba
                        // `tempBase64 = null`: con una lectura lenta podía mostrar
                        // "Documento capturado" sin entregar nada al formulario.
                        startScan()
                      }
                    }
                    reader.readAsDataURL(prepared)
                  })
                }
              }}
            />
            <div className="bg-white p-3 rounded-xl shadow-sm border border-rule group-hover:bg-primary/5 group-hover:border-primary/20 transition-all">
              <Camera size={28} className="text-primary" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-ink-2">
                Tomar foto o subir archivo
              </p>
              <p className="text-xs text-ink-3 mt-0.5">
                Asegura buena iluminación y evita reflejos
              </p>
            </div>
          </Label>
        )}

        {/* Scanning State */}
        {state === "scanning" && (
          <div className="p-6 flex flex-col items-center gap-4">
            {/* Scanner visual */}
            <div className="relative w-36 h-24 bg-white/60 rounded-xl border border-secondary/20 flex items-center justify-center overflow-hidden">
              <IdCardPlaceholder />
              <div className="absolute inset-0 bg-secondary/10 flex items-center justify-center">
                <ScanLine className="text-secondary animate-pulse w-8 h-8" />
              </div>
              <div
                className="absolute bottom-0 left-0 bg-secondary/30 w-full transition-all duration-300"
                style={{ height: `${progress}%` }}
              />
            </div>

            <div className="w-full space-y-2">
              <p className="text-sm font-semibold text-secondary text-center animate-pulse">
                Procesando documento...
              </p>
              <div className="w-full bg-sunk h-2 rounded-full overflow-hidden">
                <div
                  className="bg-secondary h-full transition-all duration-300 rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Done State */}
        {state === "done" && (
          <div className="p-5 flex items-center gap-4">
            <div className="bg-success-sunk p-2.5 rounded-xl">
              <CheckCircle2 size={24} className="text-success" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-success">
                Documento capturado
              </p>
              <p className="text-xs text-success mt-0.5">
                Datos cifrados de forma segura
              </p>
            </div>
            <UnstyledButton
              type="button"
              onClick={reset}
              className="p-2 rounded-lg hover:bg-success-sunk/50 text-success transition-colors"
              title="Volver a tomar"
            >
              <RotateCcw size={18} />
            </UnstyledButton>
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
        <div className="w-8 h-8 bg-ink-3 rounded-md" />
        <div className="flex flex-col gap-1 flex-1 py-0.5">
          <div className="h-1.5 w-full bg-ink-3 rounded-full" />
          <div className="h-1.5 w-2/3 bg-ink-3 rounded-full" />
        </div>
      </div>
      <div className="mt-auto h-1.5 w-full bg-ink-3 rounded-full" />
    </div>
  )
}
