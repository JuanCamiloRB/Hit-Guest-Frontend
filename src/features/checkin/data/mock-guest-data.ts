/**
 * Mock Guest Data — Check-in Demo v4.0
 * Complete mock data for the check-in flow demo.
 * When the backend is ready, replace these with API calls.
 */

import type {
  CheckinReservationV4,
  CheckinPortalResponse,
  IdentifyPayload,
  IdentifyResponse,
  CatalogItem,
  IdentityResolution,
  VerificationResult,
  SmartlockCode,
  ContractTemplate,
  CompleteGuestResponse,
  GuestFormSchemaResponse,
  OCRResult,
  VerificationResultResponse,
  VerificationDirective,
} from "@/features/checkin/types/checkin"
import type { CheckinApiError } from "@/features/checkin/lib/checkin-error"

// ─── Mock Reservation Context ────────────────────────────────────

export const mockReservationContext = {
  guestName: "María",
  propertyName: "Apartamento Centro, Unidad 201",
  location: "Cali, Colombia",
  checkIn: "15 Feb 2026",
  checkOut: "18 Feb 2026",
  nights: 3,
  status: {
    checkin: "pending" as "pending" | "completed",
    contract: "locked" as "locked" | "pending" | "completed",
    instructions: "locked" as "locked" | "available",
  },
}

// ─── Full Reservation for Check-in Flow ──────────────────────────

export const mockCheckinReservation: CheckinReservationV4 = {
  uuid: "019d4f00-1234-7890-abcd-1234567890ab",
  listingId: 45,
  listingName: "Unidad 201 - Vista a la Ciudad",
  propertyName: "Apartamentos Centro Histórico",
  propertyLocation: "Cali, Valle del Cauca, Colombia",
  arrivalDate: "2026-05-15",
  departureDate: "2026-05-20",
  totalGuests: 2,
  totalPrice: 750.50,
  currency: "USD",
  emailGuest: "ricardo.lombana@gmail.com",
  guestName: "Ricardo",
  statusReservationId: 27,
  reservationSourceId: 22,
  extra: {
    specialRequests: "Cuna para bebé solicitada",
    estimatedArrivalTime: "14:30",
    flightNumber: "AV123",
  },
  verificationProvider: "didit",
  secondaryGuestProvider: "textract",
  hasContract: true,
  contractTemplate: mockContractTemplate(),
  listingSmartlocks: [],
  mainGuestStatus: "pending",
  mainGuestCompleted: true,
  activeAutomations: [
    {
      id: 1,
      name: "SIRE",
      providerName: "Migración Colombia",
      checkinFields: ["countryOfOriginId", "countryDestinationId", "cityOfOrigin", "nationalityId"],
      triggerTypes: ["post_checkin"],
      guestType: "all"
    },
    {
      id: 2,
      name: "TRA",
      providerName: "MinCIT",
      checkinFields: ["reasonForTripId"],
      triggerTypes: ["post_checkin"],
      guestType: "all"
    }
  ]
}

// ─── Mock Catalogs ───────────────────────────────────────────────

/** identification_type (cat_id=2) */
export const mockDocumentTypes: CatalogItem[] = [
  {
    id: 7,
    catalogCategoryId: 2,
    name: "Cédula de Ciudadanía",
    nameTranslations: { en: "Citizenship ID", es: "Cédula de Ciudadanía" },
    order: 1,
    status: "ACT",
  },
  {
    id: 8,
    catalogCategoryId: 2,
    name: "Cédula de Extranjería",
    nameTranslations: { en: "Foreign ID", es: "Cédula de Extranjería" },
    order: 2,
    status: "ACT",
  },
  {
    id: 9,
    catalogCategoryId: 2,
    name: "Pasaporte",
    nameTranslations: { en: "Passport", es: "Pasaporte" },
    order: 3,
    status: "ACT",
  },
  {
    id: 10,
    catalogCategoryId: 2,
    name: "DNI",
    nameTranslations: { en: "National ID", es: "DNI" },
    order: 4,
    status: "ACT",
  },
  {
    id: 11,
    catalogCategoryId: 2,
    name: "NIT",
    nameTranslations: { en: "Tax ID", es: "NIT" },
    order: 5,
    status: "ACT",
  },
]

