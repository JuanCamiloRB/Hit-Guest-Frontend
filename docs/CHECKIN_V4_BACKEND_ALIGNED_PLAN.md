# Check-in v4.0 — Backend-Aligned Implementation Plan

> Architect-level plan for Next.js 14 frontend, aligned 1:1 with confirmed Laravel backend endpoints.

---

## 1. Confirmed Backend Endpoints

### 1.1 `GET /api/v1/checkin/{reservationUuid}` — Portal

Returns reservation context, progress counters, and registered guests list.

```json
{
  "reservation": {
    "uuid": "string",
    "arrivalDate": "Y-m-d",
    "departureDate": "Y-m-d",
    "totalGuestsAllowed": "integer"
  },
  "progress": {
    "registered": "integer",
    "completed": "integer",
    "isFullyCompleted": "boolean"
  },
  "registeredGuests": [
    {
      "uuid": "string",
      "name": "string",
      "lastname": "string",
      "isMain": "boolean",
      "isCompleted": "boolean"
    }
  ]
}
```

**Frontend type:** `CheckinPortalResponse` ✅ (aligned)
**Used by:** `WelcomeScreen`, `SuccessScreen`, `SecondarySuccessScreen`, `pollGuestVerification`

### 1.2 `POST /api/v1/checkin/{reservationUuid}/identify` — Identify Guest

#### Validation Rules (from backend)
```
identificationTypeId  → required, integer, exists:catalogs (category_id=2)
identificationNumber  → required, string, max:30
nationalityId         → required, integer, exists:countries
name                  → required, string, max:120
lastname              → required, string, max:60
isMainGuest           → required, boolean
```

#### Additional Backend Validations
- **404** → Reservation not found
- **422** → Maximum guests reached / field validation errors
- **403** → Secondary guest trying to register before main guest completes (to add)
- **409** → Document already associated with another guest in this reservation (to add)

#### Response
```json
{
  "guest": { "uuid": "string", "name": "string", "lastname": "string" },
  "reservationGuest": { "isMainGuest": "boolean", "isCheckinCompleted": "boolean" },
  "verification": {
    "type": "session | document_upload | verified_ok",
    "url": "string (only when type=session)"
  },
  "formSchema": {
    "requiredFields": ["string"],
    "optionalFields": ["string"],
    "prefilledData": {}
  }
}
```

**Frontend type:** `IdentifyPayload` + `IdentifyResponse` ✅ (aligned)

### 1.3 Verification Flow — Didit Integration

**Backend behavior:** Returns a URL. Frontend opens it. Backend does NOT participate in the Didit session — only receives webhook when completed.

**Didit Workflow URLs (real, confirmed):**
- Biometrics only: `https://verify.didit.me/u/JxXnsWmXTy-VGB9-9qI1RA`
- KYC only: `https://verify.didit.me/u/Eq_r_SjHTm-9ScZ_9jyDGQ`

**Frontend implementation strategy:**

```
┌─────────────────────┐
│  VerifyScreen       │
│  type === "session" │
├─────────────────────┤
│ 1. Open Didit URL   │──→ window.open(verification.url, '_blank')
│    in new tab        │
│ 2. Show "Verificando │
│    tu identidad..."  │
│ 3. Poll portal every │──→ GET /checkin/{uuid} → check registeredGuests[].isCompleted
│    5s for status     │
│ 4. When approved →   │──→ Navigate to /guest form
│    proceed           │
│ 5. Timeout after 5m  │──→ Show retry/refresh UI
└─────────────────────┘
```

**Didit SDK consideration:** For v4.1, embed the Didit SDK as an iframe/webview for seamless UX instead of opening a new tab. Package: `@didit-sdk/react` (if available). For now, the redirect approach works.

### 1.4 `POST /main/complete` & `POST /secondary/{guestUuid}/complete`

Completion endpoints for main and secondary guests. Response includes updated reservation status.

**Frontend types:** `CompleteMainGuestPayload`, `CompleteSecondaryGuestPayload`, `CompleteGuestResponse` ✅

### 1.5 `POST /secondary/{guestUuid}/documents` — Document Upload (Textract)

For `verification.type === "document_upload"`. Uploads front/back images, returns OCR extracted data.

**Frontend type:** `OCRResult` ✅

---

## 2. Architecture Decisions

### 2.1 State Flow

```
getPortal() → WelcomeScreen
    │
    ▼
identify() → saves IdentifySessionData to localStorage
    │
    ├── verified_ok → GuestFormScreen (skip VerifyScreen)
    ├── session → VerifyScreen (Didit redirect + poll)
    └── document_upload → VerifyScreen (upload + OCR confirm)
         │
         ▼
    GuestFormScreen → saves form to localStorage → navigate to /contract
         │
         ▼
    ContractScreen → reads localStorage → completeMainGuest() / completeSecondaryGuest()
         │
         ├── result.reservation.isCheckinCompleted === true → /success (all done)
         └── result.reservation.isCheckinCompleted === false → /success?main_done=true&pending=N
```

