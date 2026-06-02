# Manual de Testing — Check-in v4.0

> Guía actualizada post-implementación. Cubre todos los flujos del main guest y secondary guest con los mocks actuales.
> Última actualización: Mayo 2026

---

## Requisitos previos

### 1. Iniciar el servidor local

```bash
npm run dev
# App disponible en http://localhost:3000
```

### 2. Confirmar modo mock activo

En `src/features/checkin/services/checkin-service.ts`:

```typescript
const USE_MOCK = true;  // debe ser true para todas las pruebas con mocks
```

### 3. Limpiar estado antes de cada prueba

**Opción A — DevTools:**
`Application → Local Storage → http://localhost:3000 → Clear All`

**Opción B — Consola del navegador:**
```javascript
Object.keys(localStorage).forEach(k => {
  if (k.startsWith('checkin-')) localStorage.removeItem(k)
})
sessionStorage.clear()  // limpia también los contadores de polling mock
```

---

## Tabla de triggers de documentos (mock)

| Número de documento | Resultado |
|---|---|
| `111` | Verificación Didit (type: `session`) |
| `222` | Verificación Textract (type: `document_upload`) |
| `333` | Skip verificación (type: `verified_ok`) |
| `403` | Error: secondary antes de main |
| `409` | Error: documento ya registrado |
| `999` | Error: capacidad máxima excedida (422) |
| `500` | Error: internal server error |
| Cualquier otro | Textract por defecto |

---

## URLs de prueba

| Flujo | URL |
|---|---|
| Main guest (portal) | `http://localhost:3000/checkin/019d4f00-1234-7890-abcd-1234567890ab` |
| Secondary guest (gate) | `http://localhost:3000/checkin/019d4f00-1234-7890-abcd-1234567890ab/s/TOKEN_CUALQUIERA` |
| Flujo externo (portal) | `http://localhost:3000/checkin/019d4f00-1234-7890-abcd-1234567890ab/airbnb/listing-uuid-123/EXT-456` |

> El `TOKEN_CUALQUIERA` en modo mock puede ser cualquier string (ej. `test-token-1`).

---

## FLUJO 1 — Main Guest (Huésped Principal)

### Paso 1 — WelcomeScreen

**URL:** `/checkin/019d4f00-1234-7890-abcd-1234567890ab`

**Verificar:**
- [ ] Título: "Unidad 201 - Vista a la Ciudad"
- [ ] Fechas: 15 may. 2026 → 20 may. 2026
- [ ] Badge de progreso: "0/2 completados"
- [ ] Guest 1: "Ricardo Lombana" (Principal) — botón "Iniciar registro" visible
- [ ] Guest 2: Sin nombre (Adicional) — badge "Esperando al titular" con ícono de candado
- [ ] Sección de requisitos (ícono reloj, documentos, datos de contacto) visible
- [ ] NO aparece botón "Ver Resumen de Check-in" (reserva no completada)

---

### Paso 2 — IdentifyScreen

**URL:** `/checkin/019d4f00-1234-7890-abcd-1234567890ab/identify`

Clic en "Iniciar registro" del guest principal o navegar directamente.

#### Caso A: Didit (doc: `111`)

| Campo | Valor |
|---|---|
| Nombre | Juan |
| Apellidos | Pérez |
| Nacionalidad | Colombia |
| Tipo Doc. | Cédula de Ciudadanía |
| Número | `111` |

**Resultado esperado:**
- [ ] Navega a `/verify?guest_uuid=mock-guest-uuid-001`
- [ ] VerifyScreen muestra tarjeta Didit con botón "Abrir Verificación Didit"

---

#### Caso B: Textract (doc: `222`)

| Campo | Valor |
|---|---|
| Nombre | María |
| Apellidos | Gómez |
| Número | `222` |

