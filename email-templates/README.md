# Check-in invitation emails — HIT Guest

HTML email templates for the check-in link, branded with the HIT Guest manual.
Built email-client-safe (table layout, inline styles, MSO fallbacks) — works in
Gmail, Outlook, Apple Mail and mobile clients.

> These are consumed by the **backend** (the mailer), not the Next.js app. The
> frontend doesn't send email; this is the brand-aligned template for Ricardo to use.

## Files

| File | Language | Email subject |
|------|----------|---------------|
| `checkin-invitation.es.html` | Español | `Completa tu check-in en {{property_name}}` |
| `checkin-invitation.pt.html` | Português | `Conclua seu check-in em {{property_name}}` |
| `checkin-invitation.en.html` | English | `Complete your check-in at {{property_name}}` |

## Placeholders (backend replaces before sending)

| Placeholder | Description |
|-------------|-------------|
| `{{guest_first_name}}` | Main guest's first name |
| `{{property_name}}` | Property name |
| `{{checkin_link}}` | Full guest check-in URL, e.g. `https://hit-guest-frontend.vercel.app/checkin/{reservationUuid}` |

The `{{checkin_link}}` is used twice: in the CTA button (incl. the MSO/Outlook
`v:roundrect` fallback) and in the plain-text fallback link. Replace **all**
occurrences.

## Brand tokens

| Token | Hex |
|-------|-----|
| Navy (header / titles) | `#222755` |
| Purple (CTA / accent) | `#9D4CF2` |
| Blue (links) | `#5467FA` |
| Background | `#F9FBFA` |

## Notes
- Design matches the HiTGuest OTP email (gradient header #9D4CF2→#5467FA, Poppins,
  navy footer with gradient bottom bar) for a consistent brand across emails.
- **Logo** uses the hosted asset `https://hitguest.com/assets/images/email/hit_logo_5.png`
  (header + footer). If that URL changes, update both `<img src>` occurrences.
- Poppins is loaded via `@import` with Helvetica/Arial fallbacks (some clients
  ignore web fonts and fall back gracefully).