/** gender (cat_id=15) */
export const mockGenders: CatalogItem[] = [
  {
    id: 113,
    catalogCategoryId: 15,
    name: "Mujer",
    nameTranslations: { en: "Female", es: "Mujer" },
    order: 1,
    status: "ACT",
  },
  {
    id: 114,
    catalogCategoryId: 15,
    name: "Hombre",
    nameTranslations: { en: "Male", es: "Hombre" },
    order: 2,
    status: "ACT",
  },
  {
    id: 115,
    catalogCategoryId: 15,
    name: "Indeterminado",
    nameTranslations: { en: "Indeterminated", es: "Indeterminado" },
    order: 3,
    status: "ACT",
  },
]

/** reason_for_trip (cat_id=8) */
export const mockReasonsForTrip: CatalogItem[] = [
  {
    id: 31,
    catalogCategoryId: 8,
    name: "Turismo",
    nameTranslations: { en: "Tourism", es: "Turismo" },
    order: 1,
    status: "ACT",
  },
  {
    id: 32,
    catalogCategoryId: 8,
    name: "Negocios",
    nameTranslations: { en: "Business", es: "Negocios" },
    order: 2,
    status: "ACT",
  },
  {
    id: 33,
    catalogCategoryId: 8,
    name: "Visita familiar",
    nameTranslations: { en: "Family Visit", es: "Visita familiar" },
    order: 3,
    status: "ACT",
  },
  {
    id: 34,
    catalogCategoryId: 8,
    name: "Estudio",
    nameTranslations: { en: "Study", es: "Estudio" },
    order: 4,
    status: "ACT",
  },
  {
    id: 35,
    catalogCategoryId: 8,
    name: "Otro",
    nameTranslations: { en: "Other", es: "Otro" },
    order: 5,
    status: "ACT",
  },
]

// ─── Mock Countries (Top selections for demo) ───────────────────

export const mockCountries = [
  { id: 48, name: "Colombia", iso2: "CO", phoneCode: "57" },
  { id: 63, name: "Ecuador", iso2: "EC", phoneCode: "593" },
  { id: 174, name: "Perú", iso2: "PE", phoneCode: "51" },
  { id: 233, name: "Estados Unidos", iso2: "US", phoneCode: "1" },
  { id: 142, name: "México", iso2: "MX", phoneCode: "52" },
  { id: 11, name: "Argentina", iso2: "AR", phoneCode: "54" },
  { id: 31, name: "Brasil", iso2: "BR", phoneCode: "55" },
  { id: 43, name: "Chile", iso2: "CL", phoneCode: "56" },
  { id: 69, name: "España", iso2: "ES", phoneCode: "34" },
  { id: 75, name: "Francia", iso2: "FR", phoneCode: "33" },
  { id: 56, name: "Alemania", iso2: "DE", phoneCode: "49" },
  { id: 107, name: "Italia", iso2: "IT", phoneCode: "39" },
  { id: 230, name: "Reino Unido", iso2: "GB", phoneCode: "44" },
  { id: 37, name: "Canadá", iso2: "CA", phoneCode: "1" },
  { id: 170, name: "Panamá", iso2: "PA", phoneCode: "507" },
  { id: 53, name: "Costa Rica", iso2: "CR", phoneCode: "506" },
  { id: 236, name: "Venezuela", iso2: "VE", phoneCode: "58" },
  { id: 29, name: "Bolivia", iso2: "BO", phoneCode: "591" },
  { id: 172, name: "Paraguay", iso2: "PY", phoneCode: "595" },
  { id: 234, name: "Uruguay", iso2: "UY", phoneCode: "598" },
]

// ─── API-Aligned Mocks v4.0 (real endpoint shapes) ───────────────

/**
 * Mock for GET /api/v1/checkin/{reservationUuid}
 * Updated to match CheckinPortalResponse v4.0 shape.
 */
export const mockPortalResponse = (): CheckinPortalResponse => ({
  reservation: {
    uuid: '019d4f00-1234-7890-abcd-1234567890ab',
    arrivalDate: '2026-05-15',
    departureDate: '2026-05-20',
    totalGuestsAllowed: 3,
    checkinAllowed: true,
  },
  progress: {
    registered: 1,
    completed: 0,
    isFullyCompleted: false,    // set true to test fully-completed state
  },
  registeredGuests: [
    {
      // Only the main guest (holder) is known from PMS before anyone checks in
      uuid: 'mock-guest-uuid-001',
      name: 'Ricardo',
      lastname: 'Lombana',
      isMain: true,
      isCompleted: false,       // set true to test main-done state
      verification: {
        status: 'pending',      // change to 'approved' to simulate verification done
        currentStep: 'verification', // change to 'form' to skip to form in polling
        verifiedAt: null,
      },
    },
    // Remaining 2 guests are unknown — frontend shows them as "Huésped 2", "Huésped 3"
    // They appear in registeredGuests ONLY after completing /identify
  ],
})