**Resultado esperado:**
- [ ] Navega a `/verify?guest_uuid=mock-guest-uuid-001`
- [ ] VerifyScreen muestra inputs de carga de archivos (frente + reverso)

---

#### Caso C: Skip verificación (doc: `333`)

| Campo | Valor |
|---|---|
| Nombre | Carlos |
| Apellidos | Rodríguez |
| Número | `333` |

**Resultado esperado:**
- [ ] Toast: "Ya completaste tu check-in anteriormente"
- [ ] Navega directamente a `/guest?guest_uuid=mock-guest-uuid-001` (sin pasar por verify)
- [ ] Formulario pre-llenado con: teléfono, email, fecha de nacimiento, género

---

#### Validaciones de formulario

- [ ] Botón "Verificar Identidad" deshabilitado si faltan campos
- [ ] Número de documento con menos de 3 caracteres no habilita el botón
- [ ] Doble clic rápido en submit no lanza dos requests (botón se deshabilita durante isSubmitting)

---

### Paso 3 — VerifyScreen (Caso A: Didit)

**URL:** `/verify?guest_uuid=mock-guest-uuid-001`

**Verificar flujo:**
- [ ] Tarjeta Didit visible con botón "Abrir Verificación Didit"
- [ ] Al hacer clic: se abre una nueva pestaña con `https://verify.didit.me/mock-session`
- [ ] La página actual cambia al estado "Esperando confirmación..." con barra de progreso
- [ ] El polling avanza (~3s por ciclo)
- [ ] En el **3er ciclo** el mock devuelve `approved` → toast "Identidad verificada exitosamente"
- [ ] Navega automáticamente a `/guest?guest_uuid=mock-guest-uuid-001`

> **Nota:** El mock usa `sessionStorage` para el contador. Si quieres ver "pending" más veces, borra `sessionStorage` antes.

---

### Paso 3 — VerifyScreen (Caso B: Textract)

**URL:** `/verify?guest_uuid=mock-guest-uuid-001`

**Verificar flujo:**
- [ ] Se muestran dos zonas de carga: "Foto Frontal" (obligatoria) y "Foto Reverso" (opcional)
- [ ] Botón "Analizar Documento" deshabilitado si no hay foto frontal

**Subir un archivo:**
- [ ] Seleccionar cualquier imagen como foto frontal (JPG/PNG)
- [ ] Botón "Analizar Documento" se habilita
- [ ] Al hacer clic: estado "Analizando documento..." con spinner
- [ ] Después de ~1.5s: estado `ocr_confirm` con datos extraídos del mock

**Pantalla de confirmación OCR:**
- [ ] Campos editables: Nombres, Apellidos, Número de Documento, Fecha de Nacimiento, Vencimiento del Documento
- [ ] Valores pre-llenados: Ricardo / Lombana / 1234567890 / 1990-05-15 / 2030-12-31
- [ ] Modificar cualquier campo y verificar que el cambio persiste
- [ ] Clic "Continuar" → navega a `/guest?guest_uuid=mock-guest-uuid-001`
- [ ] Verificar en localStorage que el formulario incluye `identificationExpiryDate: "2030-12-31"`

**Validación de tamaño de archivo:**
- [ ] Intentar subir archivo > 10MB → toast de error antes de hacer request

---

### Paso 4 — GuestFormScreen

**URL:** `/guest?guest_uuid=mock-guest-uuid-001`

**Verificar carga:**
- [ ] Estado "Preparando formulario..." (spinner) durante ~400ms
- [ ] Formulario aparece con secciones colapsables
- [ ] Pre-llenado: Nacionalidad = Colombia, País de residencia = Colombia (desde `prefilledData`)
- [ ] Si vino del flujo Textract: Nombre y Apellidos pre-llenados desde OCR

**Secciones visibles según schema dinámico:**
- Documento de identidad (siempre visible)
- Datos personales (siempre visible)
- Origen y destino (visible porque schema tiene `countryOfOriginId`, `countryDestinationId`, `reasonForTripId`)
- Fotos del documento (siempre visible)
- Información de viaje (NO visible — no está en requiredFields ni optionalFields del mock)

