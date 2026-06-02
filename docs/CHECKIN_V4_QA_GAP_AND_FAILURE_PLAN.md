# Plan QA Incisivo — Check-in v4.0

> Objetivo: verificar si la implementación y la guía de testing cubren TODO el flujo v4.0 para main guest y secondary guests, incluyendo happy paths, edge cases, fallos, errores backend, estados UI, persistencia y regresiones.

---

## 1. Diagnóstico rápido: qué le falta a la guía actual

La guía actual sirve como prueba manual base, pero todavía NO cubre completamente el workflow v4.0. Faltan estos bloques críticos:

| Área | Estado actual en guía | Falta |
|---|---|---|
| Portal externo | No cubierto | Probar `/checkin/{sourceSlug}/{listingUuid}/{externalId}` |
| Portal completed | Parcial | Estado cuando `reservation.isCheckinCompleted = true` |
| CTAs por guest | Parcial | Validar cada guest con estado: pendiente, bloqueado, completado |
| Didit polling real | Parcial | Timeout, rejected, approved, guest no encontrado, return URL |
| Textract confirm OCR | Parcial | Confirmar/corregir datos extraídos antes del formulario |
| GET `/form/{guestUuid}` | Parcial | Validar schema dinámico, catalogs, prefilledData y fields desconocidos |
| Main complete | Parcial | Validar payload final `profile + extra + signature` |
| Post-main completion | No cubierto | Main completado pero reserva aún incompleta; desbloqueo secundarios |
| Secondary complete | Parcial | Validar payload sin `signature`, y cierre cuando todos completan |
| Error handling | Básico | 400, 401/403, 404, 409, 413, 422 field-level, 429, 500, network timeout |
| Persistencia | Básico | Reload, back button, localStorage corrupto, TTL expirado, multi-tab |
| Seguridad pública | No cubierto | UUID inválido, guestToken inválido, acceso cruzado entre reservations |
| Responsive/mobile | No cubierto | Cámara mobile, iOS/Android file capture, Safari |
| i18n | No cubierto | ES/EN/PT, browser language, copy fallback |
| Accesibilidad | No cubierto | Labels, keyboard, focus states, error announcements |
| Observabilidad | No cubierto | Logs, toasts claros, estados recuperables |

---

## 2. Matriz de flujos obligatorios

### 2.1 Main Guest — Happy paths

| ID | Caso | Trigger | Esperado |
|---|---|---|---|
| MG-01 | Main con Didit | `verification.type=session` | Redirect/abrir Didit, polling, approved → form |
| MG-02 | Main con Textract | `verification.type=document_upload` | Upload → OCR → confirmar datos → form |
| MG-03 | Main ya verificado | `verification.type=verified_ok` | Saltar verify → form con prefill |
| MG-04 | Main completa y quedan secundarios | `pendingGuests > 0` | Mostrar confirmación main + secundarios desbloqueados, NO final total |
| MG-05 | Main completa y no hay secundarios | `totalGuests=1` | Mostrar final completo + acceso/instrucciones si backend las incluye |

### 2.2 Secondary Guest — Happy paths

| ID | Caso | Condición | Esperado |
|---|---|---|---|
| SG-01 | Secondary bloqueado | `mainGuestCompleted=false` | Gate bloqueado, CTA refresh, no puede avanzar |
| SG-02 | Secondary desbloqueado | `mainGuestCompleted=true` | Gate redirige a identify |
| SG-03 | Secondary Textract default | `document_upload` | Upload → confirm OCR → form |
| SG-04 | Secondary verified_ok | `verified_ok` | Skip verify → form |
| SG-05 | Secondary completa pero quedan pendientes | `reservation.isCheckinCompleted=false` | Confirmación individual, indicar pendientes |
| SG-06 | Último secondary completa | `reservation.isCheckinCompleted=true` | SCREEN 5 final para todos |

### 2.3 Portal

| ID | Caso | Esperado |
|---|---|---|
| P-01 | Portal UUID válido | Lista reserva + guests + estado correcto |
| P-02 | Portal externo válido | Misma UI usando source/listing/externalId |
| P-03 | Portal reserva completada | Estado completed, sin CTA de iniciar |
| P-04 | Portal con guests null name | Render sin romper, placeholder “Pendiente” |
| P-05 | Portal totalGuests > guests.length | Mostrar slots pendientes o contador correcto |
| P-06 | Portal main completado | Secundarios desbloqueados |
| P-07 | Portal main no completado | Secundarios bloqueados |

---

## 3. Casos de falla por pantalla

### 3.1 SCREEN 0 — Portal

