import { API_BASE, CONFIG } from "@/lib/config"
import {
  CheckinReservationV4,
  CheckinPortalResponse,
  IdentifyPayload,
  IdentifyResponse,
  IdentityResolution,
  VerificationResult,
  CheckinCompletionResponse,
  ReservationCheckinStatus,
  SecondaryGuestContext,
  FaceMatchResult,
  OCRResult,
  SecondaryGateStatus,
  ActiveAutomation,
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
  GuestFormSchemaRawResponse,
  CheckinUserField,
  CheckinFieldType,
  VerificationResultResponse,
  FormSchema,
} from "../types/checkin"
import {
  mockResolveIdentity,
  mockIdentifyResponse,
  mockPortalResponse,
  mockVerificationApproved,
  mockCheckinReservation,
  mockCompleteResponse,
  mockFormSchemaResponse,
  mockOCRResult,
  mockVerificationResult,
} from "../data/mock-guest-data"
import { getVerificationToken } from "../lib/verification-token"

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

/**
 * Normalizes the /verify/result response to the legacy { status } shape the
 * screens already branch on, tolerating both:
 *   - new portal-style: { verification: { status, currentStep, ... } }
 *   - legacy flat:       { status: "verified"|"kyc_required"|"failed", ... }
 */
function normalizeVerificationResult(raw: any): VerificationResultResponse {
    // Legacy flat shape — pass through untouched.
    if (raw?.status === "verified" || raw?.status === "kyc_required" || raw?.status === "failed") {
        return raw as VerificationResultResponse
    }
    // New portal-style shape.
    const v = raw?.verification ?? raw ?? {}
    if (v.currentStep === "form" || v.status === "approved" || v.status === "completed") {
        return { status: "verified" }
    }
    if (v.currentStep === "rejected" || v.status === "rejected" || v.status === "fail" || v.status === "expired") {
        return { status: "failed" }
    }
    // Still pending but the backend exposes a session URL → the guest has a Didit
    // step left to finish (e.g. the document-upload session opened after a biometric
    // match when no documents were on file). Surface it so the front can relaunch
    // that session instead of waiting on a webhook that never arrives.
    if (v.verificationUrl) {
        return { status: "kyc_required", kycUrl: v.verificationUrl }
    }
    return { status: "pending" }
}

/**
 * Parses provider-declared dynamic fields (v4.6) from `user_fields`.
 * Auto-resolved fields (type "auto") are stripped server-side, but we defensively
 * skip them here too. Legacy plain-string entries are coerced to a text field.
 * The `key` is preserved verbatim (snake_case) because it's the exact `extra` key.
 */
function normalizeUserFields(raw: any): CheckinUserField[] {
    const arr = raw?.user_fields ?? raw?.userFields
    if (!Array.isArray(arr)) return []
    const out: CheckinUserField[] = []
    for (const f of arr) {
        if (typeof f === "string") {
            out.push({ key: f, type: "text", required: false })
            continue
        }
        if (!f || typeof f !== "object" || !f.key) continue
        const type = f.type === "auto" ? null : f.type
        if (type === null) continue // auto fields are backend-only
        const fieldType: CheckinFieldType = type === "number" || type === "select" ? type : "text"
        out.push({
            key: String(f.key),
            type: fieldType,
            required: !!(f.required ?? f.is_required),
            catalogCategoryId: f.catalog_category_id ?? f.catalogCategoryId ?? undefined,
            label: f.label ?? f.name ?? undefined,
        })
    }
    return out
}

