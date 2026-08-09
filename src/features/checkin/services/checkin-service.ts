import { API_BASE } from "@/lib/config"
import {
  CheckinPortalResponse,
  IdentifyPayload,
  IdentifyResponse,
  OCRResult,
  CompleteMainGuestPayload,
  CompleteSecondaryGuestPayload,
  CompleteGuestResponse,
  SignMainGuestPayload,
  SignMainGuestResponse,
  ContractPreview,
  GuaranteeSetupIntent,
  GuaranteeStatusResponse,
  VerifyContactChallengeResponse,
  ResendContactChallengeResponse,
  GuestFormSchemaResponse,
  CheckinUserField,
  CheckinFieldType,
  VerificationResultResponse,
  FormSchema,
} from "../types/checkin"
import {
  mockIdentifyResponse,
  mockPortalResponse,
  mockCompleteResponse,
  mockFormSchemaResponse,
  mockOCRResult,
  mockVerificationResult,
} from "../data/mock-guest-data"
import { getVerificationToken } from "../lib/verification-token"
import { normalizeVerificationResult } from "../lib/verification-result"
import type { CheckinApiError, CheckinFailedField } from "../lib/checkin-error"

const USE_MOCK = false;

/**
 * Converts a single snake_case string to camelCase.
 * e.g. "country_of_origin_id" → "countryOfOriginId"
 */
function snakeToCamel(s: string): string {
    return s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())
}

/**
 * Normalizes a FormSchema from the backend's snake_case response to frontend camelCase.
 * Backend sends: { required_fields: ["country_of_origin_id"], optional_fields: [...], prefilledData: {...} }
 * Frontend uses: { requiredFields: ["countryOfOriginId"], optionalFields: [...], prefilledData: {...} }
 * IMPORTANT: field names inside the arrays are also converted (snake_case values → camelCase values).
 */
/**
 * Maps the backend document type name to its Spanish label for guest display.
 * Falls back to the raw type if unknown.
 */
function localizeDocumentType(type: string): string {
    const map: Record<string, string> = {
        Agreement: "Contrato",
        Rules: "Reglamento",
        Instructions: "Instrucciones",
        "Privacy Policy": "Política de privacidad",
    }
    return map[type] ?? type ?? "Documento"
}

// La traducción de la máquina de estados `verification` (§A) vive en
// `lib/verification-result.ts`: es una regla de negocio pura y acá adentro no se
// podía probar sin simular la red.

/**
 * Parses provider-declared dynamic fields (v4.6) from `user_fields`.
 * Auto-resolved fields (type "auto") are stripped server-side, but we defensively
 * skip them here too. Legacy plain-string entries are coerced to a text field.
 * The `key` is preserved verbatim (snake_case) because it's the exact `extra` key.
 */
/**
 * Payload sin validar del backend. Se escribe así, y no `any`, porque estas
 * funciones existen justamente para lidiar con un shape del que no se puede
 * asumir nada: `unknown` obliga a comprobar cada campo antes de leerlo, que es
 * lo que ya hacen; `any` dejaba que un typo compilara sin queja.
 */
type RawPayload = Record<string, unknown> | null | undefined

/** Lee una propiedad de un payload sin validar, sin asumir que es un objeto. */
function pick(raw: RawPayload, key: string): unknown {
    return raw && typeof raw === "object" ? raw[key] : undefined
}

function normalizeUserFields(raw: RawPayload): CheckinUserField[] {
    const arr = pick(raw, "user_fields") ?? pick(raw, "userFields")
    if (!Array.isArray(arr)) return []
    const out: CheckinUserField[] = []
    for (const entry of arr) {
        if (typeof entry === "string") {
            out.push({ key: entry, type: "text", required: false })
            continue
        }
        if (!entry || typeof entry !== "object") continue
        const f = entry as Record<string, unknown>
        if (!f.key) continue
        if (f.type === "auto") continue // auto fields are backend-only
        const fieldType: CheckinFieldType = f.type === "number" || f.type === "select" ? f.type : "text"
        const categoryId = f.catalog_category_id ?? f.catalogCategoryId
        const label = f.label ?? f.name
        out.push({
            key: String(f.key),
            type: fieldType,
            required: !!(f.required ?? f.is_required),
            catalogCategoryId: typeof categoryId === "number" ? categoryId : undefined,
            label: typeof label === "string" ? label : undefined,
        })
    }
    return out
}

