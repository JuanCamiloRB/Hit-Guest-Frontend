/**
 * Check-in Flow Types — v4.0
 * Aligned with the definitive backend spec.
 */

// ─── Catalog Types ───────────────────────────────────────────────

export interface CatalogItem {
  id: number
  catalogCategoryId: number
  name: string
  nameTranslations: { en: string; es: string }
  slug?: string
  parameters?: unknown | null
  order: number
  status: string
}

/** identification_type (cat_id=2) */
export type DocumentType = CatalogItem

/** gender (cat_id=15): 113=Mujer, 114=Hombre, 115=Indeterminado */
export type Gender = CatalogItem

/** reason_for_trip (cat_id=8) */
export type ReasonForTrip = CatalogItem

/** reservation_source (cat_id=6) */
export type ReservationSource = CatalogItem

/** status_reservation (cat_id=7) */
export type StatusReservation = CatalogItem

// ─── Portal Response (GET /api/v1/checkin/{reservationUuid}) ─────
// Matches backend buildPortalResponse() EXACTLY.

/** Verification state per guest exposed in GET /checkin/{reservationUuid} portal response (v4.2) */
export interface GuestVerificationInfo {
  status:
    | "not_started"  // guest identified, no verification record yet
    | "pending"      // Didit session created, waiting for user
    | "in_progress"  // biometrics in progress
    | "resubmitted"  // Didit "Resubmitted" — guest re-sent documents, still in flight
    | "in_review"    // under manual review
    | "approved"     // person_verified_at set — ready for form
    | "rejected"     // rejected by Didit
    | "fail"         // external_status = 'fail'
    | "expired"      // document expired
    | "completed"    // is_checkin_completed = true
    | "contact_challenge_pending"  // OTP plan 20260731: sent, not yet verified by the guest
    /** Transición de Didit: no es éxito ni implica por sí sola escalada a KYC. */
    | "pass"
    /**
     * RECUPERABLE: el biométrico pasó pero la creación automática de la sesión
     * KYC de seguimiento falló. No es terminal — al volver a llamar `/identify`
     * el backend reintenta crear esa sesión SIN pedirle al huésped repetir el
     * biométrico. Sin manejarlo, el huésped queda en un spinner indefinido.
     */
    | "kyc_session_failed"
    /** Registro `kyc_session_failed` viejo, ya reemplazado por un reintento exitoso. */
    | "superseded"
    /**
     * RECUPERABLE: rechazo de OCR/face-match/duplicado en el flujo de IA propia.
     * Llega con `currentStep: "rejected"`, pero a diferencia de un rechazo de
     * Didit el huésped puede reintentar de inmediato subiendo mejores fotos.
     */
    | "ocr_rejected"
  currentStep: "verification" | "form" | "rejected" | "completed" | "contact_challenge"
  verifiedAt: string | null         // ISO date when approved/completed, null otherwise
  /** Etapa real de Didit. Cambia de biometric a kyc cuando el backend escala. */
  sessionType: "biometric" | "kyc" | null
  startedAt: string | null
  expiresAt: string | null
  /** Señal autoritativa del backend para dejar de bloquear esperando. */
  isStale: boolean
  /** URL de la sesión Didit actualmente accionable, si existe. */
  verificationUrl: string | null
}

/**
 * Estados desde los que el huésped puede salir por sí mismo reiniciando el flujo
 * en `/identify`, en vez de quedarse esperando o tener que llamar al anfitrión.
 * Ambos son terminales para el sondeo actual pero NO para el check-in.
 */
export function isSelfRecoverableVerification(status: string): boolean {
  return status === "kyc_session_failed" || status === "ocr_rejected"
}

/**
 * Property document exposed in the portal response (v4.3).
 * The backend resolves the reservation's property → active documents and
 * provides ready-to-use checkin-scoped URLs (no admin auth required).
 */
