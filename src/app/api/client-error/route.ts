import { NextRequest, NextResponse } from "next/server"

/**
 * POST /api/client-error
 *
 * Receptor del beacon que emite el error boundary del check-in. Existe porque
 * un crash de render ocurre en el teléfono del huésped: su consola es
 * inalcanzable y, sin esto, el único rastro del incidente es un screenshot por
 * WhatsApp (incidente 2026-08-20 — hubo que reconstruirlo sin ningún log).
 * Registrar acá lo sube a los logs del servidor con la ruta (que incluye el
 * uuid de la reserva) y el user-agent reales.
 *
 * Solo registra y responde 204: no persiste, no reenvía a terceros, y recorta
 * el cuerpo para que un cliente roto no pueda inflar los logs.
 */
export async function POST(req: NextRequest) {
    const raw = (await req.text().catch(() => "")).slice(0, 2000)
    let report: Record<string, unknown> = {}
    try {
        report = JSON.parse(raw) as Record<string, unknown>
    } catch {
        report = { raw }
    }
    console.error("[client-error]", JSON.stringify({
        digest: typeof report.digest === "string" ? report.digest : null,
        message: typeof report.message === "string" ? report.message.slice(0, 500) : null,
        pathname: typeof report.pathname === "string" ? report.pathname.slice(0, 300) : null,
        userAgent: req.headers.get("user-agent"),
    }))
    return new NextResponse(null, { status: 204 })
}