function normalizeFormSchema(raw: RawPayload): FormSchema {
    const toStringArray = (v: unknown): string[] =>
        Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []
    const prefilled = pick(raw, "prefilledData") ?? pick(raw, "prefilled_data")
    return {
        requiredFields: toStringArray(pick(raw, "required_fields") ?? pick(raw, "requiredFields")).map(snakeToCamel),
        optionalFields: toStringArray(pick(raw, "optional_fields") ?? pick(raw, "optionalFields")).map(snakeToCamel),
        prefilledData: (prefilled && typeof prefilled === "object" ? prefilled : {}) as Record<string, unknown>,
        userFields: normalizeUserFields(raw),
    }
}

export class CheckinService {

    // ═══════════════════════════════════════════════════════
    // NEW API v4.0 — Aligned with real backend endpoints
    // ═══════════════════════════════════════════════════════

    /**
     * GET /api/v1/checkin/{reservationUuid}
     * Portal response with reservation, progress, and registeredGuests[].
     */
    async getPortal(reservationUuid: string): Promise<CheckinPortalResponse> {
        if (USE_MOCK) {
            await new Promise(res => setTimeout(res, 500));
            return mockPortalResponse();
        }
        const url = `${API_BASE}/checkin/${reservationUuid}`
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Accept-Language": "es",
            "X-Locale": "es",
        }
        const response = await fetch(url, { headers, cache: "no-store" })
        if (!response.ok) {
            const err = await response.json().catch(() => ({}))
            // Mismo error enriquecido que el resto del servicio: varios llamadores
            // deciden con `e.status` (404 → dejar de sondear /verify/result, 401 →
            // rebotar al OTP) y con un `Error` pelado esa rama nunca se cumplía.
            throw this.buildHttpError(response.status, err, response.headers)
        }
        const json = await response.json()
        const portal = json.data || json
        const rawCodes = portal.smartlockCodes ?? portal.smartlock_codes