function normalizeFormSchema(raw: any): FormSchema {
    const toArray = (v: any) => (Array.isArray(v) ? v : [])
    return {
        requiredFields: toArray(raw?.required_fields ?? raw?.requiredFields).map(snakeToCamel),
        optionalFields: toArray(raw?.optional_fields ?? raw?.optionalFields).map(snakeToCamel),
        prefilledData: raw?.prefilledData ?? raw?.prefilled_data ?? {},
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
        if (CONFIG.APP_API_TOKEN) headers["Authorization"] = `Bearer ${CONFIG.APP_API_TOKEN}`
        const response = await fetch(url, { headers, cache: "no-store" })
        if (!response.ok) {
            const err = await response.json().catch(() => ({}))
            throw new Error(err.message || "Error loading reservation")
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

        const raw: any = await this.postWithAppToken(`${API_BASE}/checkin/${reservationUuid}/identify`, apiPayload);
        return {
            guest: raw.guest,
            reservationGuest: raw.reservationGuest,
            verification: raw.verification,
            formSchema: normalizeFormSchema(raw.formSchema),
        } as IdentifyResponse;
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
        const raw: any = await this.getWithAppToken(
            `${API_BASE}/checkin/${reservationUuid}/form/${guestUuid}`,
            this.withVerificationToken(reservationUuid, guestUuid),
        );
        const schema = raw.formSchema || raw;
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
        if (CONFIG.APP_API_TOKEN) uploadHeaders["Authorization"] = `Bearer ${CONFIG.APP_API_TOKEN}`
        const uploadRes = await fetch(
            `${API_BASE}/checkin/${reservationUuid}/secondary/${guestUuid}/documents`,
            { method: "POST", headers: uploadHeaders, body: payload }
        )
        if (!uploadRes.ok) {
            const err = await uploadRes.json().catch(() => ({}))
            // Preserve the backend's localized message + structured OCR failure detail
            // so the UI can show exactly why verification failed.
            throw this.buildHttpError(uploadRes.status, err)
        }
        const uploadJson = await uploadRes.json()
        return uploadJson?.data ?? uploadJson
    }

    /**
     * Polls guest verification status via the portal endpoint (G-NEW-5).
     * There is no dedicated status endpoint — uses getPortal() instead.
     *
     * Mock: returns "pending" for the first 2 calls, then "approved".
     * Uses sessionStorage counter so each test run starts fresh.
     * To test rejection, use a guestUuid ending in "-rejected".
     */
    async pollGuestVerification(
        reservationUuid: string,
        guestUuid: string
    ): Promise<{ status: string }> {
        if (USE_MOCK) {
            await new Promise(res => setTimeout(res, 1500));
            if (guestUuid.endsWith('-rejected')) {
                return { status: 'failed' };
            }
            const countKey = `mock-poll-count-${reservationUuid}-${guestUuid}`;
            const count = Number(sessionStorage.getItem(countKey) ?? '0') + 1;
            sessionStorage.setItem(countKey, String(count));
            return { status: count >= 3 ? 'approved' : 'pending' };
        }
        const portal = await this.getPortal(reservationUuid);
        const guest = portal.registeredGuests.find(g => g.uuid === guestUuid);
        return { status: guest?.isCompleted ? 'approved' : 'pending' };
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
        const raw: any = await this.getWithAppToken(
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
        if (CONFIG.APP_API_TOKEN) headers["Authorization"] = `Bearer ${CONFIG.APP_API_TOKEN}`
        const res = await fetch(
            `${API_BASE}/checkin/${reservationUuid}/documents/${documentUuid}/render`,
            { headers, cache: "no-store" }
        )
        if (!res.ok) {
            const err = await res.json().catch(() => ({}))
            throw new Error((err as any).message || "Documento no disponible")
        }
        const json = await res.json()
        return json?.data?.rendered ?? json?.rendered ?? ""
    }

    /**
     * Absolute URL of the SIGNED contract PDF (with signature + legal evidence page).
     * GET /checkin/{reservationUuid}/contract/signed — public, byte stream.
     */
    getSignedContractUrl(reservationUuid: string): string {
        return `${API_BASE}/checkin/${reservationUuid}/contract/signed`
    }

    /**
     * Opens the SIGNED contract PDF in a new tab. It's a byte stream on a public
     * endpoint, so we navigate to it directly (no fetch/blob).
     */
    openSignedContract(reservationUuid: string): void {
        if (typeof window !== "undefined") {
            window.open(this.getSignedContractUrl(reservationUuid), "_blank")
        }
    }

    /**
     * GET /checkin/{reservationUuid}/documents/{documentUuid}/pdf
     * Fetches the rendered PDF as a Blob and opens it in a new tab.
     */
    async openDocumentPdf(reservationUuid: string, documentUuid: string): Promise<void> {
        const headers: Record<string, string> = { "Accept": "application/pdf" }
        if (CONFIG.APP_API_TOKEN) headers["Authorization"] = `Bearer ${CONFIG.APP_API_TOKEN}`
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

    // ═══════════════════════════════════════════════════════
    // LEGACY — Kept for backwards compatibility during migration
    // ═══════════════════════════════════════════════════════

    /**
     * @deprecated Use getPortal() instead.
     * Gets reservation details by internal UUID.
     */
    async getReservation(uuid: string): Promise<CheckinReservationV4> {
        if (USE_MOCK) {
            await new Promise(res => setTimeout(res, 500));
            return mockCheckinReservation;
        }
        const url = `${API_BASE}/checkin/${uuid}`
        return this.fetchWithToken(url)
    }

    /**
     * Gets reservation details by external PMS data.
     * Safe to call from Server Components.
     */
    async getReservationByExternal(sourceSlug: string, listingUuid: string, externalId: string): Promise<CheckinReservationV4> {
        if (USE_MOCK) {
            await new Promise(res => setTimeout(res, 500));
            return mockCheckinReservation;
        }
        const url = `${API_BASE}/checkin/${sourceSlug}/${listingUuid}/${externalId}`
        return this.fetchWithToken(url)
    }

    // Métodos obsoletos eliminados

    async getFaceMatchResult(uuid: string, guestUuid: string): Promise<FaceMatchResult> {
        if (USE_MOCK) {
            await new Promise(res => setTimeout(res, 500));
            return { matched: true, hasExistingData: true, docsValid: true, preFilledData: { name: 'Ricardo', lastname: 'Lombana' } };
        }
        const url = `${API_BASE}/checkin/${uuid}/guest/${guestUuid}/facematch`;
        const res = await fetch(url, { headers: { "Authorization": `Bearer ${CONFIG.APP_API_TOKEN}` } });
        return res.json();
    }

    async getSecondaryGateStatus(uuid: string, guestToken: string): Promise<SecondaryGateStatus> {
        if (USE_MOCK) {
            await new Promise(res => setTimeout(res, 300));
            return { mainGuestCompleted: true, mainGuestName: "Ricardo Lombana", reservation: mockCheckinReservation, guestToken };
        }
        const portal = await this.getPortal(uuid)
        const mainGuest = portal.registeredGuests.find(g => g.isMain)
        const mainCompleted = mainGuest?.isCompleted ?? false
        const mainName = mainGuest ? `${mainGuest.name} ${mainGuest.lastname}`.trim() : undefined

        return {
            mainGuestCompleted: mainCompleted,
            mainGuestName: mainName,
            reservation: {} as any,
            guestToken,
        }
    }

    /** @deprecated Use completeSecondaryGuest() instead. */
    async saveSecondaryGuest(uuid: string, guestToken: string, payload: any): Promise<void> {
        if (USE_MOCK) return new Promise(res => setTimeout(res, 800));
        return this.postWithAppToken(`${API_BASE}/checkin/${uuid}/s/${guestToken}/guest`, payload);
    }

    async getActiveAutomations(uuid: string): Promise<ActiveAutomation[]> {
        if (USE_MOCK) return mockCheckinReservation.activeAutomations;
        const res = await fetch(`${API_BASE}/checkin/${uuid}/automations`, { headers: { "Authorization": `Bearer ${CONFIG.APP_API_TOKEN}` } });
        const json = await res.json();
        return json.data || json;
    }

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
        if (CONFIG.APP_API_TOKEN) headers["Authorization"] = `Bearer ${CONFIG.APP_API_TOKEN}`
        const response = await fetch(url, { headers, cache: "no-store" })
        if (!response.ok) {
            const err = await response.json().catch(() => ({}))
            throw this.buildHttpError(response.status, err)
        }
        const json = await response.json()
        return (json.data ?? json) as T
    }

    /**
     * Builds an Error enriched with `status` and `errors` so screens can
     * branch on HTTP status (403/409/422...) and show field-level errors.
     */
    private buildHttpError(status: number, body: any): Error {
        const error = new Error(body?.message || "Error en la solicitud") as Error & {
            status: number
            errors?: Record<string, string[]>
            errorType?: string
            failedFields?: Array<{ field: string; reason: string; confidence?: number }>
            code?: string
            attemptsRemaining?: number
            retryAfter?: number
        }
        error.status = status
        if (body?.errors && typeof body.errors === "object") error.errors = body.errors
        // OCR / document-verification failures carry a structured shape:
        // { errorType, failedFields:[{field, reason, confidence}], message }
        if (body?.errorType) error.errorType = body.errorType
        if (Array.isArray(body?.failedFields)) error.failedFields = body.failedFields
        // Contact-challenge OTP errors (backend plan 20260731): { code, message,
        // attemptsRemaining? } (422) or { code, message, retryAfter? } (429).
        if (body?.code) error.code = body.code
        if (typeof body?.attemptsRemaining === "number") error.attemptsRemaining = body.attemptsRemaining
        if (typeof body?.retryAfter === "number") error.retryAfter = body.retryAfter
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
        if (CONFIG.APP_API_TOKEN) headers["Authorization"] = `Bearer ${CONFIG.APP_API_TOKEN}`
        const response = await fetch(url, {
            method: "POST",
            headers,
            body: JSON.stringify(body),
            cache: "no-store",
        })
        if (!response.ok) {
            const err = await response.json().catch(() => ({}))
            throw this.buildHttpError(response.status, err)
        }
        const json = await response.json()
        return (json.data ?? json) as T
    }

    /**
     * Helper to make isomorphic fetches (works in Server Components without Zustand).
     */
    private async fetchWithToken(url: string): Promise<CheckinReservationV4> {
        const response = await fetch(url, {
            headers: {
                "Authorization": `Bearer ${CONFIG.APP_API_TOKEN}`,
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            cache: "no-store", // Check-in data should always be fresh
        })

        if (!response.ok) {
            let errorMsg = "Error loading reservation"
            try {
                const errorData = await response.json()
                errorMsg = errorData.message || errorMsg
            } catch (e) {}
            throw new Error(errorMsg)
        }

        const json = await response.json()
        return json.data || json
    }
}

export const checkinService = new CheckinService()