**Completar el formulario:**

| Campo | Valor de prueba |
|---|---|
| País del documento | Colombia |
| Tipo Doc. | Cédula de Ciudadanía |
| Número de documento | 12345678 |
| Nombre | Ricardo |
| Apellidos | Lombana |
| Fecha de nacimiento | 1990-05-15 |
| País de origen | Colombia |
| Ciudad de origen | Cali *(campo visible si schema incluye `cityOfOrigin`)* |
| País destino | Colombia |
| Razón del viaje | Turismo |
| Foto frontal | (cualquier imagen) |
| Foto reverso | (cualquier imagen, requerida si no es pasaporte) |

**Validaciones:**
- [ ] Botón "Continuar" deshabilitado mientras falten campos base obligatorios
- [ ] Teléfono y email NO bloquean el botón (son opcionales en el schema actual)
- [ ] Seleccionar "Pasaporte" como tipo de doc → desaparece el campo de foto reverso
- [ ] Badge "✓" aparece en cada sección colapsada cuando está completa
- [ ] Reload de página → form se mantiene desde localStorage

**Submit:**
- [ ] Clic "Continuar" → navega a `/contract?guest_uuid=mock-guest-uuid-001`

---

### Paso 5 — ContractScreen

**URL:** `/contract?guest_uuid=mock-guest-uuid-001`

**Verificar:**
- [ ] Estado "Cargando contrato..." (spinner) durante ~500ms
- [ ] Contrato renderizado con variables sustituidas (nombre host, propiedad, fechas, precio)
- [ ] SignaturePad visible y funcional (texto "Firma aquí" como placeholder)
- [ ] Checkbox "He leído y acepto..." visible
- [ ] Botón "Firmar y Completar" deshabilitado hasta tener firma + checkbox marcado

**Completar:**
1. Dibujar firma en el pad
2. Marcar el checkbox
3. Clic "Firmar y Completar"

**Resultado esperado (mock retorna `isCheckinCompleted: false`, pending: 2):**
- [ ] Toast: "Tu registro está completo. Los acompañantes ya pueden iniciar su registro."
- [ ] Navega a `/success?guest_uuid=mock-guest-uuid-001&main_done=true&pending=2`
- [ ] `checkin-guest-form-*` eliminado de localStorage
- [ ] `checkin-identify-*` eliminado de localStorage

---

### Paso 6 — SuccessScreen (Main Done, secundarios pendientes)

**URL:** `/success?guest_uuid=mock-guest-uuid-001&main_done=true&pending=2`

**Verificar:**
- [ ] Ícono check verde grande
- [ ] Título: "¡Tu Registro Está Listo!" (NO "¡Check-in Completado!")
- [ ] Subtítulo: "Los huéspedes acompañantes ya pueden iniciar su registro."
- [ ] Banner ámbar: "2 huéspedes pendientes — Los accesos estarán disponibles cuando todos completen..."
- [ ] Card con listingName, fechas, total guests
- [ ] Card "Contrato Firmado" con botón "Descargar"
- [ ] **NO se muestran códigos de smartlock** (solo aparecen cuando todos completan)
- [ ] Botón "Cerrar" al pie

---

### Variante: reserva completada (todos los guests)

Para probar el estado "todos completos", editar temporalmente en `mock-guest-data.ts`:

```typescript
export const mockCompleteResponse = (isMain: boolean, allDone = false) => ...
// En checkin-service.ts cambiar:
return mockCompleteResponse(true, true);  // allDone = true
```

**Resultado esperado:**
- [ ] Toast: "¡Check-in completado para todos los huéspedes!"
- [ ] URL: `/success?guest_uuid=...` (SIN `main_done=true`)
- [ ] Título: "¡Check-in Completado!"
- [ ] **Aparecen los códigos de smartlock** (Entrada edificio: 4821, Apto 304: 1567)
- [ ] Sin banner ámbar de pendientes