### 2.2 Session Persistence

- **Hook:** `useIdentifySession(reservationUuid)` — stores `IdentifySessionData` in localStorage with TTL
- **Form data:** stored in localStorage keyed by `checkin-form-{reservationUuid}` or `checkin-secondary-form-{guestToken}`
- **Cleaned up** after successful completion

### 2.3 Derived Values (not from backend)

```typescript
// Portal doesn't include these — computed in frontend:
isMainGuestCompleted(portal) → registeredGuests.some(g => g.isMain && g.isCompleted)
pendingGuestsCount(portal) → totalGuestsAllowed - progress.completed
```

### 2.4 Verification Polling Strategy

Portal endpoint doesn't have `verificationStatus` on guests. After Didit/Textract completes:
- **Mock mode:** Counter-based (approves after 3 polls)
- **Production:** Poll `getPortal()` → check `registeredGuests[].isCompleted`
- **Interval:** 5 seconds
- **Timeout:** 30 attempts (2.5 minutes)

---

## 3. Mock Testing Triggers

| Doc Number | Flow Triggered |
|---|---|
| `111` | Didit biometrics session |
| `112` | Didit KYC session |
| `222` | Textract document_upload |
| `333` | verified_ok (skip verification, prefilled data) |
| `403` | Error: main guest not complete (403) |
| `409` | Error: document conflict (409) |
| `999` | Error: max guests reached (422) |
| `500` | Error: server error (500) |
| Any other | Default: document_upload |

---

## 4. Implementation Status

### ✅ Completed (this session)

| Component | Change |
|---|---|
| `types/checkin.ts` | `CheckinPortalResponse` + `RegisteredGuest` aligned with real backend shape |
| `types/checkin.ts` | Added `isMainGuestCompleted()` + `pendingGuestsCount()` helpers |
| `mock-guest-data.ts` | Portal mock matches real shape; Didit URLs updated; error triggers added |
| `WelcomeScreen` | Uses `progress`, `registeredGuests`, `totalGuestsAllowed`, `isMainGuestCompleted()` |
| `SuccessScreen` | Handles `main_done` param, pending guests banner, conditional smartlock codes |
| `SecondarySuccessScreen` | Uses new portal shape |
| `ContractScreen` | Handles main-done vs all-done routing |
| `SecondaryGuestFormScreen` | Uses `completeSecondaryGuest` result, 403 handling |
| `IdentifyScreen` | 403 + 409 error handling |
| `checkin-service.ts` | `pollGuestVerification` uses `registeredGuests[].isCompleted` |
| Contract pages | Removed unnecessary `getReservation()` / `getReservationByExternal()` calls |

### 🔲 Remaining (backend-dependent)

| Item | Status | Notes |
|---|---|---|
| Didit SDK embed | Deferred to v4.1 | Current redirect flow works; SDK would improve UX |
| `listingName` in portal | Missing from backend | Removed from frontend; add to backend response later |
| Real verification polling | Depends on webhook | `isCompleted` changes only after full checkin, not just verification |
| formSchema catalogs endpoint | Not confirmed | Currently using mocked catalogs in `getGuestFormSchema` |
| Secondary gate status endpoint | Legacy | Uses `getSecondaryGateStatus()` with `CheckinReservationV4` |

---

## 5. Route Map

```
/checkin/{reservationUuid}
  ├── page.tsx                    → WelcomeScreen (getPortal)
  ├── identify/page.tsx           → IdentifyScreen
  ├── verify/page.tsx             → VerifyScreen
  ├── guest/page.tsx              → GuestFormScreen
  ├── contract/page.tsx           → ContractScreen
  ├── success/page.tsx            → SuccessScreen (getPortal)
  └── s/{guestToken}/
      ├── page.tsx                → SecondaryGateScreen
      ├── identify/               → IdentifyScreen (isSecondary=true)
      ├── guest/page.tsx          → SecondaryGuestFormScreen
      └── success/page.tsx        → SecondarySuccessScreen (getPortal)
```

---

## 6. Next Steps

1. **Backend:** Add `listingName` to portal response (nice to have for UX)
2. **Backend:** Confirm verification status polling mechanism (separate field or endpoint?)
3. **Backend:** Confirm complete endpoint response shape matches `CompleteGuestResponse`
4. **Frontend:** Integrate Didit JS SDK for embedded verification (v4.1)
5. **Frontend:** Replace mock catalogs with real endpoint once `getGuestFormSchema` is confirmed
6. **Frontend:** Set `USE_MOCK = false` and test with real backend
