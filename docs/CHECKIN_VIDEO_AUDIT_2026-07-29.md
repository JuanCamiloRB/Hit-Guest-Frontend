# Auditoría del registro de huéspedes — video del 29-jul-2026

## 1. Alcance y criterio

Esta es una auditoría estática del frontend Next.js/React y de los contratos
conservados en el repositorio. No se capturó el tráfico real del video ni se
dispone del UUID de esa reserva, por lo que no se atribuyen al backend payloads
que no estén documentados o consumidos por el código.

Estados usados:

- **Confirmado:** existe evidencia directa en código o contrato.
- **Probable:** explica el síntoma, pero requiere capturar la respuesta real.
- **Bloqueo backend:** el frontend no tiene datos o autoridad suficientes.
- **Cambio local no desplegado:** existe en el working tree, pero no en `HEAD`.

## 2. Resumen ejecutivo

| Tema                             | Diagnóstico                                                                                                                    | Responsable                           |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------- |
| CTA “Iniciar registro”           | La versión en `HEAD` solo tiene botones pequeños por fila. El working tree ya agrega un CTA fijo grande, pero está sin commit  | Frontend + despliegue                 |
| Compartir con acompañantes       | Existe como cambio local sin commit, pero comparte el link general de la reserva; no crea una invitación/token de acompañante  | Frontend incompleto + backend         |
| Validación de huésped recurrente | No existe OTP de check-in. `verified_ok` salta directo al formulario                                                           | Bloqueo backend y riesgo de seguridad |
| Email/WhatsApp recurrente        | `/form` puede devolverlos completos y el formulario principal siempre los muestra y exige                                      | Frontend + backend                    |
| Dos contratos                    | El portal entrega un arreglo de documentos, el frontend renderiza todos, elige el primer “contrato” y usa un provider separado | Backend + frontend, severidad alta    |
| Fotografías de documentos        | La tarjeta ya existe en el detalle de reserva; depende de URLs autenticadas en `/reservations/{uuid}/guests`                   | Disponible, condicionado por backend  |
| Quién hizo el check-in           | Se muestran nombre, principal/secundario y estado; no existen `completedAt`, actor ni canal de captura                         | Bloqueo backend                       |

## 3. Mapa real del flujo

```text
GET /checkin/{reservationUuid}
  └─ WelcomeScreen
      ├─ /identify
      │   └─ POST /checkin/{reservationUuid}/identify
      │       ├─ verification.type=session         → /verify
      │       ├─ verification.type=document_upload → /verify
      │       └─ verification.type=verified_ok      → /guest, sin desafío adicional
      ├─ /guest
      │   └─ GET /checkin/{reservationUuid}/form/{guestUuid}
      │       └─ prefilledData se mezcla en el formulario
      ├─ /contract
      │   ├─ GET /checkin/{reservationUuid}
      │   ├─ render de todos los portal.documents
      │   ├─ POST /main/sign si provider nativo
      │   └─ POST /main/complete
      └─ /success

Dashboard / reserva/{uuid}
  └─ GuestDocumentsCard
      ├─ GET /checkin/{reservationUuid}
      └─ GET /reservations/{reservationUuid}/guests
          └─ reservationSpecificData.documentImages.{front,back}
```

## 4. Punto 1 — Visibilidad de “Iniciar registro”

### Confirmado

La versión confirmada en `HEAD` muestra CTA pequeños dentro de cada fila. Solo
tenía CTA global cuando toda la reserva ya estaba completada.

El working tree agrega:

- selección de la siguiente acción principal;
- CTA fijo de 56 px de altura;
- copy “Comenzar mi registro”, “Continuar mi registro” o “Registrar siguiente
  huésped”.

Archivo: `src/features/checkin/components/WelcomeScreen.tsx`.

### Conclusión

El pedido visual está implementado localmente, pero no puede considerarse
resuelto hasta que el cambio se revise, pase CI, se incluya en un commit y se
despliegue. El video es coherente con la versión de `HEAD`.