export interface PortalDocument {
  uuid: string
  type: string          // "Agreement" | "Rules" | "Instructions" | "Privacy Policy"
  renderUrl: string     // "/api/v1/checkin/{reservationUuid}/documents/{docUuid}/render"
  pdfUrl: string        // "/api/v1/checkin/{reservationUuid}/documents/{docUuid}/pdf"
  /** Optional metadata from newer backends. ContractScreen stays fail-closed when ambiguous. */
  isContract?: boolean
  reservationSourceId?: number | null
  reservation_source_id?: number | null
  signatureProviderSlug?: SigningProvider | null
  signature_provider_slug?: SigningProvider | null
}

/**
 * Which signing provider the property has configured for the contract (v4.4).
 * The backend sends the provider slug: "hitguest_signature" or "tufirma".
 * ("hitguest" kept for tolerance.)
 */
export type SigningProvider = "hitguest" | "hitguest_signature" | "tufirma"

/**
 * Contract signing state exposed in the portal response (v4.4).
 * Drives whether the guest sees the native signature canvas, the TuFirma notice,
 * or no signing step at all.
 */
export interface PortalContractInfo {
  signingProvider: SigningProvider | null  // null = no Digital Contract automation configured
  /** Authoritative contract selected by backend for the reservation channel. */
  documentUuid?: string | null
  document_uuid?: string | null
  reservationSourceId?: number | null
  reservation_source_id?: number | null
  /**
   * "pending"  = TuFirma envió el contrato, espera la firma externa (link por email).
   * "signed"   = firmado nativamente, pero OJO: no implica que se pueda descargar
   *              (ver `signedContractUrl`, que es la única señal válida).
   * "rejected" = el firmante rechazó o falló en TuFirma (SIGNER_REJECTED /
   *              SIGNER_FAILED). Es terminal y el huésped no tiene reintento: hay
   *              que decírselo, no dejarlo creyendo que su registro quedó completo.
   */
  status: "not_started" | "pending" | "signed" | "completed" | "rejected"
  hasNativeSignature: boolean               // a native signature already saved for the main guest
  signedAt?: string | null                  // ISO timestamp when the contract was signed
  signedContractUrl?: string | null         // relative URL to download the SIGNED PDF (when available)
}

/**
 * GET /checkin/{reservationUuid}/contract/preview — the authoritative source
 * for what this reservation's guest signs, resolved server-side from the
 * property's contract_mode/by_source for the reservation's channel.
 *
 * Replaces the old pattern of picking a contract out of `documents[]`: a
 * property in per_source mode can have several Agreement documents, so
 * "take the first/only one" (the previous ContractScreen heuristic) is no
 * longer valid. This endpoint is the only correct source (backend plan §4.1).
 */
export interface ContractPreview {
  contractType: "agreement_only" | "guarantee_only" | "agreement_and_guarantee"
  /** Who signs — drives the native canvas vs. "sent by email" branch, same as before. */
  providerSlug: SigningProvider
  /** Present for agreement_only / agreement_and_guarantee. Shortcodes already resolved. */
  agreement: { uuid: string; rendered: string } | null
  /** Present for guarantee_only / agreement_and_guarantee. Shortcodes already resolved. */
  guarantee: { rendered: string } | null
}

/**
 * Card-on-file guarantee (backend plan 20260731 — Stripe SetupIntent, no
 * charge). Applies only when `ContractPreview.guarantee !== null`.
 */
/**
 * `detached` = la tarjeta se desvinculó del huésped (flujo administrativo, fuera
 * del portal). Ningún endpoint del portal la produce, pero el modelo la define y
 * `/guarantee/status` la puede devolver, así que el portal tiene que saber
 * mostrarla: para el huésped es lo mismo que no tener tarjeta, hay que pedirle
 * una nueva. Sin este valor el estado caía en un "no debería pasar" que dejaba
 * la pantalla trabada.
 */
export type GuaranteeStatus = "not_started" | "pending" | "active" | "failed" | "detached"

/**
 * POST /checkin/{reservationUuid}/main/guarantee/setup-intent
 *
 * `clientSecret` is passed straight into `stripe.confirmCardSetup()` and never
 * persisted — a fresh intent is created on every call, so there's nothing to
 * clean up if the guest abandons and retries. `publishableKey` always comes
 * from this response, never hardcoded, so the backend can switch test/live
 * accounts without a frontend release.
 */
