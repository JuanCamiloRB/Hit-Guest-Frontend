import { apiClient } from "@/lib/api-client"
import { API_BASE, CONFIG } from "@/lib/config"
import {
  CheckinReservationV4,
  CheckinPortalResponse,
  IdentifyPayload,
  IdentifyResponse,
  IdentityResolution,
  VerificationResult,
  CheckinCompletionResponse,
  ContractTemplate,
  ReservationCheckinStatus,
  SecondaryGuestContext,
  FaceMatchResult,
  OCRResult,
  SecondaryGateStatus,
  ActiveAutomation,
  CompleteMainGuestPayload,
  CompleteSecondaryGuestPayload,
  CompleteGuestResponse,
  GuestFormSchemaResponse,
  GuestFormSchemaRawResponse,
  VerificationResultResponse,
  FormSchema,
} from "../types/checkin"
import {
  mockResolveIdentity,
  mockIdentifyResponse,
  mockPortalResponse,
  mockVerificationApproved,
  mockSmartlockCodes,
  mockContractTemplate,
  mockCheckinReservation,
  mockCompleteResponse,
  mockFormSchemaResponse,
  mockOCRResult,
  mockVerificationResult,
} from "../data/mock-guest-data"

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
function normalizeFormSchema(raw: any): FormSchema {
    const toArray = (v: any) => (Array.isArray(v) ? v : [])
    return {
        requiredFields: toArray(raw?.required_fields ?? raw?.requiredFields).map(snakeToCamel),
        optionalFields: toArray(raw?.optional_fields ?? raw?.optionalFields).map(snakeToCamel),
        prefilledData: raw?.prefilledData ?? raw?.prefilled_data ?? {},
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
        }
        if (CONFIG.APP_API_TOKEN) headers["Authorization"] = `Bearer ${CONFIG.APP_API_TOKEN}`
        const response = await fetch(url, { headers, cache: "no-store" })
        if (!response.ok) {
            const err = await response.json().catch(() => ({}))
            throw new Error(err.message || "Error loading reservation")
        }
        const json = await response.json()
        return json.data || json
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
        const raw: any = await apiClient.post(`${API_BASE}/checkin/${reservationUuid}/identify`, payload);
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
        const raw: GuestFormSchemaRawResponse = await apiClient.get(
            `${API_BASE}/checkin/${reservationUuid}/form/${guestUuid}`
        );
        const schema = raw.formSchema || raw;
        return normalizeFormSchema(schema) as GuestFormSchemaResponse;
    }

    /**
     * POST /api/v1/checkin/{reservationUuid}/main/complete (G-NEW-1)
     * Submits the complete main guest data: profile + extra + signature.
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
        return apiClient.post(`${API_BASE}/checkin/${reservationUuid}/main/complete`, payload);
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
        return apiClient.post(
            `${API_BASE}/checkin/${reservationUuid}/secondary/${guestUuid}/complete`,
            payload
        );
    }

    /**
     * POST /api/v1/checkin/{reservationUuid}/secondary/{guestUuid}/documents (G-NEW-3)
     * Uploads document images for OCR (Textract flow).
     * FormData keys: "front_image" and "back_image" (snake_case — multipart/form-data has no auto-conversion).
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
        const uploadHeaders: Record<string, string> = { "Accept": "application/json" }
        if (CONFIG.APP_API_TOKEN) uploadHeaders["Authorization"] = `Bearer ${CONFIG.APP_API_TOKEN}`
        const uploadRes = await fetch(
            `${API_BASE}/checkin/${reservationUuid}/secondary/${guestUuid}/documents`,
            { method: "POST", headers: uploadHeaders, body: payload }
        )
        if (!uploadRes.ok) {
            const err = await uploadRes.json().catch(() => ({}))
            throw new Error(err.message || "Document upload failed")
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
        return apiClient.get(
            `${API_BASE}/checkin/${reservationUuid}/verify/result?${params.toString()}`
        )
    }

    // ── Contrato ──
    async getContractTemplate(reservationUuid: string): Promise<ContractTemplate> {
        if (USE_MOCK) {
            await new Promise(res => setTimeout(res, 500));
            return mockContractTemplate();
        }
        return apiClient.get(`${API_BASE}/checkin/${reservationUuid}/contract-template`);
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
        const res = await fetch(`${API_BASE}/checkin/${uuid}/s/${guestToken}/status`, { headers: { "Authorization": `Bearer ${CONFIG.APP_API_TOKEN}` } });
        return res.json();
    }

    /** @deprecated Use completeSecondaryGuest() instead. */
    async saveSecondaryGuest(uuid: string, guestToken: string, payload: any): Promise<void> {
        if (USE_MOCK) return new Promise(res => setTimeout(res, 800));
        return apiClient.post(`${API_BASE}/checkin/${uuid}/s/${guestToken}/guest`, payload);
    }

    async getActiveAutomations(uuid: string): Promise<ActiveAutomation[]> {
        if (USE_MOCK) return mockCheckinReservation.activeAutomations;
        const res = await fetch(`${API_BASE}/checkin/${uuid}/automations`, { headers: { "Authorization": `Bearer ${CONFIG.APP_API_TOKEN}` } });
        const json = await res.json();
        return json.data || json;
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