### Riesgo técnico detectado

Los archivos auditados no pasan actualmente el lint dirigido. En
`WelcomeScreen` aparece `react-hooks/set-state-in-effect`, y el flujo de
verificación contiene errores adicionales. Esto puede bloquear CI aunque el CTA
se vea correcto localmente.

## 5. Punto 2 — Reenvío a acompañantes y titular del link

### Lo que existe

El working tree agrega `navigator.share`, fallback a WhatsApp y copia al
portapapeles. Comparte:

```text
window.location.href
```

Es decir, el link general de la reserva, no un link individual del acompañante.

El dashboard del PM ya puede:

- enviar el link por email a un destinatario;
- elegir idioma;
- copiar el link;
- abrir WhatsApp al número de la reserva.

### Problema confirmado

No existe hoy el concepto verificable de “dueño del link” en el portal. El UUID
de reserva funciona como secreto compartido. Cualquier persona que lo tenga
puede cargar el portal y ver los nombres presentes en `registeredGuests`.

Además, las rutas locales para slots anónimos construyen valores como:

```text
/s/new-2/identify
```

pero `getSecondaryGateStatus()` ignora totalmente `guestToken` y deriva el gate
desde el portal general. Por tanto, el token no autentica ni limita al
acompañante.

### Bloqueo backend

Antes de llamar esto “reenviar al contacto”, se necesita un contrato real de
invitación que:

1. autorice al titular;
2. cree o seleccione un slot de acompañante;
3. emita un token opaco, individual, revocable y con expiración;
4. permita enviar por email/WhatsApp sin revelar los demás huéspedes;
5. registre destinatario enmascarado, fecha y estado de uso.

No hay endpoint confirmado para esto. Los nombres de ruta y payload deben
acordarse con backend; no deben inventarse solo en frontend.

## 6. Punto 3 — Huésped recurrente y OTP

### Causa confirmada

El contrato actual define:

```json
{ "verification": { "type": "verified_ok" } }
```

para un huésped que backend considera previamente verificado. En
`IdentifyScreen` ese valor:

1. guarda una marca en `localStorage`;
2. navega directamente a `/guest`;
3. no solicita código por email ni WhatsApp.

No existe en el módulo check-in:

- endpoint para solicitar desafío;
- `challengeId`;
- destino enmascarado;
- pantalla de código;
- endpoint de confirmación;
- límite de intentos o reenvíos.

Los endpoints OTP existentes pertenecen al login administrativo y no deben
reutilizarse para huéspedes.

### Riesgo

Documento, nombre, apellido y nacionalidad no son prueba de posesión. Si
`verified_ok` también permite que `/form` entregue datos históricos completos,
una persona con el link de reserva y esos datos puede acceder a PII del huésped.

### Contrato backend requerido, todavía no existente

`POST /identify` debe distinguir entre:

- huésped nuevo: biometría/documentos;
- huésped recurrente no autenticado para esta sesión: desafío de contacto;
- huésped recurrente con desafío confirmado: continuar;
- huésped ya completado para esta reserva: resumen, sin exponer datos sensibles.

La directiva necesita como mínimo:

```json
{
  "verification": {
    "type": "contact_challenge",
    "challengeId": "opaque-id",
    "channel": "email",
    "maskedDestination": "j***@gmail.com",
    "expiresIn": 300,
    "resendAfter": 60
  }
}
```

Esto es una **propuesta de forma**, no un endpoint existente. Backend debe
definir solicitud, verificación, expiración, rate limit, intentos, auditoría y
fallback cuando el contacto histórico no está disponible.

El frontend necesita un nuevo estado entre `/identify` y `/guest`, y solo puede
aceptar la confirmación emitida por backend; nunca una bandera de
`localStorage`.

## 7. Punto 4 — No volver a pedir ni mostrar email/WhatsApp