export interface GuaranteeSetupIntent {
  clientSecret: string
  publishableKey: string
  /**
   * Monto configurado de la garantía — informativo, no se retiene ni se cobra
   * nada en este paso. El backend lo expone sin castear (puede llegar `"200"`,
   * `200` o `null` si la property no lo fijó), así que el tipo lo refleja en vez
   * de mentir con `string`: declararlo `string` hacía que `amount && currency`
   * pareciera seguro cuando en realidad podía renderizar un número.
   */
  guaranteeAmount: string | number | null
  currency: string
  /** Agregado por backend en `20260807_fix-checkin-minor-gaps.md` (A4). */
  message?: string
}

/**
 * GET /checkin/{reservationUuid}/main/guarantee/status?guest_uuid={uuid}
 *
 * Polled after `confirmCardSetup()` resolves — Stripe's client-side result is
 * NOT the source of truth (the backend only knows once its webhook lands), so
 * the frontend waits for `status: "active"` here before completing check-in,
 * the same "don't trust the client result, poll the backend" pattern already
 * used for Didit verification.
 */
export interface GuaranteeStatusInfo {
  status: GuaranteeStatus
  cardBrand: string | null
  cardLast4: string | null
  failureReason: string | null
}

export interface GuaranteeStatusResponse {
  guarantee: GuaranteeStatusInfo
}

/**
 * Datos del titular capturados al crear la reserva (manual o sincronizada).
 *
 * Origen en backend: `extra.guestName`, `extra.guestCountry`,
 * `extra.guestPhone` y `emailGuest` del recurso de reserva.
 *
 * `nationalityId` debe ser el ID NUMÉRICO del catálogo de países, no el nombre:
 * la reserva guarda texto libre ("Colombia") y resolverlo en el front se rompe
 * con "USA" / "Estados Unidos" / "United States".
 *
 * `name` y `lastname` deben venir SEPARADOS. La reserva los tiene en un único
 * campo libre y partirlo aquí es indecidible en español; ver
 * `lib/main-guest-prefill.ts`.
 */
export interface MainGuestPrefill {
  name?: string
  lastname?: string
  nationalityId?: number
  phone?: string
  email?: string
}

export interface CheckinPortalResponse {
  /**
   * v4.5: explicit portal lifecycle state. Present ONLY for cancelled (29) or
   * deleted (108) reservations — in those cases `reservation` and the rest of
   * the payload are absent and only `message` is provided. Status 30 (closed)
   * returns a full portal with `reservation.checkinAllowed = false` instead.
   */
  portalStatus?: "cancelled" | "deleted"
  /** Human-readable explanation shown to the guest when portalStatus is set. */
  message?: string
  reservation: {
    uuid: string
    arrivalDate: string              // "Y-m-d"
    departureDate: string            // "Y-m-d"
    totalGuestsAllowed: number       // $reservation->total_guests
    checkinAllowed?: boolean         // v4.2: whether check-in is currently allowed
    /**
     * Datos del TITULAR registrados al crear la reserva, para precargar su
     * check-in. Opcional: mientras el backend no lo mande, el formulario se
     * comporta igual que hoy. Ver `lib/main-guest-prefill.ts`.
     */
    mainGuestPrefill?: MainGuestPrefill
  }
  progress: {
    registered: number               // guests->count()
    completed: number                // guests->where(is_checkin_completed, true)->count()
    /**
     * Authoritative backend aggregate: exactly one completed main guest,
     * registered === completed, and completed >= total_guests.
     */
    isFullyCompleted: boolean
  }
  registeredGuests: RegisteredGuest[]
  /** v4.3: active property documents with render/pdf URLs. [] if none configured. */
  documents?: PortalDocument[]
  /** v4.4: contract signing config + state. Absent on older backends. */
  contract?: PortalContractInfo
  /**
   * Access codes are only exposed after every guest completes check-in. Older
   * backends omit this field; the portal remains functional with documents only.
   */
  smartlockCodes?: SmartlockCode[]
}