/**
 * Mock for POST /api/v1/checkin/{reservationUuid}/identify
 * Updated to return FormSchema v4.0 with requiredFields/optionalFields/prefilledData.
 *
 * To test different flows, change verification.type:
 *   - { type: "session", url: "..." }  → Didit flow
 *   - { type: "document_upload" }      → Textract flow
 *   - { type: "verified_ok" }          → Skip verification
 */
export const mockIdentifyResponse = (payload: IdentifyPayload): IdentifyResponse => {
  let verificationType: VerificationDirective = { type: 'document_upload' };
  let prefilledData: Record<string, unknown> = {};

  // Error triggers (for QA/testing)
  if (payload.identificationNumber === "403") {
    const err = new Error("El huésped principal debe completar primero") as CheckinApiError; err.status = 403; throw err;
  }
  if (payload.identificationNumber === "409") {
    const err = new Error("Este documento ya está asociado a un huésped") as CheckinApiError; err.status = 409; throw err;
  }
  if (payload.identificationNumber === "999") {
    const err = new Error("La reserva ya tiene todos sus huéspedes registrados") as CheckinApiError; err.status = 422; throw err;
  }
  if (payload.identificationNumber === "500") {
    const err = new Error("Error interno del servidor") as CheckinApiError; err.status = 500; throw err;
  }

  // Caso 0: Check-in ya completado anteriormente
  if (payload.identificationNumber === "444") {
    return {
      guest: { uuid: 'mock-guest-uuid-001', name: payload.name, lastname: payload.lastname },
      reservationGuest: { isMainGuest: payload.isMainGuest, isCheckinCompleted: true },
      verification: { type: 'verified_ok' as const },
      formSchema: { requiredFields: [], optionalFields: [], prefilledData: {} },
    }
  }

  // Caso 1: Usuario registrado con verificación válida (Salta verificación)
  if (payload.identificationNumber === "333") {
    verificationType = { type: 'verified_ok' };
    prefilledData = {
      phone: "+57 300 123 4567",
      email: "test@ejemplo.com",
      dateOfBirth: "1990-01-01",
      genderId: 114
    };
  }
  // Caso 2: Documento expirado (Requiere cargar documentos de nuevo)
  else if (payload.identificationNumber === "222") {
    verificationType = { type: 'document_upload' };
  }
  // Caso 3: Guest existe en Didit con docs válidos — biometría pasa → va directo a form (no necesita KYC)
  else if (payload.identificationNumber === "111") {
    verificationType = { type: 'session', subtype: 'biometric', url: 'https://verify.didit.me/u/JxXnsWmXTy-VGB9-9qI1RA' };
  }
  // Caso 4: Guest nuevo en Didit — biometría pasa → pero no tiene docs → necesita KYC
  else if (payload.identificationNumber === "112") {
    verificationType = { type: 'session', subtype: 'biometric', url: 'https://verify.didit.me/u/JxXnsWmXTy-VGB9-9qI1RA' };
  }

  return {
    guest: {
      uuid: 'mock-guest-uuid-001',
      name: payload.name,
      lastname: payload.lastname,
    },
    reservationGuest: {
      isMainGuest: payload.isMainGuest,
      isCheckinCompleted: false,
    },
    verification: verificationType,
    formSchema: {
      requiredFields: ['countryOfOriginId', 'countryDestinationId', 'reasonForTripId'],
      optionalFields: ['cityOfOrigin', 'phone', 'email'],
      prefilledData: prefilledData,
    },
  }
}

/**
 * Mock for GET /api/v1/checkin/{reservationUuid}/form/{guestUuid} (G-NEW-4)
 * Backend returns formSchema wrapped + snake_case. Service layer normalizes.
 * Catalogs are loaded separately via CatalogService.
 */