### Confirmado

`GuestFormScreen`:

- mezcla todo `prefilledData` recibido de `/form`;
- contempla `phone` y `email` entre los strings prellenables;
- siempre renderiza ambos campos en el formulario principal;
- los marca como requeridos.

En acompañantes se muestran si el schema los declara visibles.

### Corrección funcional

Para un huésped recurrente autenticado mediante desafío:

- mostrar únicamente el destino enmascarado durante la validación;
- no devolver email/teléfono completos en `prefilledData`;
- no renderizarlos otra vez;
- permitir que `complete` los omita y que backend conserve los valores
  históricos;
- ofrecer un flujo explícito y nuevamente validado si el huésped quiere
  actualizarlos.

Ocultarlos solo con CSS no corrige la exposición: deben dejar de viajar en la
respuesta pública.

## 8. Punto 5 — Un contrato por canal y un método de firma

### Regla confirmada

El contrato del producto ya establece:

- un contrato por canal;
- máximo uno activo por canal;
- la firma (`hitguest_signature` o `tufirma`) es atributo del contrato;
- una reserva no debe recibir dos contratos del mismo canal.

### Fallos confirmados del frontend

`ContractScreen`:

1. renderiza todos los elementos de `portal.documents`;
2. selecciona como contrato el primer documento cuyo `type` coincida con una
   regex;
3. si no lo encuentra, usa el primer documento de cualquier tipo;
4. obtiene `signingProvider` de `portal.contract`, separado del documento;
5. si `portal.contract` falta o la carga falla, inventa
   `hitguest` como fallback.

Esto permite inconsistencias graves:

- mostrar dos contratos;
- firmar el UUID de un contrato con el provider de otro;
- ofrecer firma nativa cuando el canal requería TuFirma;
- firmar reglas/instrucciones si no se reconoce el tipo.

### Bloqueo backend

El portal actual no expone en `PortalDocument`:

- `reservationSourceId`;
- `signatureProviderSlug`;
- indicador `isContract`;
- relación inequívoca con `portal.contract`.

El frontend no puede determinar de forma fiable cuál corresponde al canal
Directa.

Backend debe resolver el canal de la reserva y devolver una sola selección
autoritativa, por ejemplo dentro de `contract`:

```json
{
  "contract": {
    "documentUuid": "contract-for-direct-channel",
    "reservationSourceId": 16,
    "signingProvider": "tufirma",
    "status": "not_started"
  }
}
```

La forma exacta debe confirmarse. La invariancia “máximo un activo por canal”
también debe validarse en backend; hoy el formulario administrativo hace una
validación cliente que puede omitirse o trabajar sobre una página incompleta.

### Corrección frontend posterior al contrato

- renderizar únicamente `contract.documentUuid` en el paso contractual;
- mantener reglas/instrucciones en una sección distinta, sin llamarlas
  contratos;
- eliminar el fallback a firma nativa;
- si faltan o sobran contratos, bloquear firma y mostrar un error de
  configuración al PM;
- comprobar que el documento y el provider pertenecen al mismo objeto.

## 9. Punto 6 — Fotografías de documentos

### Ubicación actual

Ya están contempladas en:

```text
Dashboard → Reservas → Detalle de reserva → Documentos de Huéspedes
```

`OperationsPanel` monta `GuestDocumentsCard`. La tarjeta obtiene:

```http
GET /checkin/{reservationUuid}
GET /reservations/{reservationUuid}/guests
```

Y espera:

```json
{
  "reservationSpecificData": {
    "documentImages": {
      "front": "https://...authenticated-url...",
      "back": "https://...authenticated-url..."
    }
  }
}
```

Las imágenes se descargan con bearer token mediante `AuthenticatedImage`.

### Qué significa la captura

“Documentos no subidos aún” significa únicamente que `documentImage1` y
`documentImage2` quedaron `null` después de normalizar la respuesta. Sin el
payload de esa reserva no se puede concluir si:

- nunca se cargaron;
- Didit conserva los archivos pero backend no los sincroniza;
- el endpoint `/guests` no expone las URLs;
- las URLs vienen bajo otra clave.

Para `document_upload` de acompañantes sí existe upload multipart local. Para
el flujo principal Didit, este frontend no descarga automáticamente las fotos
del proveedor.

### Hallazgo de seguridad

`reservations-service.ts` imprime en consola respuestas crudas del portal y de
`/guests`, incluyendo potencialmente nombres, documentos y rutas. Esos logs
deben eliminarse antes de producción.

La selfie tampoco se expone en la tarjeta; solo frente y reverso. Cualquier
acceso a selfie necesita decisión de privacidad, autorización y endpoint
explícito.

## 10. Punto 7 — Saber quién completó el registro

### Disponible hoy

Por cada huésped:

- `uuid`;
- nombre y apellido;
- `isMain`;
- `isCompleted`;
- estado de verificación;
- `verifiedAt` en el portal cuando backend lo envía.

La tarjeta del dashboard muestra nombre, principal/secundario y
pendiente/verificado.

### Faltante

No existe en el tipo ni se renderiza:

- `checkinCompletedAt`;
- quién hizo materialmente el envío;
- canal del link/invitación;
- contacto enmascarado al que se envió;
- proveedor de verificación;
- eventos de reintento;
- aceptación/firma asociada al huésped.

La bitácora visible solo presenta “Reserva creada”. Para una auditoría real,
backend debe exponer eventos o ampliar `GET /reservations/{uuid}/guests`; el
frontend no debe fabricar esos datos.

## 11. Prioridad recomendada

1. **P0 — Seguridad:** sustituir `verified_ok` recurrente por un desafío de
   posesión y dejar de devolver contacto completo antes de confirmarlo.
2. **P0 — Integridad legal:** selección autoritativa de un solo contrato por
   canal; eliminar fallback de firma.
3. **P1 — Invitaciones:** tokens reales por acompañante y autorización del
   titular.
4. **P1 — Documentos:** confirmar payload real de `/guests`, sincronización
   Didit y retirar logs de PII.
5. **P1 — Despliegue:** revisar/commit/deploy del CTA grande y compartir,
   después de resolver tokenización.
6. **P2 — Auditoría:** completar datos de quién/cuándo/cómo registró.

## 12. Casos de aceptación mínimos

### Huésped recurrente

- Con documento conocido, nunca entra directamente al formulario.
- Solo ve un destino enmascarado.
- Código incorrecto, vencido o con demasiados intentos no permite avanzar.
- Confirmación correcta no devuelve email ni teléfono completos.
- `complete` conserva contacto histórico si esos campos se omiten.

### Contrato

- Reserva Directa recibe exactamente el contrato activo de Directa.
- El paso contiene un solo contrato y un solo provider.
- TuFirma nunca muestra canvas nativo.
- Firma nativa nunca muestra instrucción TuFirma.
- Cero o más de un contrato aplicable bloquea la firma y genera alerta de
  configuración.

### Acompañantes

- Cada acompañante recibe un token diferente.
- El token no permite ver otros huéspedes.
- Token vencido/revocado no permite identificar ni completar.
- El titular puede reenviar y ver estado de entrega/uso sin ver PII completa.

### Documentos y auditoría

- Frente/reverso aparecen con sesión PM autorizada.
- Sin URLs, la UI diferencia “no capturado” de “capturado en proveedor externo”.
- Ningún payload con PII se escribe en consola.
- El dashboard muestra huésped, rol, fecha de finalización y proveedor.

## 13. Implementación frontend realizada

Esta sección registra los cambios posteriores a la auditoría. No convierte los
bloqueos backend en contratos existentes.

### Corregido en frontend

- El CTA principal de registro es grande, fijo y visible mientras exista una
  acción válida.