/** Each guest attached to the reservation via pivot */
export interface RegisteredGuest {
  uuid: string
  name: string
  lastname: string
  isMain: boolean                    // pivot->is_main_guest
  isCompleted: boolean               // pivot->is_checkin_completed
  verification?: GuestVerificationInfo  // v4.2: verification state (Didit/OCR)
}

// ─── Derived helpers (NOT from backend, computed in frontend) ────

/** Whether the main guest has completed check-in */
export function isMainGuestCompleted(portal: CheckinPortalResponse): boolean {
  return portal.registeredGuests.some(g => g.isMain && g.isCompleted)
}

/** Number of guests still pending */
export function pendingGuestsCount(portal: CheckinPortalResponse): number {
  return portal.reservation.totalGuestsAllowed - portal.progress.completed
}

// Tipos deprecados eliminados

// ─── Identify (POST /api/v1/checkin/{reservationUuid}/identify) ──

/** Payload para POST /api/v1/checkin/{reservationUuid}/identify */
export interface IdentifyPayload {
  identificationTypeId: number   // catalogs WHERE catalog_category_id = 2
  identificationNumber: string   // max:30
  nationalityId: number          // exists:countries
  name: string                   // max:120
  lastname: string               // max:60
  isMainGuest: boolean
}

/** Response de POST /api/v1/checkin/{reservationUuid}/identify */
export interface IdentifyResponse {
  guest: {
    uuid: string
    name: string
    lastname: string
  }
  reservationGuest: {
    isMainGuest: boolean
    isCheckinCompleted: boolean
  }
  verification: VerificationDirective
  formSchema: FormSchema
}

/** El backend decide qué tipo de verificación necesita el guest */
export type VerificationDirective =
  | { type: "session"; sessionType: "biometric" | "kyc"; url: string }
  | { type: "document_upload" }             // Textract → mostrar upload UI
  | { type: "verified_ok" }                 // Ya verificado → saltar a form
  | ContactChallengeDirective               // Huésped recurrente: probar posesión del email (OTP plan 20260731)

/**
 * Huésped recurrente con verificación previa reutilizable — debe probar que
 * sigue teniendo acceso al email histórico antes de reusar esa verificación
 * (corrige la falla de seguridad donde conocer tipo+número de documento
 * bastaba para hacerse pasar por otro huésped). v1: solo `channel: "email"`
 * — no mostrar selector de canal, WhatsApp/SMS no están integrados en backend.
 */
export interface ContactChallengeDirective {
  type: "contact_challenge"
  challengeId: string
  channel: "email"
  maskedDestination: string
  /** Segundos hasta que el código vence — usar SIEMPRE este valor para el countdown, nunca hardcodear. */
  expiresIn: number
  /** Segundos de cooldown antes de poder reenviar — usar SIEMPRE este valor. */
  resendAfter: number
  /**
   * `null` = desconocido. `/identify` siempre manda un número, pero la respuesta
   * del reenvío NO incluye este campo: tras reenviar, el backend reinició los
   * intentos y el front no sabe a cuántos. Se representa como desconocido en vez
   * de inventar un máximo — el próximo intento fallido trae el valor real.
   */
  attemptsRemaining: number | null
  /**
   * 2026-08-24: `true` cuando `/identify` está RETOMANDO un challenge que este
   * huésped ya resolvió y cuya sesión sigue viva — mismo `challengeId`, SIN
   * correo nuevo, y `expiresIn` calculado sobre la ventana de sesión (el código
   * en sí ya venció, pero reingresarlo emite un token fresco). El copy debe
   * decir «reingresa el código que te enviamos», nunca «te enviamos un código».
   */
  alreadyVerified?: boolean
}

/**
 * POST /checkin/{reservationUuid}/contact-challenges/{challengeId}/verify
 * `expiresAt` es cuándo vence el `verificationToken` (60 min por defecto) —
 * NO cuándo vence el código de un solo uso.
 */