        return {
            ...portal,
            smartlockCodes: Array.isArray(rawCodes)
                ? rawCodes.map((code: Record<string, unknown>) => ({
                    name: String(code.name ?? "Acceso"),
                    type: String(code.type ?? "amenity"),
                    code: String(code.code ?? ""),
                    validFrom: String(code.validFrom ?? code.valid_from ?? ""),
                    validUntil: String(code.validUntil ?? code.valid_until ?? ""),
                }))
                : undefined,
        } as CheckinPortalResponse
    }

    /**
     * POST /api/v1/checkin/{reservationUuid}/identify
     * Identifies if guest exists, returns verification strategy + form schema.
     * This is the CORE endpoint that drives the entire flow.
     *
     * Backend returns formSchema with snake_case keys (required_fields, optional_fields).
     * This method normalizes them to camelCase for frontend consumption.
     */
    async identify(reservationUuid: string, payload: IdentifyPayload): Promise<IdentifyResponse> {
        if (USE_MOCK) {
            await new Promise(res => setTimeout(res, 800));
            return mockIdentifyResponse(payload);
        }
        
        // Duplicate fields to snake_case to prevent backend mapping issues.
        // NOTE: we intentionally DO NOT send return_url. The Didit redirect/callback
        // is configured at the workflow level in Didit (pointing to the frontend's
        // /checkin/didit/callback on Vercel). Sending a per-session return_url here was
        // overriding that workflow callback, so the front no longer sends one.
        const apiPayload = {
            ...payload,
            nationality_id: payload.nationalityId,
            identification_type_id: payload.identificationTypeId,
            identification_number: payload.identificationNumber,
            is_main_guest: payload.isMainGuest,
        };

        // Solo `formSchema` se normaliza; el resto del cuerpo ya viene con la
        // forma del contrato (§7), así que se tipa la respuesta cruda como el
        // contrato menos ese campo, en vez de anular el chequeo con `any`.
        const raw = await this.postWithAppToken<
            Omit<IdentifyResponse, "formSchema"> & { formSchema?: RawPayload }
        >(`${API_BASE}/checkin/${reservationUuid}/identify`, apiPayload);
        return {
            guest: raw.guest,
            reservationGuest: raw.reservationGuest,
            verification: raw.verification,
            formSchema: normalizeFormSchema(raw.formSchema),
        };
    }

    /**
     * GET /api/v1/checkin/{reservationUuid}/form/{guestUuid} (G-NEW-4)
     * Returns the dynamic form schema for this guest.
     *
     * Backend response is wrapped: { formSchema: { required_fields, optional_fields, prefilledData } }
     * This method unwraps and normalizes to camelCase GuestFormSchemaResponse.
     * Catalogs are NOT included — frontend must load them separately via CatalogService.
     */
    async getGuestFormSchema(
        reservationUuid: string,
        guestUuid: string
    ): Promise<GuestFormSchemaResponse> {
        if (USE_MOCK) {
            await new Promise(res => setTimeout(res, 400));
            return mockFormSchemaResponse();
        }
        const raw = await this.getWithAppToken<Record<string, unknown>>(
            `${API_BASE}/checkin/${reservationUuid}/form/${guestUuid}`,
            this.withVerificationToken(reservationUuid, guestUuid),
        );
        const schema = (pick(raw, "formSchema") ?? raw) as RawPayload;
        const normalized = normalizeFormSchema(schema) as GuestFormSchemaResponse;
        // `user_fields` may live at the top level (sibling of `formSchema`) instead
        // of nested inside it. If the nested lookup found none, try the top level so
        // provider-declared fields (TRA/SIRE) aren't lost to a wrapping difference.
        if (!normalized.userFields || normalized.userFields.length === 0) {
            const topLevel = normalizeUserFields(raw);
            if (topLevel.length > 0) normalized.userFields = topLevel;
        }
        return normalized;
    }

    /**
     * GET /api/v1/checkin/{reservationUuid}/contract/preview
     * The authoritative contract for this reservation's channel — replaces
     * picking a document out of `documents[]` (see ContractPreview jsdoc).
     * 422 when the property's routing isn't configured for this channel; the
     * caller surfaces that as "contact support", not something the guest can fix.
     */
    async getContractPreview(reservationUuid: string): Promise<ContractPreview> {
        return this.getWithAppToken(`${API_BASE}/checkin/${reservationUuid}/contract/preview`)
    }

    /**
     * POST /api/v1/checkin/{reservationUuid}/main/guarantee/setup-intent
     * (card-on-file plan 20260731). Only call when contract/preview.guarantee
     * is present — the backend 422s otherwise (errors.checkin.guarantee_not_required).
     * Creates a NEW Stripe SetupIntent every call; safe to retry after the
     * guest abandons or a previous attempt failed, no cleanup needed.
     */
    async createGuaranteeSetupIntent(
        reservationUuid: string,
        guestUuid: string,
    ): Promise<GuaranteeSetupIntent> {
        return this.postWithAppToken(
            `${API_BASE}/checkin/${reservationUuid}/main/guarantee/setup-intent`,
            { guestUuid },
            this.withVerificationToken(reservationUuid, guestUuid),
        )
    }

    /**
     * GET /api/v1/checkin/{reservationUuid}/main/guarantee/status?guest_uuid={uuid}
     * Polled after stripe.confirmCardSetup() resolves — its result is NOT the
     * source of truth, the backend only knows once its Stripe webhook lands
     * (same "don't trust the client, poll the backend" shape as Didit
     * verification). `guest_uuid` is snake_case in the query string, same as
     * checkVerificationResult below — POST bodies are camelCase, GET query
     * strings are not.
     */
    async getGuaranteeStatus(
        reservationUuid: string,
        guestUuid: string,
    ): Promise<GuaranteeStatusResponse> {
        const params = new URLSearchParams({ guest_uuid: guestUuid })
        return this.getWithAppToken(
            `${API_BASE}/checkin/${reservationUuid}/main/guarantee/status?${params.toString()}`,
        )
    }

    /**
     * POST /api/v1/checkin/{reservationUuid}/contact-challenges/{challengeId}/verify
     * (OTP plan 20260731). Confirms the 6-digit code sent to the recurring
     * guest's historical email. On success, the caller must persist
     * `verificationToken` (sessionStorage, via verification-token.ts) — it's
     * required as `X-Checkin-Verification-Token` on /form, /sign,
     * /guarantee/setup-intent and both /complete endpoints from this point on.
     * Rate limit: 10 req/min per challengeId (backend-enforced, surfaces as 429).
     */
    async verifyContactChallenge(
        reservationUuid: string,
        challengeId: string,
        code: string,
    ): Promise<VerifyContactChallengeResponse> {
        return this.postWithAppToken(
            `${API_BASE}/checkin/${reservationUuid}/contact-challenges/${challengeId}/verify`,
            { code },
        )
    }

    /**
     * POST /api/v1/checkin/{reservationUuid}/contact-challenges/{challengeId}/resend
     * (OTP plan 20260731). Invalidates the given challengeId — the caller MUST
     * replace its stored challengeId with the one in this response before the
     * next /verify call. v1 only supports "email" (no WhatsApp/SMS in backend
     * yet), so the channel is sent explicitly rather than left to a UI selector.
     */
    async resendContactChallenge(
        reservationUuid: string,
        challengeId: string,
    ): Promise<ResendContactChallengeResponse> {
        return this.postWithAppToken(
            `${API_BASE}/checkin/${reservationUuid}/contact-challenges/${challengeId}/resend`,
            { channel: "email" },
        )
    }

    /**
     * POST /api/v1/checkin/{reservationUuid}/main/sign (v4.4)
     * Saves the native HIT Guest signature for the main guest BEFORE /main/complete.
     * Only used when the property's contract provider is "hitguest".
     * Re-calling overwrites the current signature (adds an attempt to the history).
     */
    async signMainGuest(
        reservationUuid: string,
        payload: SignMainGuestPayload
    ): Promise<SignMainGuestResponse> {
        return this.postWithAppToken(
            `${API_BASE}/checkin/${reservationUuid}/main/sign`,
            payload,
            this.withVerificationToken(reservationUuid, payload.guestUuid),
        )
    }

    /**
     * POST /api/v1/checkin/{reservationUuid}/main/complete (G-NEW-1)
     * Submits the main guest data: profile + extra. The signature is sent
     * separately via signMainGuest() (v4.4) — it is NOT part of this payload.
     * NOTE: This is called from ContractScreen, NOT GuestFormScreen.
     * GuestFormScreen only saves profile/extra to localStorage and navigates to /contract.
     */
    async completeMainGuest(
        reservationUuid: string,
        payload: CompleteMainGuestPayload
    ): Promise<CompleteGuestResponse> {
        if (USE_MOCK) {
            await new Promise(res => setTimeout(res, 1000));
            return mockCompleteResponse(true);
        }
        return this.postWithAppToken(
            `${API_BASE}/checkin/${reservationUuid}/main/complete`,
            payload,
            this.withVerificationToken(reservationUuid, payload.guestUuid),
        );
    }

    /**
     * POST /api/v1/checkin/{reservationUuid}/secondary/{guestUuid}/complete (G-NEW-2)
     * Submits secondary guest form data.
     */
    async completeSecondaryGuest(
        reservationUuid: string,
        guestUuid: string,
        payload: CompleteSecondaryGuestPayload
    ): Promise<CompleteGuestResponse> {
        if (USE_MOCK) {
            await new Promise(res => setTimeout(res, 1000));
            return mockCompleteResponse(false);
        }
        return this.postWithAppToken(
            `${API_BASE}/checkin/${reservationUuid}/secondary/${guestUuid}/complete`,
            payload,
            this.withVerificationToken(reservationUuid, guestUuid),
        );
    }

    /**
     * POST /api/v1/checkin/{reservationUuid}/secondary/{guestUuid}/documents (G-NEW-3)
     * Uploads document images for OCR (Textract) + a selfie for face comparison (Rekognition, v4.7).
     * FormData keys: "front_image", "back_image" (conditional), "selfie_image" (required)
     * — snake_case, since multipart/form-data has no auto-conversion.
     */
    async uploadDocumentImages(
        reservationUuid: string,
        guestUuid: string,
        payload: FormData
    ): Promise<OCRResult> {
        if (USE_MOCK) {
            await new Promise(res => setTimeout(res, 1500));
            return mockOCRResult();
        }
        // X-Locale makes the backend return OCR error messages in Spanish. We do NOT
        // set Content-Type here — the browser must set the multipart boundary itself.
        const uploadHeaders: Record<string, string> = {
            "Accept": "application/json",
            "Accept-Language": "es",
            "X-Locale": "es",
        }
        const uploadRes = await fetch(
            `${API_BASE}/checkin/${reservationUuid}/secondary/${guestUuid}/documents`,
            { method: "POST", headers: uploadHeaders, body: payload }
        )
        if (!uploadRes.ok) {
            const err = await uploadRes.json().catch(() => ({}))
            // Preserve the backend's localized message + structured OCR failure detail
            // so the UI can show exactly why verification failed.
            throw this.buildHttpError(uploadRes.status, err, uploadRes.headers)
        }
        const uploadJson = await uploadRes.json()
        return uploadJson?.data ?? uploadJson
    }

    /**
     * GET /api/v1/checkin/{reservationUuid}/verify/result?guest_uuid={guestUuid}&session_id={verificationSessionId}
     * Called after a Didit biometric session completes (via SDK onComplete or Didit callback redirect).
     * Backend evaluates the Didit webhook result and returns:
     *   - "verified"    : guest existed in Didit with valid docs → go to form
     *   - "kyc_required": guest is new to Didit → frontend must launch KYC session with kycUrl
     *   - "failed"      : biometric failed → show error
     *
     * identificationNumberTrigger is ONLY used for mock routing (111 → verified, 112 → kyc_required).
     * verificationSessionId is the ID Didit sends in the callback URL (?verificationSessionId=xxx).
     */
    /**
     * GET /api/v1/checkin/didit/session/{sessionId}/context
     *
     * Recupera a qué reserva y huésped pertenece una sesión de Didit. Es la única
     * salida cuando el huésped vuelve del callback sin contexto: en navegadores
     * embebidos (WhatsApp/Instagram → Safari) y en modo privado el localStorage no
     * se comparte, y si el backend no anexó la reserva a la URL no queda nada
     * local que leer. El `verificationSessionId` del callback sí sobrevive siempre.
     *
     * Devuelve las claves en snake_case — es el único endpoint del portal así, y
     * por eso se normalizan acá y no en el componente.
     *
     * Los dos 404 posibles (`SESSION_NOT_FOUND` y `SESSION_RESERVATION_NOT_FOUND`)
     * significan lo mismo para el huésped: no hay a dónde llevarlo. Se devuelve
     * `null` en vez de propagar, porque el llamador ya tiene una pantalla para eso.
     */
    async resolveDiditSessionContext(
        verificationSessionId: string,
    ): Promise<{ reservationUuid: string; guestUuid: string } | null> {
        try {
            const raw = await this.getWithAppToken<Partial<{
                reservation_uuid: string
                guest_uuid: string
                // Tolerado por si el backend alguna vez alinea este endpoint con
                // el camelCase del resto del portal.
                reservationUuid: string
                guestUuid: string
            }>>(`${API_BASE}/checkin/didit/session/${verificationSessionId}/context`)
            const reservationUuid = raw?.reservation_uuid ?? raw?.reservationUuid
            const guestUuid = raw?.guest_uuid ?? raw?.guestUuid
            if (!reservationUuid || !guestUuid) return null
            return { reservationUuid, guestUuid }
        } catch (e) {
            console.error("[checkinService] no se pudo resolver el contexto de la sesión Didit", e)
            return null
        }
    }

    async checkVerificationResult(
        reservationUuid: string,
        guestUuid: string,
        identificationNumberTrigger?: string,
        verificationSessionId?: string
    ): Promise<VerificationResultResponse> {
        if (USE_MOCK) {
            await new Promise(res => setTimeout(res, 1000))
            return mockVerificationResult(identificationNumberTrigger || '111')
        }
        const params = new URLSearchParams({ guest_uuid: guestUuid })
        if (verificationSessionId) params.set('session_id', verificationSessionId)
        const raw = await this.getWithAppToken<unknown>(
            `${API_BASE}/checkin/${reservationUuid}/verify/result?${params.toString()}`
        )
        return normalizeVerificationResult(raw)
    }

    /**
     * Returns the property documents for a reservation, each rendered to HTML.
     *
     * The portal response (GET /checkin/{uuid}) already includes the active
     * documents array with checkin-scoped render/pdf URLs, so there's no need
     * to resolve property → documents ourselves. We just render each one.
     *
     * @param portal Optional pre-fetched portal to avoid a duplicate request.
     */
    async getReservationDocuments(
        reservationUuid: string,
        portal?: CheckinPortalResponse
    ): Promise<Array<{
        uuid: string
        typeName: string
        renderedHtml: string
    }>> {
        const resolved = portal ?? await this.getPortal(reservationUuid)
        const docList = resolved.documents ?? []
        if (docList.length === 0) return []

        const rendered = await Promise.allSettled(
            docList.map(async (doc) => {
                const html = await this.renderDocument(reservationUuid, doc.uuid)
                return { uuid: doc.uuid, typeName: localizeDocumentType(doc.type), renderedHtml: html }
            })
        )

        return rendered
            .filter((r): r is PromiseFulfilledResult<{ uuid: string; typeName: string; renderedHtml: string }> =>
                r.status === "fulfilled"
            )
            .map(r => r.value)
    }

    // ── Property Documents (guest view) ──
    // Checkin-scoped endpoints — work with the app token, no PM session needed.

    /**
     * GET /checkin/{reservationUuid}/documents/{documentUuid}/render
     * Returns the document HTML with shortcodes replaced with reservation data.
     */
    async renderDocument(reservationUuid: string, documentUuid: string): Promise<string> {
        const headers: Record<string, string> = { "Accept": "application/json" }
        const res = await fetch(
            `${API_BASE}/checkin/${reservationUuid}/documents/${documentUuid}/render`,
            { headers, cache: "no-store" }
        )
        if (!res.ok) {
            const err = await res.json().catch(() => ({}))
            throw this.buildHttpError(res.status, err, res.headers)
        }
        const json = await res.json() as RawPayload
        const data = pick(json, "data") as RawPayload
        const rendered = pick(data, "rendered") ?? pick(json, "rendered")
        return typeof rendered === "string" ? rendered : ""
    }

    /**
     * Absolute URL of the SIGNED contract PDF (with signature + legal evidence page).
     * GET /checkin/{reservationUuid}/contract/signed — public, byte stream.
     */
    getSignedContractUrl(reservationUuid: string): string {
        return `${API_BASE}/checkin/${reservationUuid}/contract/signed`
    }

    /**
     * Abre el PDF del contrato FIRMADO en una pestaña nueva.
     *
     * Se descarga con fetch en vez de navegar a la URL porque este endpoint no
     * siempre devuelve un PDF: §4 del contrato lista un 422 ("la configuración
     * del contrato cambió desde que se firmó" — el drift que el backend dejó
     * como gap vigente) y un 404, ambos en JSON. Navegando, el huésped terminaba
     * mirando `{"message":"..."}` crudo en una pestaña en blanco; así el llamador
     * recibe un error con `status` y puede decirle qué pasó.
     */
    async openSignedContract(reservationUuid: string): Promise<void> {
        const res = await fetch(this.getSignedContractUrl(reservationUuid), {
            headers: { Accept: "application/pdf" },
            cache: "no-store",
        })
        if (!res.ok) {
            const err = await res.json().catch(() => ({}))
            throw this.buildHttpError(res.status, err, res.headers)
        }
        const objectUrl = URL.createObjectURL(await res.blob())
        window.open(objectUrl, "_blank")
        setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
    }

    /**
     * GET /checkin/{reservationUuid}/documents/{documentUuid}/pdf
     * Fetches the rendered PDF as a Blob and opens it in a new tab.
     */
    async openDocumentPdf(reservationUuid: string, documentUuid: string): Promise<void> {
        const headers: Record<string, string> = { "Accept": "application/pdf" }
        const res = await fetch(
            `${API_BASE}/checkin/${reservationUuid}/documents/${documentUuid}/pdf`,
            { headers, cache: "no-store" }
        )
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const blob = await res.blob()
        const objectUrl = URL.createObjectURL(blob)
        window.open(objectUrl, "_blank")
        setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
    }

    // ── Métodos eliminados ──────────────────────────────────────────────────
    // `getFaceMatchResult`, `getActiveAutomations` y `saveSecondaryGuest`
    // apuntaban a rutas que NO existen en el backend (`/guest/{uuid}/facematch`,
    // `/automations`, `/s/{token}/guest`): el grupo `checkin` publica 21
    // endpoints y ninguno es ese. No tenían un solo llamador, pero seguían
    // ofreciéndose como si fueran API vigente. `getReservation`,
    // `getReservationByExternal`, `getSecondaryGateStatus` y
    // `pollGuestVerification` sí existían pero también estaban sin uso, y los dos
    // últimos leían mal el portal (`registeredGuests` sin comprobar
    // `portalStatus`, y `isCompleted` —check-in terminado— como si fuera el
    // estado de verificación). Se borran en vez de arreglarse: lo vigente es
    // `getPortal()` + `checkinServerService.getSecondaryGateStatus()`.

    /**
     * Builds the `X-Checkin-Verification-Token` header when a recurring guest
     * already proved contact possession this session (OTP plan 20260731 §"Endpoints
     * que ahora exigen el token"). Returns {} when no token is stored — the header
     * is simply omitted, which is a no-op for guests who never needed one (new
     * guests, or fresh Didit/OCR verification this same session).
     */
    private withVerificationToken(reservationUuid: string, guestUuid: string): Record<string, string> {
        const token = getVerificationToken(reservationUuid, guestUuid)
        return token ? { "X-Checkin-Verification-Token": token } : {}
    }

    /**
     * Helper for GET requests with app token only.
     * Guest-facing checkin endpoints must use the app token, NOT the session token,
     * because an admin user being logged in would otherwise send their session token → 403.
     */
    private async getWithAppToken<T>(url: string, extraHeaders?: Record<string, string>): Promise<T> {
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Accept-Language": "es",
            "X-Locale": "es",
            ...extraHeaders,
        }
        const response = await fetch(url, { headers, cache: "no-store" })
        if (!response.ok) {
            const err = await response.json().catch(() => ({}))
            throw this.buildHttpError(response.status, err, response.headers)
        }
        const json = await response.json()
        return (json.data ?? json) as T
    }

    /**
     * Builds an Error enriched with `status` and `errors` so screens can
     * branch on HTTP status (403/409/422...) and show field-level errors.
     *
     * `headers` es opcional y solo se usa para rescatar `Retry-After`: el 429 del
     * throttle de Laravel (§8/§9 del contrato) NO trae `retryAfter` en el body,
     * a diferencia del 429 lógico del propio challenge. Sin este dato la pantalla
     * del OTP tenía que inventar una espera, y la que inventaba era de 15 minutos
     * para un bloqueo que en realidad dura uno.
     */
    private buildHttpError(status: number, body: unknown, headers?: Headers): CheckinApiError {
        const payload = (body ?? {}) as Record<string, unknown>
        const message = typeof payload.message === "string" && payload.message
            ? payload.message
            : "Error en la solicitud"
        const error = new Error(message) as CheckinApiError
        error.status = status
        if (payload.errors && typeof payload.errors === "object") {
            error.errors = payload.errors as Record<string, string[]>
        }
        // OCR / document-verification failures carry a structured shape:
        // { errorType, failedFields:[{field, reason, confidence}], message }
        if (typeof payload.errorType === "string") error.errorType = payload.errorType
        if (Array.isArray(payload.failedFields)) {
            error.failedFields = payload.failedFields as CheckinFailedField[]
        }
        // Contact-challenge OTP errors (backend plan 20260731): { code, message,
        // attemptsRemaining? } (422) or { code, message, retryAfter? } (429).
        if (typeof payload.code === "string") error.code = payload.code
        if (typeof payload.attemptsRemaining === "number") error.attemptsRemaining = payload.attemptsRemaining
        if (typeof payload.retryAfter === "number") {
            error.retryAfter = payload.retryAfter
        } else {
            const header = Number(headers?.get("Retry-After"))
            if (Number.isFinite(header) && header > 0) error.retryAfter = header
        }
        return error
    }

    /**
     * Helper for POST requests with app token only.
     * Guest-facing checkin endpoints must use the app token, NOT the session token,
     * because an admin user being logged in would otherwise send their session token → 403.
     */
    private async postWithAppToken<T>(url: string, body: unknown, extraHeaders?: Record<string, string>): Promise<T> {
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Accept-Language": "es",
            "X-Locale": "es",
            ...extraHeaders,
        }
        const response = await fetch(url, {
            method: "POST",
            headers,
            body: JSON.stringify(body),
            cache: "no-store",
        })
        if (!response.ok) {
            const err = await response.json().catch(() => ({}))
            throw this.buildHttpError(response.status, err, response.headers)
        }
        const json = await response.json()
        return (json.data ?? json) as T
    }

}

export const checkinService = new CheckinService()