#### Errores backend/API
| Caso | Simulación | UI esperada |
|---|---|---|
| 404 reserva no encontrada | GET portal 404 | Pantalla clara: “Reserva no encontrada o expirada” |
| 410 reserva expirada | GET portal 410 | “Este enlace expiró” + contacto PM |
| 500 backend error | GET portal 500 | Retry CTA + mensaje no técnico |
| Network offline | fetch fail | Estado offline/reintentar |
| Shape incompleto | falta `guests` | Fallback seguro, no crash |

#### Validaciones UI
- **No debe** mostrar botones de secondary si main no completó.
- **No debe** asumir que `guest.name` existe.
- **Debe** calcular progreso aunque `guests.length < totalGuests`.
- **Debe** soportar `isCheckinCompleted=true`.

---

### 3.2 SCREEN 1 — Identify

#### Errores esperados
| Código | Caso | UI esperada |
|---|---|---|
| 422 | Campos inválidos | Mostrar errores inline por campo |
| 422 | Capacidad excedida | Toast + redirect portal con `?error=max_guests` |
| 403 | Secondary antes de main | Mensaje: main debe completar primero + volver al gate |
| 404 | Reserva inválida | Pantalla/redirect reserva no encontrada |
| 409 | Guest ya asociado conflictivo | Mensaje recuperable: “Este documento ya está registrado” |
| 429 | Rate limited | “Demasiados intentos, intenta en unos minutos” |
| 500 | Error backend | Retry, no perder datos del formulario |

#### Edge cases
- Documento con espacios: trim correcto.
- Nombre/apellido con tildes y ñ.
- Máximo de caracteres: backend 120/60/30.
- Nacionalidad vacía.
- Catálogo no cargado.
- Doble click en submit: debe bloquear `isSubmitting`.
- Volver atrás desde verify conserva session.

---

### 3.3 SCREEN 2A — Didit

#### Estados obligatorios
| Estado | Cómo probar | Esperado |
|---|---|---|
| waiting_biometric | después de abrir Didit | UI indica completar ventana externa |
| approved | portal guest `verificationStatus=approved` | Navega a form |
| rejected | `verificationStatus=rejected/failed` | Error + reintentar |
| expired | `verificationStatus=expired` | Error + reiniciar identify/verify |
| pending timeout | 5-10 min sin cambio | Timeout amable + contacto/refresh |
| guest missing | guestUuid no aparece en portal | Error recuperable, volver a identify |

#### Fallos específicos
- Didit URL vacía o inválida.
- Popup blocked si se abre en nueva pestaña.
- Usuario cierra Didit sin completar.
- Polling recibe 500 intermitente: debe seguir intentando con límite.
- Componente desmontado: limpiar interval.

---

### 3.4 SCREEN 2B — Textract

#### Upload
| Caso | Esperado |
|---|---|
| Sin frontImage | Botón deshabilitado o error claro |
| backImage opcional según documento | Validación correcta |
| Archivo >10MB | Error antes de enviar o backend 413 manejado |
| Archivo no imagen/PDF no permitido | Error de tipo |
| Upload 500 | Retry sin perder selección |
| Upload lento | Loading/progress visible |

#### OCR confirm
| Caso | Esperado |
|---|---|
| OCR success completo | Mostrar confirmación editable |
| OCR success parcial | Mostrar campos faltantes como requeridos |
| OCR error_extraction | Permitir resubir |
| Usuario corrige nombre/doc/date | Datos corregidos persisten al formulario |
| homologatedTypeId existe | Preseleccionar tipo de documento |
| expirationDate existe | Pasar a `identificationExpiryDate` |

---

### 3.5 SCREEN 3 — Dynamic Form

#### Schema/campos
| Caso | Esperado |
|---|---|
| `requiredFields=[]` | Solo campos base indispensables o CTA válido según spec |
| Field desconocido | Ignorar con warning, no crash |
| `catalogs` vacío | Select muestra fallback/error claro |
| `prefilledData` parcial | Prellenar solo disponibles |
| Required field vacío | Botón disabled/error inline |
| Optional field vacío | Permite continuar |
| Firma visible solo main | Secondary no ve firma |

#### Persistencia
- Reload conserva avances.
- localStorage corrupto → reset seguro.
- TTL expirado → volver a identify con mensaje.
- Cambiar de guestUuid → no mezclar datos de otro guest.
- Multi-tab: evitar sobrescribir session de otro guest.

---

### 3.6 SCREEN 4A — Complete Main

