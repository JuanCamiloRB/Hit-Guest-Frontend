"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"
import { AlertDialog as AlertDialogPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"
import { blockWhenUnavailable, buttonVariants } from "@/components/ui/button"
import { modalSurface } from "@/components/ui/dialog"

function AlertDialog({
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Root>) {
  return <AlertDialogPrimitive.Root data-slot="alert-dialog" {...props} />
}

function AlertDialogTrigger({
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Trigger>) {
  return <AlertDialogPrimitive.Trigger data-slot="alert-dialog-trigger" {...props} />
}

function AlertDialogPortal({
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Portal>) {
  return <AlertDialogPrimitive.Portal data-slot="alert-dialog-portal" {...props} />
}

function AlertDialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Overlay>) {
  return (
    <AlertDialogPrimitive.Overlay
      data-slot="alert-dialog-overlay"
      className={cn(
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50",
        className
      )}
      {...props}
    />
  )
}

function AlertDialogContent({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Content>) {
  return (
    <AlertDialogPortal>
      <AlertDialogOverlay />
      <AlertDialogPrimitive.Content
        data-slot="alert-dialog-content"
        className={cn(modalSurface, className)}
        {...props}
      />
    </AlertDialogPortal>
  )
}

function AlertDialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-header"
      className={cn("flex flex-col gap-2 text-center sm:text-left", className)}
      {...props}
    />
  )
}

function AlertDialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-footer"
      className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}
      {...props}
    />
  )
}

function AlertDialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Title>) {
  return (
    <AlertDialogPrimitive.Title
      data-slot="alert-dialog-title"
      className={cn("text-lg font-semibold", className)}
      {...props}
    />
  )
}

function AlertDialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Description>) {
  return (
    <AlertDialogPrimitive.Description
      data-slot="alert-dialog-description"
      className={cn("text-ink-2 text-sm", className)}
      {...props}
    />
  )
}

// Sin `asChild`: el indicador de carga se suma a los hijos y un Slot exige uno solo.
interface AlertDialogActionProps extends Omit<React.ComponentProps<typeof AlertDialogPrimitive.Action>, "asChild"> {
  /**
   * La acción es asíncrona: el clic NO cierra el diálogo (Radix lo cerraba al
   * instante, así que «Eliminando…» nunca se veía y un fallo quedaba sin
   * contexto). Quien la usa lo cierra al terminar bien.
   */
  keepOpen?: boolean
  /**
   * En curso: indicador, `pendingLabel`, `aria-busy` y `aria-disabled`, y no se
   * repite ni cierra. Como `Button loading`: NO usa `disabled` (conserva color
   * y foco).
   */
  pending?: boolean
  /** Lo que dice mientras está en curso («Eliminando…»). */
  pendingLabel?: string
}

function AlertDialogAction({
  className,
  keepOpen = false,
  pending = false,
  pendingLabel,
  disabled,
  onClick,
  onClickCapture,
  children,
  ...props
}: AlertDialogActionProps) {
  // Mismo contrato que Button: no disponible = pending || aria-disabled explícito.
  const unavailable = pending || props["aria-disabled"] === true || props["aria-disabled"] === "true"
  return (
    <>
      <AlertDialogPrimitive.Action
        className={cn(buttonVariants(), className)}
        disabled={disabled}
        aria-busy={pending || undefined}
        data-loading={pending || undefined}
        {...props}
        aria-disabled={unavailable || undefined}
        // Captura: antes que el cierre de Radix y que cualquier contenedor.
        onClickCapture={(event) => {
          if (unavailable) return blockWhenUnavailable(event, true)
          onClickCapture?.(event)
        }}
        onClick={(event) => {
          if (keepOpen) event.preventDefault()
          onClick?.(event)
        }}
      >
        {pending && <Loader2 className="animate-spin" aria-hidden />}
        {pending && pendingLabel ? pendingLabel : children}
      </AlertDialogPrimitive.Action>
      {/* Lo anuncia aunque el lector de pantalla esté en otra parte del diálogo. */}
      {keepOpen && <span role="status" className="sr-only">{pending ? pendingLabel ?? "" : ""}</span>}
    </>
  )
}

function AlertDialogCancel({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Cancel>) {
  return (
    <AlertDialogPrimitive.Cancel
      className={cn(buttonVariants({ variant: "outline" }), className)}
      {...props}
    />
  )
}

export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogTitle,
  AlertDialogTrigger,
}
