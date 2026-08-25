import type { VerificationResult } from "@didit-protocol/sdk-web"

export type DiditCompletionAction = "reconcile" | "cancelled" | "expired" | "failed"

/**
 * El SDK informa que el iframe terminó mediante `type`, no mediante el estado
 * de la sesión. En v0.2.1 `buildSessionData()` usa `Pending` si el evento
 * `didit:completed` no trae status, por lo que exigir `Approved` produce un
 * falso error aunque el webhook ya haya aprobado la verificación en backend.
 *
 * `completed` solo significa "cerró el flujo de Didit": la decisión final se
 * reconcilia siempre contra el portal y `/verify/result`.
 */
export function diditCompletionAction(
    result: Pick<VerificationResult, "type" | "error">,
): DiditCompletionAction {
    if (result.type === "completed") return "reconcile"
    if (result.type === "cancelled") return "cancelled"
    if (result.error?.type === "sessionExpired") return "expired"
    return "failed"
}