---

## FLUJO 2 — Secondary Guest (Huésped Adicional)

### Paso 1 — Gate Screen (bloqueado)

**URL:** `http://localhost:3000/checkin/019d4f00-1234-7890-abcd-1234567890ab/s/test-token-1`

**Estado inicial (mock: `mainGuestCompleted: false`):**
- [ ] Ícono de reloj ámbar
- [ ] Título: "Registro en espera"
- [ ] Texto menciona "Ricardo Lombana" (mainGuestName del mock)
- [ ] Caja de instrucciones: "Pídele al titular que finalice su registro"
- [ ] Botón: "Ya lo completó, recargar página"
- [ ] Clic en botón → recarga la página (sigue bloqueado porque el mock no cambió)

---

### Paso 2 — Desbloquear el gate

Para probar el flujo desbloqueado, cambiar en `checkin-service.ts`:

```typescript
// getSecondaryGateStatus mock:
return { mainGuestCompleted: true, ... }
```

**Con `mainGuestCompleted: true`:**
- [ ] Pantalla muestra brevemente "Redirigiendo..."
- [ ] Redirección automática a `/s/test-token-1/identify`

---

### Paso 3 — IdentifyScreen (Secondary)

**URL:** `/s/test-token-1/identify`

**Completar con cualquier documento que no sea trigger de error:**

| Campo | Valor |
|---|---|
| Nombre | Ana |
| Apellidos | Martínez |
| Número | `444` (cualquier valor no trigger) |

**Diferencias vs main:**
- [ ] Badge "Paso 1 de 4" (no "Paso 2 de 6")
- [ ] StepIndicator muestra 4 pasos (sin "Contrato")
- [ ] NO aparece el texto "Estás registrando al huésped principal"
- [ ] Botón envía `isMainGuest: false` (verificable en DevTools Network)

**Resultado esperado:**
- [ ] Navega a `/s/test-token-1/verify?guest_uuid=mock-guest-uuid-001`
- [ ] Tipo de verificación: `document_upload` (default para secondary)

---

### Paso 4 — VerifyScreen (Secondary)

**URL:** `/s/test-token-1/verify?guest_uuid=mock-guest-uuid-001`

- [ ] StepIndicator muestra "Paso 2 de 4"
- [ ] Mismo flujo Textract que el main (upload → OCR confirm → continuar)
- [ ] Al confirmar OCR → navega a `/s/test-token-1/guest`

---

### Paso 5 — SecondaryGuestFormScreen

**URL:** `/s/test-token-1/guest`

**Diferencias vs GuestFormScreen del main:**
- [ ] Badge "Huésped Adicional" (azul) en vez de "Huésped Titular" (morado)
- [ ] Step "Paso 3 de 4"
- [ ] **Sin sección de contrato** (no hay ContractScreen en el flujo)
- [ ] **Sin firma** en el formulario
- [ ] Teléfono y email opcionales (aparecen solo si el schema los incluye)

**Completar y hacer submit:**
- [ ] Toast: "Tus datos fueron registrados correctamente" (si quedan guests pendientes)
- [ ] Navega a `/s/test-token-1/success`

---

### Paso 6 — SecondarySuccessScreen

**URL:** `/s/test-token-1/success`

**Verificar:**
- [ ] Ícono check verde
- [ ] Título: "¡Registro Exitoso!"
- [ ] Resumen de estadía: listingName y fechas
- [ ] Mensaje: "El huésped titular tiene acceso a las instrucciones de llegada y códigos de cerradura"
- [ ] **Sin códigos de smartlock** (solo el main los recibe)
- [ ] Sin botón "Descargar contrato"

---

## FLUJO 3 — Portal Externo (sourceSlug/listingUuid/externalId)

