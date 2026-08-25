/**
 * Traduce la máquina de estados `verification` del backend (§A del contrato de
 * endpoints) a la decisión que el front tiene que tomar.
 *
 * Vive acá y no dentro del servicio por la misma razón que
 * `complete-failure.ts`: es una regla de negocio pura —15 estados posibles, con
 * un orden de evaluación que importa— y dentro del servicio HTTP no se podía
 * probar sin simular la red. El servicio se queda con el transporte; esta
 * función, con el significado.
 *
 * El orden replica el de `buildGuestVerificationStatus()` en backend: primero
 * los terminales, después los que exigen una acción distinta a esperar, y solo
 * al final el "seguir sondeando".
 */

import type { VerificationResultResponse } from "../types/checkin"

/** Lo que el backend expone del estado de verificación, tal como llega. */
interface RawVerification {
    status?: string
    currentStep?: string
    sessionType?: "biometric" | "kyc" | null
    session_type?: "biometric" | "kyc" | null
    isStale?: boolean
    is_stale?: boolean
    verificationUrl?: string | null
    verification_url?: string | null
}

export function normalizeVerificationResult(raw: unknown): VerificationResultResponse {
    const body = (raw ?? {}) as Record<string, unknown>

    // Forma plana legacy — se respeta tal cual.
    if (body.status === "verified" || body.status === "kyc_required" || body.status === "failed") {
        return body as unknown as VerificationResultResponse
    }

    const v = ((body.verification as RawVerification | undefined) ?? body) as RawVerification
    // Didit usa `Approved`; el portal suele usar `approved`. La capitalización
    // no puede decidir si una identidad ya aprobada se muestra como error/espera.
    const status = v.status?.trim().toLowerCase()
    const currentStep = v.currentStep?.trim().toLowerCase()
    const sessionType = v.sessionType ?? v.session_type
    const verificationUrl = v.verificationUrl ?? v.verification_url
    const isStale = v.isStale ?? v.is_stale ?? false

    // El check-in ya terminado gana sobre todo lo demás, igual que en backend
    // (`is_checkin_completed` es la primera rama de `buildGuestVerificationStatus`).
    if (status === "completed" || currentStep === "completed") {
        return { status: "verified" }
    }

    // El OTP de posesión pendiente se evalúa ANTES que "aprobado", en el mismo
    // orden que el backend y por el mismo motivo que él documenta: no reportar
    // 'approved'/'form' prematuramente mientras el huésped no probó que sigue
    // teniendo acceso al correo. Al revés, una respuesta que trajera ambas cosas
    // mandaría al formulario a alguien cuya posesión no está probada — y los
    // endpoints que siguen la exigen igual, con un 401.
    if (status === "contact_challenge_pending" || currentStep === "contact_challenge") {
        return { status: "contact_challenge" }
    }

    if (currentStep === "form" || status === "approved" || status === "verified") {
        return { status: "verified" }
    }

    // El rechazo de OCR es reintentable de inmediato con mejores fotos; el de
    // Didit no. Ambos llegan con currentStep "rejected", así que sin mirar el
    // `status` se mandaba al huésped de OCR a contactar al anfitrión cuando solo
    // necesitaba repetir la foto.
    if (status === "ocr_rejected") {
        return { status: "failed", retryable: true, failureReason: "ocr_rejected" }
    }
    if (currentStep === "rejected" || status === "rejected" || status === "fail" || status === "expired") {
        const failureReason = status === "fail" || status === "expired" || status === "rejected"
            ? status
            : "rejected"
        return { status: "failed", retryable: false, failureReason }
    }

    // La creación de la sesión KYC falló. La `verificationUrl` que pueda venir
    // acá es la del biométrico YA CONSUMIDO — relanzarla da 403 en Didit. La
    // única salida es volver a /identify, donde el backend la reintenta sin
    // pedirle al huésped repetir el reconocimiento facial.
    if (status === "kyc_session_failed") {
        return { status: "restart_required" }
    }

    // El backend decide cuándo una espera quedó huérfana. No se replica acá su
    // ventana (10 minutos por defecto): `isStale` es la única señal para dejar
    // de bloquear al huésped y enviarlo a soporte.
    if (isStale) {
        return { status: "stale" }
    }

    // La escalada a documento no se deduce de `pass`: tras aprobar biometría el
    // backend vuelve a `pending` y cambia la etapa a `sessionType:"kyc"`, con
    // una URL nueva. La URL sola tampoco alcanza porque puede ser la sesión
    // biométrica en curso o ya consumida.
    if (sessionType === "kyc" && verificationUrl) {
        return { status: "kyc_required", kycUrl: verificationUrl }
    }

    return { status: "pending" }
}
