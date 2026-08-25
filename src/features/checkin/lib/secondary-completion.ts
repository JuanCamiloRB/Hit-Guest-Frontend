import type { CompleteSecondaryGuestPayload, GuestFormData } from "../types/checkin"

/** Maps the editable secondary form to the exact `/secondary/{guest}/complete` contract. */
export function buildSecondaryCompletionPayload(
    form: Partial<GuestFormData>,
): CompleteSecondaryGuestPayload {
    return {
        profile: {
            name: String(form.name ?? ""),
            lastname: String(form.lastname ?? ""),
            email: String(form.email ?? ""),
            phone: form.phone || undefined,
            dateOfBirth: String(form.dateOfBirth ?? ""),
            genderId: form.genderId ? Number(form.genderId) : null,
            nationalityId: Number(form.nationalityId),
            cityOfResidence: form.cityOfResidence || undefined,
            countryOfResidenceId: form.countryOfResidenceId ? Number(form.countryOfResidenceId) : undefined,
            identificationTypeId: form.identificationTypeId ? Number(form.identificationTypeId) : null,
            identificationNumber: String(form.identificationNumber ?? "").trim() || null,
            identificationExpiryDate: form.identificationExpiryDate || undefined,
        },
        extra: {
            countryOfOriginId: form.countryOfOriginId ? Number(form.countryOfOriginId) : undefined,
            countryDestinationId: form.countryDestinationId ? Number(form.countryDestinationId) : undefined,
            cityOfOrigin: form.cityOfOrigin || undefined,
            reasonForTripId: form.reasonForTripId ? Number(form.reasonForTripId) : undefined,
            documentImage1: form.documentImage1 || null,
            documentImage2: form.documentImage2 || null,
            arrivalTime: form.arrivalTime,
            departureTime: form.departureTime,
            arrivalFlight: form.arrivalFlight,
            departureFlight: form.departureFlight,
            ...(form.dynamicExtra ?? {}),
        },
    }
}
