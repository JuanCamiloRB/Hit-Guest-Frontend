import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { DocumentUpload } from "./DocumentUpload"

class ControlledFileReader {
  static latest: ControlledFileReader | null = null

  onload: ((event: ProgressEvent<FileReader>) => void) | null = null

  constructor() {
    ControlledFileReader.latest = this
  }

  readAsDataURL(): void {}

  finish(result: string): void {
    this.onload?.({ target: { result } } as unknown as ProgressEvent<FileReader>)
  }
}

describe("DocumentUpload", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    ControlledFileReader.latest = null
    vi.stubGlobal("FileReader", ControlledFileReader)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it("no inicia ni confirma la captura antes de terminar de leer el archivo", () => {
    const onChange = vi.fn()
    const { container } = render(
      <DocumentUpload label="Documento" value={null} onChange={onChange} />,
    )
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(["documento"], "documento.png", { type: "image/png" })

    fireEvent.change(input, { target: { files: [file] } })

    expect(screen.queryByText("Procesando documento...")).not.toBeInTheDocument()
    act(() => vi.advanceTimersByTime(2_000))
    expect(onChange).not.toHaveBeenCalled()

    act(() => ControlledFileReader.latest?.finish("data:image/png;base64,abc"))
    expect(screen.getByText("Procesando documento...")).toBeInTheDocument()

    act(() => vi.advanceTimersByTime(1_250))
    expect(onChange).toHaveBeenCalledOnce()
    expect(onChange).toHaveBeenCalledWith("data:image/png;base64,abc")
    expect(screen.getByText("Documento capturado")).toBeInTheDocument()
  })
})
