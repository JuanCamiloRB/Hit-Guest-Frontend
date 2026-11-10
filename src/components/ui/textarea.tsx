import * as React from "react"

import { cn } from "@/lib/utils"
import { fieldStates } from "@/components/ui/input"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "dark:bg-input/30 flex field-sizing-content min-h-16 w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow,border-color] outline-none md:text-sm",
        fieldStates,
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