- Compartir/copy usa la URL canónica del portal, sin propagar query params, y
  solo se habilita después de que backend marque al huésped principal como
  completado.
- Ninguna pantalla usa
  `checkin-verification-done-*` de `localStorage` como prueba de identidad. La
  reentrada y el salto del upload dependen del estado que devuelve backend.
- Los formularios principal y secundario solo muestran, conservan y envían
  email/teléfono cuando `/form/{guestUuid}` declara esos campos en su schema.
  Esto permite que backend los omita para un huésped recurrente.
- El paso legal resuelve exactamente un contrato:
  - prioriza `contract.documentUuid`/`document_uuid`;
  - para respuestas legacy solo acepta exactamente un documento identificado
    como contrato;
  - valida que el provider del documento y el de `contract` no se contradigan;
  - elimina el fallback a firma nativa;
  - bloquea la firma ante cero, múltiples o configuraciones incoherentes.
- El dashboard elimina logs crudos de huéspedes/documentos, muestra
  `verifiedAt` cuando está disponible y mantiene la distinción entre verificado
  sin imágenes locales y documentos aún no subidos.
- Las imágenes autenticadas ya no usan el token global de aplicación. Solo
  envían el bearer de la sesión PM al mismo origen de la API, evitando filtrar
  credenciales a URLs externas.

### Continúa bloqueado por contrato backend

- OTP de posesión para huésped recurrente: no existen directiva, challenge,
  confirmación, reenvío, expiración ni rate limit consumibles por frontend.
- Ocultamiento completo de contacto: el frontend ya no lo guarda ni muestra
  cuando el schema lo omite, pero backend también debe dejar de incluir PII
  completa en `prefilledData`.
- Invitaciones individuales: compartir todavía usa el portal general porque no
  existe un endpoint que emita tokens opacos, revocables y limitados a un
  acompañante.
- Selección por canal: frontend soporta la selección autoritativa, pero backend
  debe enviar `contract.documentUuid` junto con el provider resuelto para la
  fuente de la reserva.
- Fotografías Didit y auditoría de finalización: hacen falta sincronización/URLs
  y campos como `checkinCompletedAt`, provider y canal de invitación.

### Validación ejecutada

- `npx tsc --noEmit`: aprobado.
- `npm run build`: aprobado con Next.js 16.1.6.
- ESLint del componente contractual y sus tipos: aprobado.
- El lint focalizado de las pantallas históricas de identificación/formulario
  sigue reportando deuda previa (`any`, dependencias de hooks y efectos
  sincrónicos). No se mezcló una refactorización amplia de esos flujos con este
  conjunto de correcciones funcionales.

## 14. Corrección de la card y recuperación de finalización

La revisión posterior confirmó que la card reemplazaba el estado de identidad
por `pending` siempre que el check-in todavía no estuviera completo. También
mezclaba identidad verificada y check-in finalizado en un solo badge.

Cambios aplicados:

- se conserva y normaliza `verification.status` del portal o del endpoint de
  huéspedes;
- se muestran por separado `Identidad verificada` y `Check-in completo`;
- los estados en proceso, revisión e incidencia mantienen etiquetas distintas;
- una identidad aprobada sin URLs ya no se presenta como “documentos no
  subidos”, sino como “imágenes no disponibles”;
- la card tiene actualización manual y vuelve a consultar cuando la pestaña
  recupera visibilidad;
- `contract.status=completed` ya no produce por sí solo una pantalla de éxito:
  el redirect exige `registeredGuest.isCompleted=true`;
- si `/main/sign` tuvo éxito y `/main/complete` falló, el formulario guardado se
  reutiliza para reintentar únicamente la finalización, sin reemplazar la firma.

La disponibilidad material de frente/reverso continúa dependiendo de que
`GET /reservations/{reservationUuid}/guests` entregue URLs autorizadas en
`reservationSpecificData.documentImages`.