#### Payload esperado
Debe enviar:
```json
{
  "guestUuid": "...",
  "profile": {
    "name": "...",
    "lastname": "...",
    "email": "...",
    "phone": "...",
    "dateOfBirth": "...",
    "genderId": 1,
    "nationalityId": 42,
    "cityOfResidence": "...",
    "countryOfResidenceId": 42
  },
  "extra": {
    "countryOfOriginId": 42,
    "countryDestinationId": 42,
    "cityOfOrigin": "...",
    "reasonForTripId": 1,
    "documentImage1": "...",
    "documentImage2": "..."
  },
  "signature": "data:image/png;base64,..."
}
```

#### Fallos
| Caso | Esperado |
|---|---|
| signature null y backend acepta | Completa correctamente |
| signature requerida y falta | Error inline en firma |
| 422 field errors | Mostrar errores en secciones correspondientes |
| 409 ya completado | Redirigir a success/portal, no duplicar |
| 500 al completar | Retry sin perder firma ni datos |

#### Post-completion
- Si `pendingGuests > 0`: mostrar main done, secundarios desbloqueados, NO smartlocks finales.
- Si `isCheckinCompleted=true`: mostrar SCREEN 5 final.

---

### 3.7 SCREEN 4B — Complete Secondary

#### Payload esperado
Debe enviar:
```json
{
  "profile": {
    "name": "...",
    "lastname": "...",
    "email": "...",
    "phone": "...",
    "dateOfBirth": "...",
    "identificationExpiryDate": "...",
    "nationalityId": 42
  },
  "extra": {
    "countryOfOriginId": 42,
    "reasonForTripId": 1
  }
}
```

#### Reglas
- No enviar `guestUuid` en body.
- No enviar `signature`.
- Usar `guestUuid` en URL, no `guestToken`.
- `guestToken` solo sirve para entrar al link público/gate.

#### Fallos
| Caso | Esperado |
|---|---|
| 403 main no completado | Volver al gate bloqueado |
| 404 guestToken inválido | Link inválido/expirado |
| 409 secondary ya completado | Mostrar success individual |
| Último secondary | Mostrar SCREEN 5 final |
| Quedan pendientes | Mostrar confirmación individual |

---

### 3.8 SCREEN 5 — Final completed

Validar:
- Mensaje global: todos completaron.
- No mostrar CTA de iniciar check-in.
- Si backend incluye smartlocks → mostrar solo al main guest o según producto.
- Si no hay smartlocks → no romper UI.
- Datos de llegada/instrucciones presentes o fallback.

---

## 4. Casos E2E completos

### E2E-01 — Reserva 1 guest, main Didit approved
1. Portal totalGuests=1.
2. Identify main → session.
3. Didit approved via portal polling.
4. Form dinámico.
5. Complete main.
6. `reservation.isCheckinCompleted=true`.
7. SCREEN 5 final.

### E2E-02 — Reserva 2 guests, main Textract + secondary Textract
1. Portal totalGuests=2, main incomplete.
2. Secondary gate bloqueado.
3. Main identify → document_upload.
4. Upload OCR → confirm → form → complete main.
5. Portal muestra `mainGuestCompleted=true`, reserva incompleta.
6. Secondary gate desbloqueado.
7. Secondary identify → upload OCR → confirm → form → complete secondary.
8. Response `reservation.isCheckinCompleted=true`.
9. SCREEN 5 final.

### E2E-03 — Main verified_ok + secondary pending
1. Identify main → verified_ok.
2. Form prefilled.
3. Complete main.
4. Confirmación main con secundarios desbloqueados.

### E2E-04 — Secondary intenta antes de main
1. Abrir secondary link.
2. Gate bloqueado.
3. Intentar ir manualmente a `/identify`.
4. Backend devuelve 403.
5. UI vuelve al gate y muestra mensaje claro.

### E2E-05 — Error recovery
1. Textract upload falla 500.
2. Reintentar sin perder archivos o permitir re-seleccionar.
3. OCR success parcial.
4. Corregir manualmente.
5. Completar sin perder datos.

---

## 5. Datos de prueba recomendados

### Document numbers como triggers mock
| Número | Resultado |
|---|---|
| `111` | Didit/session |
| `222` | Textract/document_upload |
| `333` | verified_ok |
| `403` | 403 secondary blocked |
| `409` | conflict already registered/completed |
| `422` | field validation |
| `999` | capacity exceeded |
| `500` | backend error |

### Reservas mock sugeridas
| UUID | totalGuests | Estado |
|---|---:|---|
| `mock-main-only` | 1 | Ninguno completado |
| `mock-two-guests-locked` | 2 | main incomplete, secondary locked |
| `mock-two-guests-main-done` | 2 | main completed, secondary pending |
| `mock-all-completed` | 2 | reservation completed |
| `mock-expired` | 2 | 410 expired |