export interface VerifyContactChallengeResponse {
  verified: true
  guestUuid: string
  nextStep: "form"
  expiresAt: string
  verificationToken: string
}

/**
 * POST /checkin/{reservationUuid}/contact-challenges/{challengeId}/resend
 * El `challengeId` anterior queda invalidado — este reemplaza al guardado.
 */
export interface ResendContactChallengeResponse {
  challengeId: string
  channel: "email"
  maskedDestination: string
  expiresIn: number
  resendAfter: number
}

/**
 * Respuesta de GET /checkin/{uuid}/verify/result?guest_uuid={guestUuid}
 * Backend evalúa el resultado de la sesión Didit y decide si necesita KYC o ya está verificado.
 */
export interface VerificationResultResponse {
  /**
   * - `verified`          → identidad confirmada, seguir al formulario.
   * - `kyc_required`      → `sessionType:"kyc"` expone una sesión de documento
   *                         nueva en `kycUrl`. `pass` por sí solo NO la identifica.
   * - `restart_required`  → `kyc_session_failed`: el backend no logró abrir esa
   *                         sesión. NO hay URL que relanzar — se sale volviendo a
   *                         `/identify`, donde el backend la reintenta sin pedirle
   *                         al huésped repetir el biométrico.
   * - `contact_challenge` → huésped recurrente con el OTP de posesión pendiente:
   *                         no avanza por sondeo, hay que llevarlo a esa pantalla.
   * - `failed`            → rechazo. `retryable` distingue el rechazo de OCR
   *                         (reintentable de inmediato con mejores fotos) del
   *                         rechazo de Didit (terminal para el huésped).
   * - `stale`             → el backend agotó su ventana de espera; dejar de bloquear
   *                         y orientar al huésped a soporte.
   * - `pending`           → aún en proceso, seguir esperando.
   */
  status: "verified" | "kyc_required" | "restart_required" | "contact_challenge" | "failed" | "stale" | "pending"
  kycUrl?: string                        // Solo si status === "kyc_required"
  /** Solo con status "failed": el huésped puede reintentar por su cuenta. */
  retryable?: boolean
  /** Estado terminal original, conservado para presentar recuperación precisa. */
  failureReason?: "ocr_rejected" | "rejected" | "fail" | "expired"
  guestData?: {                          // Solo si status === "verified"
    firstName?: string
    lastName?: string
    documentNumber?: string
    dateOfBirth?: string
    expirationDate?: string
  }
}

/**
 * Schema de campos server-driven para el formulario (v4.0).
 * Replaces the old { fields: FormFieldSchema[] } shape.
 */
export interface FormSchema {
  requiredFields: string[]                     // e.g. ["countryOfOriginId", "reasonForTripId"]
  optionalFields: string[]                     // e.g. ["cityOfOrigin"]
  prefilledData: Record<string, unknown>       // backend-provided pre-fill values
  userFields?: CheckinUserField[]              // provider-declared dynamic fields (v4.6)
}

/**
 * Provider-declared check-in field (v4.6).
 * Each external provider (TRA Colombia, SIRE, …) declares the extra fields it needs
 * collected at check-in via `providers.parameters.checkin_fields`. The backend returns
 * the user-facing ones (auto-resolved fields are stripped server-side). The form is
 * built dynamically from these descriptors and the value is submitted under `extra`
 * using the declared `key` verbatim.
 */
export type CheckinFieldType = "text" | "number" | "select"

export interface CheckinUserField {
  key: string                  // exact extra key, e.g. "city_of_origin", "purpose_of_travel"
  type: CheckinFieldType       // text | number | select
  required: boolean
  catalogCategoryId?: number   // for type "select" — catalog category to load options from
  label?: string               // optional backend-provided label
}

// Tipos deprecados eliminados

/** Session data persisted in localStorage after /identify */
export interface IdentifySessionData {
  guestUuid: string
  guestName: string
  guestLastname: string
  isMainGuest: boolean
  isCheckinCompleted: boolean
  verification: VerificationDirective
  formSchema: FormSchema   // now uses requiredFields/optionalFields/prefilledData
  timestamp: number
  /** ID of the identification type chosen by the guest (cat_id=2), used by VerifyScreen to know if back image is required */
  identificationTypeId?: number
}

