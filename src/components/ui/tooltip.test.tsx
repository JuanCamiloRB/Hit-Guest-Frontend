import { describe, expect, it } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { Button } from "./button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./tooltip"

// Radix Tooltip mide el disparador; jsdom no trae ResizeObserver.
globalThis.ResizeObserver = globalThis.ResizeObserver ?? class { observe() {} unobserve() {} disconnect() {} }

function Demo() {
    return (
        <TooltipProvider delayDuration={0}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon-sm" aria-label="Contraer menú">×</Button>
                </TooltipTrigger>
                <TooltipContent side="right">Contraer menú</TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}

describe("Tooltip", () => {
    it("aparece al enfocar con teclado y se va con Escape; el nombre del control no depende de él", async () => {
        const user = userEvent.setup()
        render(<Demo />)
        const trigger = screen.getByRole("button", { name: "Contraer menú" })
        expect(screen.queryByRole("tooltip")).toBeNull()
        await user.tab()
        expect(trigger).toHaveFocus()
        expect(await screen.findByRole("tooltip")).toHaveTextContent("Contraer menú")
        await user.keyboard("{Escape}")
        await waitFor(() => expect(screen.queryByRole("tooltip")).toBeNull())
    })

    it("aparece al pasar el mouse", async () => {
        const user = userEvent.setup()
        render(<Demo />)
        await user.hover(screen.getByRole("button", { name: "Contraer menú" }))
        expect(await screen.findByRole("tooltip")).toBeInTheDocument()
    })
})