**URL:** `http://localhost:3000/checkin/019d4f00-1234-7890-abcd-1234567890ab/airbnb/listing-uuid-123/EXT-456`

**Verificar:**
- [ ] Misma WelcomeScreen que el flujo por UUID
- [ ] `basePath` correcto en todos los links: `/checkin/.../airbnb/listing-uuid-123/EXT-456/identify`
- [ ] Navegar manualmente a cada paso del flujo y confirmar que las URLs mantienen el prefijo externo
- [ ] ContractScreen y SuccessScreen cargan correctamente con este basePath

---

## FLUJO 4 — Manejo de Errores

### Error 422 — Capacidad excedida (doc: `999`)

1. Ir a `/identify`
2. Ingresar número `999`
3. Clic "Verificar Identidad"
- [ ] Toast: "La reserva ya tiene todos sus huéspedes registrados"
- [ ] Redirect a `/?error=max_guests` (o al basePath con query param)
- [ ] NO navega a verify

---

### Error 403 — Secondary antes de main (doc: `403`)

1. Ir a `/identify` (flujo main, `isMainGuest: true`)
2. Ingresar número `403`
- [ ] Toast: "El huésped principal debe completar su registro primero"
- [ ] Redirect al basePath (WelcomeScreen)

> Para probar en flujo secondary: ir a `/s/token/identify` e ingresar `403`

---

### Error 409 — Documento ya registrado (doc: `409`)

1. Ir a `/identify`
2. Ingresar número `409`
- [ ] Toast: "Este documento ya está asociado a un huésped en esta reserva"
- [ ] Permanece en el formulario (no redirige)

---

### Error 500 — Error interno (doc: `500`)

1. Ir a `/identify`
2. Ingresar número `500`
- [ ] Toast: "Error interno del servidor"
- [ ] Permanece en el formulario con datos intactos

---

### Error 404 — Reserva no encontrada

1. Ir a `http://localhost:3000/checkin/uuid-invalido-que-no-existe`
- [ ] Página: "Reserva no encontrada / No pudimos encontrar la reserva o el link ha expirado."

---

### Error 409 — Contrato enviado dos veces

1. Completar flujo hasta ContractScreen
2. En DevTools → Network → añadir un breakpoint o simular el mock para retornar status 409
- [ ] Toast: "Ya completaste tu check-in anteriormente."
- [ ] Redirect a SuccessScreen (no muestra toast de error)

---

### Error — Archivo demasiado grande en VerifyScreen

1. En VerifyScreen (Textract)
2. Intentar subir imagen mayor a 10MB
- [ ] Toast: "La foto frontal no puede superar 10MB" (antes de hacer la request)
- [ ] No se llama a `uploadDocumentImages`

---

## FLUJO 5 — Persistencia y Recuperación

### Reload en medio del formulario

1. Completar parcialmente el GuestFormScreen
2. Recargar la página (F5)
- [ ] Todos los campos completados siguen presentes
- [ ] Secciones colapsadas mantienen su estado expandido

---

### Sesión expirada (TTL 2 horas)

El hook `useIdentifySession` invalida la sesión después de 2 horas.

Para simular TTL expirado en consola:
```javascript
const key = 'checkin-identify-019d4f00-1234-7890-abcd-1234567890ab'
const data = JSON.parse(localStorage.getItem(key))
data.timestamp = Date.now() - (3 * 60 * 60 * 1000) // hace 3 horas
localStorage.setItem(key, JSON.stringify(data))
```

Luego navegar a `/verify?guest_uuid=mock-guest-uuid-001`:
- [ ] Muestra "Sesión expirada. Vuelve a identificarte." con link a `/identify`

---

### localStorage corrupto

En consola:
```javascript
localStorage.setItem('checkin-identify-019d4f00-1234-7890-abcd-1234567890ab', 'DATOS_INVALIDOS{{{')
```