// ─── GET /form/{guestUuid} response (G-NEW-4) — aligned with backend v4.1 ────

/** Raw response shape from backend (snake_case keys in formSchema) */
export interface GuestFormSchemaRawResponse {
  formSchema: {
    required_fields: string[]
    optional_fields: string[]
    prefilledData: Record<string, unknown>
  }
}

/** Normalized shape used by frontend components (camelCase) */
export interface GuestFormSchemaResponse {
  requiredFields: string[]
  optionalFields: string[]
  prefilledData: Record<string, unknown>
  userFields?: CheckinUserField[]
}

// ─── Completion Payloads + Response (G-NEW-1, G-NEW-2) ──────────

export interface GuestProfile {
  name: string
  lastname: string
  /** Required by both completion endpoints, regardless of the provider schema. */
  email: string
  phone?: string
  dateOfBirth: string
  genderId: number | null
  nationalityId: number
  cityOfResidence?: string
  countryOfResidenceId?: number
  identificationExpiryDate?: string   // from OCR expirationDate (required for secondary)
}

/**
 * The secondary completion contract can update the identity fields captured in
 * its editable form. The main completion contract deliberately cannot.
 */
export interface SecondaryGuestProfile extends GuestProfile {
  identificationTypeId?: number | null
  identificationNumber?: string | null
}

export interface GuestExtra {
  countryOfOriginId?: number
  countryDestinationId?: number
  cityOfOrigin?: string
  reasonForTripId?: number
  documentImage1?: string | null
  documentImage2?: string | null
  arrivalTime?: string
  departureTime?: string
  arrivalFlight?: string
  departureFlight?: string
}

export interface CompleteMainGuestPayload {
  guestUuid: string
  profile: GuestProfile
  extra: GuestExtra
}

/**
 * POST /api/v1/checkin/{reservationUuid}/main/sign (v4.4)
 * Native HIT Guest signature — sent separately, BEFORE /main/complete.
 */
export interface SignMainGuestPayload {
  guestUuid: string
  documentUuid: string       // the contract document the guest read & is signing
  signatureImage: string     // base64 PNG/JPEG (with or without data: prefix)
}

/** Response of POST /main/sign */
export interface SignMainGuestResponse {
  message: string
  attempt: number
  signedAt: string
}

export interface CompleteSecondaryGuestPayload {
  profile: SecondaryGuestProfile
  extra: GuestExtra
}

/**
 * Backend real response for POST /main/complete and /secondary/{uuid}/complete.
 * Only returns a message — frontend must re-fetch portal to get updated state.
 */
export interface CompleteGuestResponse {
  message: string
  /**
   * v4.4: tufirma flow returns "pending_signature" (the guest must still sign via
   * the TuFirma email) instead of "completed". hitguest returns "completed".
   */
  status?: "completed" | "pending_signature"
}

// ─── OCR Result (v4.1 shape — aligned with backend) (G-NEW-3) ──────────────────

/** Backend response from POST /secondary/{guestUuid}/documents */
export interface OCRResult {
  extractedData?: {
    // Real backend fields (v4.1)
    name?: string
    lastname?: string
    identificationNumber?: string
    dateOfBirth?: string
    expirationDate?: string
    // Legacy field names kept for backwards compat
    firstName?: string
    lastName?: string
    documentNumber?: string
  }
  // Backend also returns formSchema with the OCR response (prefilledData merged)
  formSchema?: {
    required_fields: string[]
    optional_fields: string[]
    prefilledData: Record<string, unknown>
  }
}

// ─── Check-in Reservation Context (legacy — migrate to CheckinPortalResponse) ──

export interface CheckinReservation {
  uuid: string
  listingId: number
  listingName: string
  propertyName: string
  propertyLocation: string
  arrivalDate: string        // YYYY-MM-DD
  departureDate: string      // YYYY-MM-DD
  totalGuests: number
  totalPrice: number
  currency: string
  emailGuest: string
  guestName?: string         // Pre-filled if available from extra
  statusReservationId: number
  reservationSourceId: number
  extra: Record<string, unknown>
}