---

## 6. Plan de automatización

### 6.1 Unit tests
- Mapper `GuestFormData → CompleteMainGuestPayload`.
- Mapper `GuestFormData → CompleteSecondaryGuestPayload`.
- Helper `isFieldVisible/isFieldRequired`.
- Parser safe de localStorage.
- Polling helper: approved/rejected/timeout.

### 6.2 Component tests
- `WelcomeScreen`: states locked/unlocked/completed.
- `IdentifyScreen`: routing por `verification.type` + errores 403/422/404.
- `VerifyScreen`: Didit states + Textract confirm OCR.
- `GuestFormScreen`: dynamic schema + validation.
- `SecondaryGuestFormScreen`: no signature, payload correcto.

### 6.3 E2E Playwright
Crear specs:
```text
checkin-main-didit.spec.ts
checkin-main-textract.spec.ts
checkin-main-verified-ok.spec.ts
checkin-secondary-gate.spec.ts
checkin-secondary-complete.spec.ts
checkin-errors.spec.ts
```

### 6.4 Contract/API tests con MSW
Mockear endpoints reales:
- `GET /api/v1/checkin/:reservationUuid`
- `POST /api/v1/checkin/:reservationUuid/identify`
- `POST /api/v1/checkin/:reservationUuid/secondary/:guestUuid/documents`
- `GET /api/v1/checkin/:reservationUuid/form/:guestUuid`
- `POST /api/v1/checkin/:reservationUuid/main/complete`
- `POST /api/v1/checkin/:reservationUuid/secondary/:guestUuid/complete`

---

## 7. Gaps de implementación que deben verificarse en código

Antes de declarar “todo check-in listo”, confirmar estos puntos en código:

| Gap | Pregunta crítica |
|---|---|
| Portal externo | ¿Existe service method para `/{sourceSlug}/{listingUuid}/{externalId}` alineado al nuevo shape? |
| Portal shape | ¿Toda UI usa `portal.guests`, no `registeredGuests`? |
| Dynamic form | ¿GuestForm llama `getGuestFormSchema()` o solo session.formSchema? |
| OCR confirm | ¿Existe pantalla/estado `confirm_ocr` editable? |
| Polling Didit | ¿Usa `getPortal()` y `guest.verificationStatus`? |
| Main complete | ¿Se llama `/main/complete` con payload completo? |
| Contract signature | ¿Se incluye en el payload final o se persiste hasta completar? |
| Secondary complete | ¿Usa URL `/secondary/{guestUuid}/complete`, no guestToken? |
| Final completed | ¿Distingue main-done vs all-done? |
| Error 403 | ¿Está manejado en IdentifyScreen? |
| Smartlocks | ¿No se muestran antes de que todos completen? |
| localStorage key | ¿Incluye reservationUuid + guestUuid para evitar contaminación? |

---

## 8. Criterios de aceptación final

El check-in se considera listo cuando:

- [ ] Main guest completa exitosamente con Didit.
- [ ] Main guest completa exitosamente con Textract + confirm OCR.
- [ ] Main guest verified_ok salta verify y completa.
- [ ] Secondary guest no puede iniciar antes del main.
- [ ] Secondary guest puede completar después del main.
- [ ] Último secondary marca `reservation.isCheckinCompleted=true`.
- [ ] UI diferencia: main completed vs all completed.
- [ ] Payloads enviados coinciden 1:1 con backend v4.0.
- [ ] Polling usa portal endpoint.
- [ ] Form renderiza solo required + optional fields.
- [ ] OCR prefill llega al formulario y puede corregirse.
- [ ] Todos los errores esperados tienen copy claro + recovery path.
- [ ] Build y typecheck pasan en limpio.
- [ ] Tests manuales + E2E cubren los 6 flujos principales.

---

## 9. Recomendación de ejecución

### Bloque A — Auditoría de gaps reales en código
1. Revisar service endpoints actuales.
2. Revisar shapes de types/mocks.
3. Revisar GuestForm/Contract/SecondaryForm.
4. Revisar Verify polling + OCR confirm.

### Bloque B — Corregir P0 antes de QA completo
1. `/main/complete` correcto.
2. `/secondary/{guestUuid}/complete` correcto.
3. `/form/{guestUuid}` usado realmente.
4. Polling via portal.
5. OCR confirm.
6. Error 403.

### Bloque C — QA manual exhaustivo
Ejecutar E2E-01 a E2E-05 con mocks controlados.

### Bloque D — QA con backend real
Usar reserva seed `totalGuests=2`, Didit sandbox y documentos de prueba.

### Bloque E — Automatización
Playwright + MSW para cubrir regresiones.