export const mockFormSchemaResponse = (): GuestFormSchemaResponse => ({
  requiredFields: ['countryOfOriginId', 'countryDestinationId', 'reasonForTripId'],
  optionalFields: ['cityOfOrigin'],
  prefilledData: {
    nationalityId: 48,
    countryOfResidenceId: 48,
  },
})

/**
 * Mock for POST /main/complete and /secondary/{uuid}/complete (G-NEW-1, G-NEW-2)
 * Backend only returns { message } — frontend must re-fetch portal for state.
 */
export const mockCompleteResponse = (isMain: boolean): CompleteGuestResponse => ({
  message: isMain
    ? "Main guest checkin completed."
    : "Secondary guest checkin completed.",
})

/**
 * Mock for GET /checkin/{uuid}/verify/result?guest_uuid={guestUuid}
 * Simulates backend evaluating the Didit biometric session result.
 *
 * Triggers:
 *   - identificationNumber "111" (stored in verificationTrigger param) → verified (guest existed, docs valid)
 *   - identificationNumber "112" → kyc_required (guest new to Didit, needs full KYC)
 */
export const mockVerificationResult = (trigger: string): VerificationResultResponse => {
  if (trigger === '112') {
    return {
      status: 'kyc_required',
      kycUrl: 'https://verify.didit.me/u/Eq_r_SjHTm-9ScZ_9jyDGQ',
    }
  }
  // Default: verified — guest existed in Didit with valid docs
  return {
    status: 'verified',
    guestData: {
      firstName: 'Ricardo',
      lastName: 'Lombana',
      documentNumber: '1234567890',
      dateOfBirth: '1990-05-15',
      expirationDate: '2030-12-31',
    },
  }
}

/**
 * Mock for POST /secondary/{guestUuid}/documents (G-NEW-3)
 * Aligned with backend v4.1: no documentTypeDetected/homologatedTypeId.
 * Backend also returns formSchema, but it's optional and normalized in service layer.
 */
export const mockOCRResult = (): OCRResult => ({
  extractedData: {
    firstName: 'Ricardo',
    lastName: 'Lombana',
    documentNumber: '1234567890',
    dateOfBirth: '1990-05-15',
    expirationDate: '2030-12-31',
  },
  formSchema: {
    required_fields: ['country_of_origin_id', 'reason_for_trip_id'],
    optional_fields: [],
    prefilledData: {
      name: 'Ricardo',
      lastname: 'Lombana',
      identificationNumber: '1234567890',
      dateOfBirth: '1990-05-15',
    },
  },
})

// ─── Legacy Mocks (kept for backwards compatibility) ────────────────

/** @deprecated Use mockIdentifyResponse instead */
export const mockResolveIdentity = (): IdentityResolution => ({
  guestUuid: 'mock-guest-uuid-001',
  isNew: true,
  hasPreviousVerification: false,
})

export const mockVerificationApproved = (): VerificationResult => ({
  status: 'approved',
  preFilledData: {
    name: 'Ricardo',
    lastname: 'Lombana',
    dateOfBirth: '1990-05-15',
    identificationNumber: '1234567890',
  },
  documentsExpired: false,
})

export const mockSmartlockCodes = (): SmartlockCode[] => [
  { name: 'Entrada edificio', type: 'building_entrance', code: '4821',
    validFrom: '2026-05-15', validUntil: '2026-05-20' },
  { name: 'Apto 304', type: 'unit_entrance', code: '1567',
    validFrom: '2026-05-15', validUntil: '2026-05-20' },
]

export function mockContractTemplate(): ContractTemplate {
  return {
    title: "Contrato de Arrendamiento Turístico",
    bodyHtml: `<p>Entre <strong>{{host_name}}</strong> (arrendador) y <strong>{{guest_name}}</strong> (arrendatario), se acuerda el arriendo de <strong>{{property_name}}</strong> (<strong>{{unit_name}}</strong>).</p><br/><p>Fechas: {{arrival_date}} a {{departure_date}}</p><p>Valor total: {{total_price}} {{currency}}</p><br/><p>El arrendatario acepta las normas del establecimiento y la regulación de la propiedad.</p>`,
    variables: {
      host_name: "Hit Hospitality Host",
      guest_name: "Ricardo",
      property_name: "Apartamentos Centro Histórico",
      unit_name: "Unidad 201 - Vista a la Ciudad",
      arrival_date: "2026-05-15",
      departure_date: "2026-05-20",
      total_price: 750.50,
      currency: "USD"
    }
  }
}