// ─── Extended Reservation (v4 fields — legacy, keep for backwards compat) ─

export interface ActiveAutomation {
  id: number
  name: string
  providerName: string
  checkinFields: string[]
  triggerTypes: string[]
  guestType: "main" | "secondary" | "all"
}

export interface ContractTemplate {
  title: string
  bodyHtml: string
  variables: Record<string, string | number>
}

/**
 * @deprecated Use CheckinPortalResponse + CompleteGuestResponse instead.
 * Kept to avoid breaking pages not yet migrated to v4.0.
 */
export interface CheckinReservationV4 extends CheckinReservation {
  propertyCountryId?: number
  /** @deprecated Backend decides provider in /identify */
  verificationProvider: 'didit' | 'textract' | 'metamap' | 'none'
  /** @deprecated Backend decides provider in /identify */
  secondaryGuestProvider: 'didit' | 'textract' | 'metamap' | 'none'
  hasContract: boolean
  contractTemplate?: ContractTemplate
  listingSmartlocks: Array<{ id: number; name: string; type: string }>
  mainGuestStatus: 'pending' | 'in_progress' | 'completed'
  mainGuestCompleted: boolean
  activeAutomations: ActiveAutomation[]
}

export interface FaceMatchResult {
  matched: boolean
  hasExistingData: boolean
  docsValid: boolean
  docsExpiryDate?: string
  preFilledData?: Partial<GuestFormData>
}

export interface SecondaryGateStatus {
  mainGuestCompleted: boolean
  mainGuestName?: string
  reservation: CheckinReservationV4
  guestToken: string
  /**
   * Reserva cancelada (29) o eliminada (108). El portal responde 200 SIN
   * `registeredGuests` en esos casos (decisión explícita del backend de no usar
   * 4xx), así que quien deriva este gate del portal DEBE propagarlo en vez de
   * indexar el arreglo: hacerlo tiraba un TypeError que las páginas de
   * acompañante leían como `notFound()`, mostrando "no encontrada" en vez de
   * decirle al huésped que su reserva fue cancelada.
   */
  portalStatus?: "cancelled" | "deleted"
  portalMessage?: string
}

// ─── Guest Form Data (22 campos - Huésped Principal) ─────────────

export interface GuestFormData {
  // 📄 Documento de identidad
  documentCountryId: number | ""
  identificationTypeId: number | ""
  identificationNumber: string
  identificationExpiryDate?: string

  // 👤 Datos personales
  name: string
  lastname: string
  dateOfBirth: string        // YYYY-MM-DD
  genderId: number | ""
  phone: string
  email: string

  // 🌍 Origen y destino
  nationalityId: number | ""
  cityOfResidence: string
  countryOfResidenceId: number | ""
  countryOfOriginId: number | ""
  cityOfOrigin: string          // city guest is travelling FROM (for SIRE/TRA)
  countryDestinationId: number | ""
  cityDestination: string
  reasonForTripId: number | ""

  // ✈️ Información de viaje (opcionales)
  arrivalTime: string        // HH:mm
  departureTime: string      // HH:mm
  arrivalFlight: string
  departureFlight: string

  // 📸 Fotos del documento
  documentImage1: string | null   // base64 or URL
  documentImage2: string | null   // base64 or URL (condicional)

  // 🧩 Campos dinámicos declarados por el proveedor (v4.6). Se envían tal cual en `extra`.
  dynamicExtra?: Record<string, string | number>
}

// ─── Companion Form Data (12 campos - Simplificado) ──────────────

export interface CompanionFormData {
  // 📄 Documento
  documentCountryId: number | ""
  identificationTypeId: number | ""
  identificationNumber: string

  // 👤 Datos básicos
  name: string
  lastname: string
  dateOfBirth: string
  genderId: number | ""
  phone: string
  email: string

  // 🌍 Viaje
  reasonForTripId: number | ""

