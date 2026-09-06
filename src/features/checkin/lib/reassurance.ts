/**
 * Frases de espera que cambian con el tiempo transcurrido.
 *
 * Pedido de producto (Didier, 2026-09-06): un spinner con texto congelado se
 * lee como "se quedó en un loop" y el huésped desesperado empieza a hacer
 * clics — que es literalmente el origen del estado `abandoned`. Las frases
 * transmiten ACTIVIDAD y normalidad; nunca estimaciones que no tenemos
 * («ya falta poco» sería mentir: la ventana la decide el backend).
 *
 * Rotación por tramos, no cíclica: repetir en bucle delata el truco, y un
 * orden fijo cuenta una historia coherente a quien mira dos veces.
 */

export interface ReassurancePhrase {
    /** Segundos desde que empezó la espera a partir de los cuales aplica. */
    from: number
    text: string
}

/** La frase del tramo actual: la última cuyo `from` ya se alcanzó. */
export function phraseForElapsed(seconds: number, script: ReassurancePhrase[]): string {
    let current = script[0]?.text ?? ""
    for (const phrase of script) {
        if (seconds >= phrase.from) current = phrase.text
    }
    return current
}

/** Espera de la verificación Didit — puede llegar a varios minutos. */
export const DIDIT_WAIT_SCRIPT: ReassurancePhrase[] = [
    { from: 0, text: "Conectando con el sistema de verificación…" },
    { from: 8, text: "Didit está analizando tu captura…" },
    { from: 20, text: "Verificando los datos de tu documento…" },
    // Estadística suave, no promesa: la única frase con sabor a "falta poco".
    { from: 40, text: "Casi siempre esto ya terminó — le estamos dando unos segundos más…" },
    {
        from: 75,
        text: "Tu verificación sigue en proceso. A veces toma unos minutos: puedes mantener esta pantalla abierta con tranquilidad.",
    },
    {
        from: 180,
        text: "Seguimos esperando la confirmación de Didit. No necesitas hacer nada — apenas responda, avanzas automáticamente.",
    },
]

/** Confirmación de la tarjeta de garantía — el sondeo corta a los 60 s. */
export const CARD_WAIT_SCRIPT: ReassurancePhrase[] = [
    { from: 0, text: "Registrando tu tarjeta de forma segura…" },
    { from: 10, text: "El banco está confirmando la autorización…" },
    { from: 25, text: "Esto puede tomar unos segundos más — no cierres la pantalla…" },
    { from: 45, text: "Últimas comprobaciones de seguridad…" },
]