Navegar a `/verify`:
- [ ] No lanza error de JS — muestra "Sesión expirada" gracefully

---

## Configuraciones rápidas del mock

### Desbloquear secondary guest desde WelcomeScreen

En `mock-guest-data.ts`:
```typescript
mainGuestCompleted: true,  // línea ~256
```

También en `checkin-service.ts` para el gate:
```typescript
return { mainGuestCompleted: true, ... }  // línea ~226
```

### Simular reserva completada en `completeMainGuest`

En `checkin-service.ts`:
```typescript
return mockCompleteResponse(true, true);  // allDone = true
```

### Simular secondary como último guest (todos completan)

En `checkin-service.ts`:
```typescript
return mockCompleteResponse(false, true);  // allDone = true
```

### Forzar siempre Didit para cualquier número

En `mock-guest-data.ts`, cambiar el default:
```typescript
let verificationType: any = { type: 'session', url: 'https://verify.didit.me/mock-session' };
```

### Agregar campos extra al schema del formulario

En `mockFormSchemaResponse()`:
```typescript
requiredFields: ['countryOfOriginId', 'countryDestinationId', 'reasonForTripId', 'cityOfOrigin', 'phone', 'email'],
optionalFields: ['arrivalTime', 'departureFlight'],
```

---

## Comandos de consola útiles

```javascript
// Ver sesión de identify actual
JSON.parse(localStorage.getItem('checkin-identify-019d4f00-1234-7890-abcd-1234567890ab'))

// Ver datos del formulario persistidos
JSON.parse(localStorage.getItem('checkin-guest-form-019d4f00-1234-7890-abcd-1234567890ab'))

// Ver contadores de polling (cuántos ciclos lleva)
Object.keys(sessionStorage).filter(k => k.startsWith('mock-poll-count'))

// Resetear contador de polling (fuerza volver a "pending" en Didit)
Object.keys(sessionStorage).filter(k => k.startsWith('mock-poll-count')).forEach(k => sessionStorage.removeItem(k))

// Limpiar todo el estado de checkin
Object.keys(localStorage).forEach(k => { if (k.startsWith('checkin-')) localStorage.removeItem(k) })
sessionStorage.clear()
```

---

## Checklist final de aceptación

### Main guest
- [ ] WelcomeScreen muestra listing, fechas, 2 guests (main + secondary bloqueado)
- [ ] Identify → routing correcto por `verification.type` (111/222/333)
- [ ] Didit: abre nueva pestaña + polling automático → approved en 3er ciclo → navega a form
- [ ] Textract: upload → OCR confirm (editable, incluye fecha vencimiento) → navega a form
- [ ] verified_ok: salta verify, pre-llena formulario
- [ ] GuestFormScreen: schema dinámico, campos opcionales no bloquean submit
- [ ] ContractScreen: firma + checkbox → POST /main/complete → limpia localStorage
- [ ] SuccessScreen main_done: sin smartlocks, banner de pendientes
- [ ] SuccessScreen all_done: con smartlocks, sin banner

### Secondary guest
- [ ] Gate bloqueado cuando `mainGuestCompleted: false`
- [ ] Gate redirige a identify cuando `mainGuestCompleted: true`
- [ ] Flujo de 4 pasos (sin contrato, sin firma)
- [ ] Payload correcto: sin `guestUuid` en body, sin `signature`
- [ ] SecondarySuccessScreen: sin smartlocks, mensaje sobre titular

### Errores
- [ ] `999` → 422 max guests, redirect con query param
- [ ] `403` → mensaje claro, redirect a welcome
- [ ] `409` en identify → mensaje inline, no redirige
- [ ] `500` → mensaje de error, datos del form intactos
- [ ] UUID inválido → página "Reserva no encontrada"
- [ ] Archivo >10MB → error antes del request
- [ ] Sesión expirada → fallback graceful a identify