  // 📸 Fotos
  documentImage1: string | null
  documentImage2: string | null

  // 🧩 Campos dinámicos declarados por el proveedor (v4.6).
  dynamicExtra?: Record<string, string | number>
}

// ─── Utility Types ───────────────────────────────────────────────

export type CheckinStep = "welcome" | "identify" | "verify" | "guest" | "contract" | "success"

export interface CheckinRouteParams {
  type: "uuid" | "external"
  reservationUuid?: string
  sourceSlug?: string
  listingUuid?: string
  externalId?: string
}

/** Parse catch-all params into structured route info */
export function parseCheckinParams(params: string[]): CheckinRouteParams {
  if (params.length === 1) {
    return { type: "uuid", reservationUuid: params[0] }
  }
  if (params.length === 3) {
    return {
      type: "external",
      sourceSlug: params[0],
      listingUuid: params[1],
      externalId: params[2],
    }
  }
  // Fallback — treat as UUID
  return { type: "uuid", reservationUuid: params[0] }
}

/** Build the base path from params for navigation between steps */
export function buildCheckinBasePath(params: string[]): string {
  return `/checkin/${params.join("/")}`
}

/** Initial state for GuestFormData */
export const emptyGuestForm: GuestFormData = {
  documentCountryId: "",
  identificationTypeId: "",
  identificationNumber: "",
  name: "",
  lastname: "",
  dateOfBirth: "",
  genderId: "",
  phone: "",
  email: "",
  nationalityId: "",
  cityOfResidence: "",
  countryOfResidenceId: "",
  countryOfOriginId: "",
  cityOfOrigin: "",
  countryDestinationId: "",
  cityDestination: "",
  reasonForTripId: "",
  arrivalTime: "",
  departureTime: "",
  arrivalFlight: "",
  departureFlight: "",
  documentImage1: null,
  documentImage2: null,
  dynamicExtra: {},
}

/** Initial state for CompanionFormData */
export const emptyCompanionForm: CompanionFormData = {
  documentCountryId: "",
  identificationTypeId: "",
  identificationNumber: "",
  name: "",
  lastname: "",
  dateOfBirth: "",
  genderId: "",
  phone: "",
  email: "",
  reasonForTripId: "",
  documentImage1: null,
  documentImage2: null,
  dynamicExtra: {},
}

// ─── Signature (escalable base64 → S3) ──────────────
export interface SignatureData {
  type: 'base64' | 's3_key'
  value: string
}

// ─── Verification ────────────────────────────────────

/** @deprecated Use IdentifyResponse instead — kept for migration */
export interface IdentityResolution {
  guestUuid: string
  isNew: boolean
  hasPreviousVerification: boolean
}

export interface VerificationResult {
  status: 'pending' | 'approved' | 'failed' | 'expired'
  preFilledData?: Partial<GuestFormData>
  documentsExpired?: boolean
  reason?: string
}

// ─── Smartlock (API externa) ─────────────────────────
export interface SmartlockCode {
  name: string
  type: 'building_entrance' | 'unit_entrance' | 'amenity'
  code: string
  validFrom: string
  validUntil: string
}

// ─── Secondary Guest Token ──────────────────────────
export interface SecondaryGuestContext {
  token: string
  reservationUuid: string
  guestPosition: number   // 2, 3, 4...
  totalGuests: number
  mainGuestCompleted: boolean
  reservationData: CheckinReservationV4
}

// ─── Completion Response (legacy) ───────────────────
/**
 * @deprecated Use CompleteGuestResponse instead.
 */
export interface CheckinCompletionResponse {
  guestId: number
  guestUuid: string
  isCheckinCompleted: boolean
  contractPdfUrl?: string
  smartlockCodes?: SmartlockCode[]
}

// ─── Reservation Status (para secundarios) ───────────
export interface ReservationCheckinStatus {
  mainGuestCompleted: boolean
  totalGuests: number
  completedGuests: Array<{
    guestUuid: string
    name: string
    isMain: boolean
  }>
  pendingGuests: number
}
