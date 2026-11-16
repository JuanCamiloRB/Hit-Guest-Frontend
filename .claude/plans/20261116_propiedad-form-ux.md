# Rediseño del formulario de propiedad («Nueva / Editar propiedad») — plan v3 (2026-11-16)

Estado: **plan v3 + prototipo v3, sin código**. Prototipo: canvas «Propiedad — rediseño»
(claude.ai/artifact/7zv415cufi51HYgTwxp286). v2 incorporó la primera revisión externa del
2026-11-16 (tres bloqueos verificados en código, §0b y §8); v3, la segunda (barra según
`isDirty`, teléfonos solo `Input type="tel"`, estados reales de la carga de fotos, geometría
propia de la barra). **Fase 0 aprobada por la revisión; fases 1–6 condicionadas a esta v3.**

Restricción (la misma del formulario de reserva): **ni quitar ni agregar campos**; sin
endpoints nuevos ni cambios de backend. `formDataToApiPayload`, `toListingPayload` y las
llamadas a `POST/PUT /properties`, `POST/PUT /listings`, overrides e imágenes quedan
idénticos. Lo que cambia es cómo se piden y se muestran los datos.

Archivos: `PropertyForm.tsx`, `PropertiesUnits.tsx` (diálogo de alojamiento),
`PropertiesLocation.tsx` (+ `MapComponent`, `AddressAutocomplete`), `PropertiesAmenities.tsx`,
`ExternalPmsIdsField.tsx`, `PropertiesPhotos.tsx`, en `src/features/properties/components/`.
Inventario completo de campos, payloads y comportamientos: ver el informe del 2026-11-16 (abajo, §0).

## 0. Paridad de campos (nada entra, nada sale)

**Propiedad** (zod en `types/index.ts:248-309`): `name*`, `email*`, `phone`, `propertyTypeId*`,
`statusRecordId*`, `thumbnailUrl`, `communicationsLocale`, `description`, `externalPmsIds[]`
(`sourcePmsId*`, `externalId*`, `id` oculto), `amenities[]`, `address*`, `addressDetail`,
`state*`, `city*`, `countryId*`, `timezone`, `latitude`, `longitude`, `picturesUrl`.
Campos sin interfaz que viajan y se conservan tal cual: `checkIn`, `checkOut`,
`cancellationPolicy`, `wifiNetwork/wifiPassword`, `policies`, `roomTypes`; `extra.currency`
fijo en código.

**Alojamiento** (`lib/unit-form-validation.ts`, `lib/listing-payload.ts`): `isActive`,
`name*`, `internalName`, `externalPmsIds[]`, `roomTypeId*`, `extra.maxOccupancy`,
`extra.currency`, `price`, `contactName`, `contactPhone`, `contactEmail*`,
`extra.inheritSchedule/checkIn/checkOut`, `extra.inheritWifi/wifiDetails`,
`extra.inheritAmenities/amenities`, `extra.bedRoom`, `extra.bathRoom`,
`extra.inheritPolicies/cancellationPolicy`, `listingOverrides` (solo al editar). Ocultos que
viajan: `thumbnailUrl`, `description`, `extra.rooms`, `minNights`, `maxNights`, `picturesUrl`.

Lo que cambia de control sin cambiar la clave: país y zona horaria → `Combobox`;
capacidad, camas y baños → `NumberStepper`; precio + moneda → `MoneyField`; coordenadas →
dato de solo lectura con «Ajustar a mano». **Teléfonos (`phone`, `contactPhone`): siguen
siendo `Input` de texto libre.** `PhoneInputField` NO se usa aquí: quita lo que no sea
dígito y antepone el prefijo, y al vaciarse emite «+57» (`phone-input-field.tsx:79-82`);
eso cambiaría el valor guardado. Endurecerla (conservar el valor hasta que se edite,
emitir «» al vaciar, fallo del catálogo de prefijos) es una tarea aparte (§8.5).

### 0b. Tres reglas que la v1 no decía (bloqueos de la revisión, verificados)

1. **Portada predeterminada visible.** `thumbnailUrl` nace con una URL de Unsplash y se
   envía (`PropertyForm.tsx:146`; alojamiento `PropertiesUnits.tsx:100`). No se esconde como
   placeholder: se muestra como «Portada predeterminada» con vista previa y el texto «Se usa
   hasta que subas una foto», y el campo URL con su valor real. Dejar de enviarla es una
   decisión funcional aparte (no entra aquí).
2. **Fotos también se guardan con el submit.** Subir o borrar llama a la API al instante,
   pero `syncGallery` deja `picturesUrl` y `thumbnailUrl` sucios y la portada solo se
   persiste con «Guardar cambios» (`PropertiesPhotos.tsx:66-69, 229-231`). La barra de
   acciones aparece en Fotos siempre que esos campos estén sucios, y la pestaña lo avisa:
   «Portada sin guardar».
3. **«Eliminar propiedad» va en una zona de peligro** al final de Detalles (solo al editar),
   con `AlertDialog` (hoy es `Dialog`, `PropertyForm.tsx:658`). Nunca en la barra fija junto a
   la acción principal.

## 1. Diagnóstico (del inventario, con evidencia)

| # | Problema | Evidencia |
|---|---|---|
| D1 | Asteriscos que no coinciden con la regla: Categoría obligatoria sin asterisco; país y estado sin mensaje propio (sale el de zod en inglés); lat/lng sin mensaje | `PropertiesUnits.tsx:793` vs `unit-form-validation.ts:112`; `types/index.ts:258,262`; `PropertiesLocation.tsx:350-385` |
| D2 | Title Case en etiquetas, botones y pestañas | «Nombre de la Propiedad», «Añadir Unidad», «Crear Propiedad»… |
| D3 | «Unidad» y «Alojamiento» mezclados para lo mismo | pestaña «Alojamientos», botón «Añadir Unidad», vacío «Aún no hay unidades» |
| D4 | Selects que se encogen al contenido | `selectTriggerClasses` `w-fit`; `PropertyForm.tsx:474,508,552`, `PropertiesUnits.tsx:799,841` |
| D5 | Primitivas pisadas desde la pantalla (`h-11`, `h-8 text-xs`, `FormLabel font-semibold`, `SelectLabel text-primary`) | `PropertiesLocation.tsx:161…385`, `PropertiesUnits.tsx:955-1189` |
| D6 | Controles a mano: zona horaria (Input dentro de SelectContent), avisos `bg-primary/5`, caja de coordenadas, zona de carga `div onClick` | `PropertiesLocation.tsx:296-347`, `PropertiesUnits.tsx:1169,1208`, `PropertiesPhotos.tsx:177` |
| D7 | Diálogo de alojamiento armado a mano como panel cuando ya existe `layout="panel"` | `PropertiesUnits.tsx:656-691,1351` |
| D8 | Rejilla de amenidades hecha dos veces con aspecto distinto | `PropertiesAmenities.tsx:73`, `PropertiesUnits.tsx:1069` |
| D9 | Sin acción fija: «Crear propiedad» al final de la página y repetido en pestañas que se guardan solas | `PropertyForm.tsx:656-688` |
| D10 | Contenido enterrado: formulario → pestaña → diálogo → 5 pestañas (con «Autom.» abreviado) → modal | `PropertiesUnits.tsx` |
| D11 | Política por defecto `STANDARD` no está entre las opciones: el Select se ve vacío | `PropertiesUnits.tsx:120` vs `1193-1196` |
| D12 | Placeholders con datos fijos («Hotel Oasis», «ejemplo@kunas.co», «250000») y portada por defecto de Unsplash que SE ENVÍA | `PropertyForm.tsx:146`, `PropertiesUnits.tsx:100` |
| D13 | Botón de editar de la tabla sin nombre accesible | `PropertiesUnits.tsx:1458` |
| D14 | «Información faltante» es un diálogo; en reserva es un aviso + foco | `PropertyForm.tsx:183-236,731-739` |
| D15 | `/new?tab=automations` acepta una pestaña que no existe al crear y queda vacío | `PropertyForm.tsx:99-105` |

## 2. Arquitectura UX

Misma página, mismas pestañas (`details, units, automations, documents, location, photos`),
mismas claves. Cambia la composición:

1. **Encabezado fijo** con `PageHeader`: título («Nueva propiedad» / el nombre al editar),
   descripción y las pestañas debajo. Al editar, el estado como `StatusPill`.
2. **Pestañas en el orden del trabajo** (aprobado): Detalles · Ubicación · Alojamientos ·
   Fotos; al editar, después Automatización · Documentos. Cambia solo el orden visual, no
   las claves ni los `?tab=`. Cada pestaña con errores lleva un contador accesible
   (`aria-label="Ubicación, 2 errores"`) **calculado desde el schema**: en Ubicación cuentan
   dirección, ciudad, estado y país; zona horaria y coordenadas son opcionales y no marcan.
3. **Detalles**: «Datos de la propiedad» (nombre; correo | teléfono como `Input type="tel"`,
   el mismo string de hoy, sin tocar;
   tipo | estado; idioma de comunicaciones | URL de portada; descripción), «Identificación
   externa» (`EmptyState` punteado con «Vincular origen» → filas Origen | ID con papelera) y
   «Amenidades» (rejilla de casillas-tarjeta, una sola primitiva).
4. **Ubicación**: dirección con buscador (igual, es BFF), línea 2 | estado, ciudad | país
   (`Combobox`) | zona horaria (`Combobox`, con el mismo autollenado), el mapa dentro de un
   `MapField` (alto 360–420 px en escritorio, 280–320 en móvil) con el aviso «sin ubicación»
   como `FeedbackBanner` y las coordenadas como dato de solo lectura sobre `Surface sunk`
   (morado solo en «Ajustar a mano», foco y acciones). «Ajustar a mano» abre
   `latitude/longitude` como campos: mismas claves.
5. **Alojamientos**: tabla con nombre, interno, categoría, capacidad, precio **con moneda**,
   estado (`StatusPill`) y acciones con nombre («Editar Suite 101»). Botón «Nuevo
   alojamiento». Vacío con `EmptyState` y acción.
6. **Diálogo de alojamiento** = `DialogContent layout="panel"`: encabezado fijo con el
   nombre y el interruptor «Alojamiento activo»; `Tabs size="sm"` General · Operación ·
   Distribución · Políticas · Automatizaciones (nombre completo); cuerpo con scroll; pie fijo
   con «Cancelar» y «Guardar alojamiento». General: nombre | interno; categoría* | capacidad
   (`NumberStepper`); precio por noche (`MoneyField`); contacto (nombre | teléfono
   `Input type="tel"`, mismo string; correo*); identificación externa al final, plegada
   (`Disclosure`).
   Operación/Políticas: cada bloque «Heredar de la propiedad» como `SwitchField` que abre su
   contenido debajo. Distribución: habitaciones y baños con `NumberStepper`.
7. **Fotos**: zona de carga como primitiva (`UploadZone`, botón real + `FileInput`), rejilla
   de fotos con «Portada» como `Badge` y acciones con nombre; borrar con `AlertDialog`
   (igual que hoy).
8. **Acción fija** (`FormActionBar`), con la visibilidad decidida por `formState.isDirty`
   del formulario raíz, no por la pestaña:
   - **Nueva propiedad**: visible en todas las pestañas disponibles.
   - **Edición**: visible siempre que el formulario raíz esté sucio, en cualquier pestaña
     (también Automatización y Documentos, que se guardan solas: si el PM cambió el correo en
     Detalles y abrió Automatización, la barra dice «Cambios sin guardar» y conserva «Guardar
     cambios»). En Automatización y Documentos se oculta solo cuando NO hay cambios pendientes.
   - Fotos cuenta: subir o borrar deja `picturesUrl`/`thumbnailUrl` sucios (§0b.2).
   - Texto: «* Campos obligatorios» (crear) o «Cambios sin guardar» (editar, sucio) · Cancelar
     · «Crear propiedad» / «Guardar cambios».
   En móvil quedan fijos solo el selector de pestañas y la barra inferior; el encabezado se
   desplaza con el contenido.
9. **Errores**: igual que en reserva: aviso arriba «Faltan N campos en Detalles y
   Ubicación» con enlaces a la pestaña, salto a la pestaña del primero y foco. Reemplaza al
   diálogo «Información faltante» (D14) conservando `FIELD_META` y el salto.

### 2b. Navegación e interacción (fijado)

- Las pestañas conservan ancho suficiente y tienen scroll horizontal en móvil; la activa
  queda visible tras el cambio.
- El contador de errores de una pestaña es número + texto accesible («Ubicación, 2
  errores»), nunca solo un punto.
- El resumen de errores usa botones que activan la pestaña, esperan su render y luego
  enfocan el campo. Cambiar de pestaña no borra valores ni errores (todas las pestañas
  viven en el mismo formulario; solo cambia lo visible).
- `CheckboxCard` sigue el patrón de `CheckboxField`: `id` + `Label htmlFor`, sin envolver el
  botón Radix. Prueba obligatoria: un clic, un cambio.
- «Ajustar a mano» revela los mismos `latitude`/`longitude`; no crea campos.
- El estado del encabezado al editar (`StatusPill`) solo representa el campo Estado; el
  control sigue siendo el `Select` de Detalles.

## 3. Dirección visual

La de reserva (`20261116_reserva-manual-ux.md` §3): neutro para estructurar, morado para
actuar, semánticos para informar. Fijado para esta pantalla:
- `primary` para acción principal, selección, enlaces y foco; `primary/5` hover o selección
  suave; `primary/10` solo en lo seleccionado; `primary/30` bordes de selección. ~5 % de la
  superficie: acción, pestaña activa, foco y selección.
- Campos con `--input`; `card` sobre fondo neutro; `sunk` para coordenadas, contenido
  heredado y zonas secundarias; rojo, ámbar, verde y azul solo para estados.
- Una `SectionCard` por bloque real (Datos, Identificación externa, Amenidades, Ubicación,
  Alojamientos, Fotos), no una por cada grupo pequeño. Sin íconos morados en títulos ni
  pestañas; sin gradientes, líneas laterales ni sombras fuertes.
- Títulos Gabarito; etiquetas y cuerpo Poppins. 32 px entre secciones, 16 px entre campos
  relacionados. Ayudas 12 px en `ink-3`; contenido principal nunca por debajo de 14 px.
- Mapa 360–420 px en escritorio, 280–320 en móvil. Coordenadas neutras; «Ajustar a mano»
  es el único acento. Portada predeterminada visible como dato real.

## 4. Primitivas

| Necesidad | Hoy | Plan |
|---|---|---|
| Casilla-tarjeta en rejilla (amenidades, propiedad y alojamiento) | dos copias a mano | **crear** `CheckboxCard`: TODA la tarjeta es una sola `Label htmlFor` operable sobre un `Checkbox`; `selected` borde `primary/30` + fondo `primary/5`. Prueba: pulsar el texto cambia UNA vez (precedente: `CheckboxField`) |
| Zona de carga | `div onClick` | **crear** `UploadZone`: `Button` y `FileInput` HERMANOS vinculados (nunca un input dentro de un botón), `Surface dashed`; estados reposo, arrastrando (`dragover`), subiendo («Subiendo 5 fotos…» con indicador indeterminado: las fotos van en UNA petición por lote y el front no sabe cuántas llevan; nunca un «N de M» inventado), éxito («5 fotos subidas»), formatos rechazados, error con «Reintentar» conservando los archivos elegidos; teclado (Enter/Espacio abren el selector) |
| Barra de acciones fija del panel | botón al final de la página | **crear** `FormActionBar`: comparte con `BottomBar` los TOKENS y estilos (vidrio `bg-white/80 backdrop-blur`, divisor `border-rule/50`, `pb` seguro; extraídos a una constante en `bottom-bar.tsx`), pero NO su geometría: `BottomBar` es `fixed inset-x-0` del portal y aquí taparía el sidebar. `FormActionBar` va `sticky bottom-0` DENTRO del `<main>`, al ancho de `Page`, con `z` por encima del contenido y no de la navegación; el formulario reserva espacio inferior (`pb`) para que nunca tape un campo; safe area en móvil |
| Campo de mapa | `MapComponent` + caja a mano | composición en la feature (`MapField`): `Surface` + `FeedbackBanner` + `ReadOnlyField`; no es primitiva global |
| Campo de hora | `type=time` nativo | se queda (`Input type="time"` es la primitiva); sin primitiva nueva |
| Fila «heredar + contenido» | `SwitchField` + caja a mano | `SwitchField variant="boxed"` + el contenido debajo; sin primitiva nueva |
| Existentes | — | `Combobox`, `NumberStepper`, `MoneyField`, `Input type="tel"` (teléfonos: NUNCA `PhoneInputField`), `Dialog layout="panel"`, `SectionCard`, `EmptyState`, `Disclosure`, `StatusPill`, `Badge`, `ReadOnlyField`, `Table`, `AlertDialog` |

## 5. Fases

0. **Contrato**: pruebas que congelan `formDataToApiPayload` y `toListingPayload` (crear y
   editar), la secuencia post-creación (unidades en borrador → `POST /listings`; los overrides
   solo existen al agregar un alojamiento a una propiedad existente),
   `externalPmsIds` solo si cambió, la portada vs `picturesUrl[0]`.
1. **Correcciones sin rediseño**: D1, D2, D3, D11, D13, D15; mensajes propios para país y
   estado; `FormMessage` en coordenadas; **catálogos críticos (tipo, estado, país, zonas
   horarias, categorías, monedas) con error visible y «Reintentar» junto al campo**
   (`CatalogError` de reservas); «Eliminar propiedad» en zona de peligro con `AlertDialog`.
2. **Primitivas**: `CheckboxCard`, `UploadZone`, `FormActionBar` (+ pruebas, docs §5, skill,
   plugin de Figma).
3. **Estructura**: `FormActionBar`, orden de pestañas, errores como aviso + salto (D9, D14);
   diálogo de alojamiento en `layout="panel"` con `Tabs size="sm"` (D7, D10).
4. **Campos**: `Combobox` (país, zona horaria), `NumberStepper`, `MoneyField`,
   teléfonos como `Input type="tel"` (sin `PhoneInputField`), `MapField`, `CheckboxCard` en
   las dos rejillas, `UploadZone` (D4–D8).
5. **Móvil y estados**: pestañas con scroll horizontal, diálogo a pantalla completa, barra
   fija segura, catálogos fallidos con «Reintentar» junto al campo (como en reserva).
6. **Regresión**: pruebas de §6 + auditoría independiente.

## 6. Pruebas obligatorias

Payloads de propiedad y alojamiento sin cambios (crear y editar) · transporte POST/PUT ·
borradores de alojamiento antes de que exista la propiedad · alojamiento nuevo → overrides en
borrador (solo con propiedad existente) · redirección a `?tab=units` si falla una unidad · 422 de
ids externos repartido a su fila · desactivar pide confirmación (propiedad y alojamiento) ·
propiedad inactiva: alojamiento nuevo nace inactivo · sugerencia de dirección rellena
estado/ciudad/país/zona y el pin · arrastrar el pin actualiza lat/lng · aviso sin ubicación ·
salto a la pestaña del primer error · doble envío bloqueado · navegación con teclado ·
revisión visual a 375, 768 y 1280.

## 7. Qué NO cambia

Claves y payloads (§0), endpoints, la secuencia post-creación, los candados de doble envío,
la confirmación al desactivar, los borradores de unidades, el BFF de geocodificación, la
sincronización de la galería, los textos de los avisos de ids externos.

## 8. Decisiones (revisión 2026-11-16)

1. **Orden de pestañas**: aprobado Detalles · Ubicación · Alojamientos · Fotos; al editar,
   después Automatización · Documentos.
2. **Portada por defecto**: se conserva por compatibilidad y se muestra como «Portada
   predeterminada» con vista previa (§0b.1). Nunca como placeholder.
3. **Herencia**: no se agregan campos a la propiedad en esta fase. Los controles del
   alojamiento quedan como están; la configuración general va en una fase funcional aparte.
4. **Política `STANDARD`**: aprobado «Estándar» con el mismo valor (representación, no contrato).
5. **`PhoneInputField`**: fuera de este rediseño (§0). Endurecerla es tarea aparte.

## 9. Fase 0 — hecha (2026-11-16, sin commit)

Sin cambios de interfaz ni de contrato. Dos extracciones mecánicas para poder probar
sin montar el formulario (el código movido es idéntico):
- `lib/property-save.ts`: `withExternalIdsGating`, `readCreatedPropertyUuid`,
  `createPropertyWithUnits` (propiedad → alojamientos en secuencia, fallo parcial por
  nombre) y `tabAfterCreate`; `PropertyForm.saveProperty` los llama.
- `lib/property-defaults.ts`: las portadas predeterminadas de propiedad y alojamiento y
  la política `STANDARD`, que viajan aunque el PM no las toque.

Pruebas que congelan el contrato: `types/property-form-contract.test.ts` (forma exacta
del payload, teléfono con formato arbitrario sin normalizar, vacío → `null`, portada ↔
`picturesUrl[0]` sin duplicar, `externalPmsIds` omitido vs `[]`, zona horaria omitida,
coordenadas como texto, campos sin interfaz, `currency` COP fija, `units` y
`automationSettings` no viajan); `lib/listing-payload.contract.test.ts` (borrador del
alojamiento, heredados omitidos o incluidos por interruptor, `STANDARD` intacto, precio
vacío/0/texto, moneda, `externalPmsIds`, y lo que `listingsService` pone en la red con sus
alias snake_case y `price`/`start_price`); `lib/property-save.test.ts` (orden, gating,
fallo parcial → `?tab=units`, sin uuid no se crea nada); `lib/property-defaults.test.ts`.
Mutaciones comprobadas: 8 de 8 detectadas.

**Overrides en borrador (cierre del alcance, segunda revisión):** al CREAR una propiedad
no existen overrides en borrador. La pestaña «Automatizaciones» del diálogo de alojamiento
y la carga de las automatizaciones de la propiedad existen solo con `propertyUuid`
(`PropertiesUnits.tsx:286-300, 719, 1207`), así que la secuencia «borradores → POST
/listings → overrides» NO aplica a la creación de la propiedad: §0 y §6 se corrigen a
«propiedad → alojamientos». La cadena sí existe al AGREGAR un alojamiento a una propiedad
existente: `createListingWithOverrideDrafts` en `lib/property-save.ts` (POST del
alojamiento → aviso de creado → overrides en secuencia, fallo parcial por nombre), fijada
en `property-save.test.ts`, incluida la invariante de que `createPropertyWithUnits` no los
recibe ni los llama. Transporte de la propiedad fijado en
`services/properties-service.contract.test.ts` (POST y PUT con el cuerpo del serializador
tal cual).

Fuera de la fase 0, con motivo: el candado de doble envío (`submitLockRef`) vive en el
componente y requiere montar el formulario con mapa y catálogos; la revisión confirmó que
sigue intacto y se cubre en la fase 6 con el formulario ya dividido.

## 11. Fases 1–6 — hechas (2026-11-16, sin commit; auditoría independiente en curso)

Autorizadas con «continuar». Sin campos quitados ni agregados; `formDataToApiPayload` y
`toListingPayload` intactos (sus pruebas de contrato siguen verdes).

- **Primitivas** (`components/ui`, con prueba, fila en docs §5 y en el skill, y en el
  plugin de Figma): `CheckboxCard`, `UploadZone`, `FormActionBar` (+ `bottomBarSurface`
  extraído de `bottom-bar.tsx`). `CatalogError` y `RequiredMark` subieron de
  `reservations/reservation-form/` a `components/shared/` porque ahora los usan dos
  features.
- **`PropertyForm.tsx`**: pestañas Detalles · Ubicación · Alojamientos · Fotos (+
  Automatización · Documentos solo al editar; `?tab=` solo entre las disponibles);
  `FormActionBar` con «* Campos obligatorios» / «Cambios sin guardar» / «Sin cambios
  pendientes» y visible según `isCreate || isDirty || !AUTOSAVE_TABS.has(tab)`; el
  diálogo «Información Faltante» se reemplazó por un `FeedbackBanner` de alerta con
  «Detalles (3) · Ubicación (4)» que salta a la pestaña y enfoca el primer campo
  (`lib/property-form-errors.ts`: `countErrorsByTab`, `PROPERTY_FIELD_META`), contador
  accesible en cada pestaña («Detalles, 3 errores»); catálogos de tipo y estado con
  `CatalogError` + «Reintentar» (cadenas `.then()` por `react-hooks/set-state-in-effect`);
  portada predeterminada visible con vista previa; «Eliminar propiedad» como zona de
  peligro con `AlertDialog keepOpen pending`; etiquetas en caso de oración; teléfono como
  `Input type="tel"`. Las secciones son `SectionCard` sin íconos.
- **`PropertiesUnits.tsx`**: `DialogContent layout="panel"` + `DialogBody` + header/footer
  `divided`; pestañas con nombre completo («Automatizaciones») y scroll horizontal;
  `NumberStepper` (capacidad, habitaciones, baños), `MoneyField` (precio + moneda: los
  mismos dos valores, `FALLBACK_CURRENCIES` conserva la lista fija), `CheckboxCard` en
  amenidades propias, «Estándar» (`DEFAULT_CANCELLATION_POLICY`) como opción, `Note` en
  vez de cajas a mano, `CatalogError` para categorías con `loadRoomTypes`, tabla con
  «Editar {nombre}», `SectionCard` con la acción en el encabezado; copy «unidad» →
  «alojamiento».
- **`PropertiesAmenities.tsx`**: `SectionCard` + `CheckboxCard` + `CatalogError`.
- **`PropertiesPhotos.tsx`**: `SectionCard` + `UploadZone` (estado `error` con
  «Reintentar» sobre el mismo lote; formatos y límites en el `hint`; etiqueta «Portada»
  sobre la primera foto); borrado y `syncGallery` sin cambios.
- **`PropertiesLocation.tsx`** (agente): `Combobox` país y zona horaria, `MapField`,
  coordenadas en `DefinitionItem` con «Ajustar a mano» (`CoordinateInput` permite
  negativos; el `parseFloat(x) || 0` anterior los impedía), aviso sin ubicación.
- **`types/index.ts`**: mensajes «Elige el país» / «Elige el estado».

Pruebas nuevas: `PropertyForm.shell.test.tsx` (11), `PropertiesUnits.dialog.test.tsx` (6),
`PropertiesLocation.test.tsx` (9), más las de las tres primitivas (18). Mutaciones: 11 de
11 detectadas (pestaña fuera del modo, barra siempre, sin salto ni foco, conteo por
pestaña, selector habilitado con catálogo caído, catálogo vacío, `keepOpen`, «Estándar»,
stepper, moneda, reintento de categorías).

**Auditoría independiente (2026-11-17)**: dos regresiones confirmadas y nueve observaciones,
todas aplicadas:
1. `onInvalid` → `goToTabAndFocus` leía el `errors` del render anterior (RHF llama a
   `onInvalid` antes de notificar al proxy): el salto a la pestaña funcionaba, el foco no.
   Ahora recibe los errores de `onInvalid` (`source`). Prueba: envío inválido desde Fotos
   enfoca «Nombre» en Detalles.
2. `type="email"`/`type="url"` sin `noValidate`: la burbuja nativa bloqueaba el envío y el
   aviso nunca corría (una portada sin esquema, válida para zod, no se podía guardar).
   `<form noValidate>`; prueba con `cdn.example/portada.jpg`.
3. `NumberStepper` con `extra.*` que llegue como string → `Number(x) || default`.
4. `UploadZone` filtra por formato: los rechazados se explican con `validatePropertyImages`
   (mismo mensaje de siempre); los válidos sí suben. Fallo de subida: un solo aviso (la zona,
   con el mensaje del backend vía `normalizeApiError`), sin toast duplicado.
5. `PropertiesLocation` usaba su propio `RequiredMark` → el compartido.
6. Jerarquía de títulos: todas las `SectionCard` del formulario en `headingLevel={2}` (como
   las `Card` anteriores).
7. Mensajes sin campo en pantalla (`units`, `picturesUrl`, `amenities`, `uuid`): el aviso los
   lista («Fotos: …») con `orphanErrorMessages`.
8. `CatalogError retrying` nunca era `true` en amenidades y categorías (el aviso se
   desmontaba al reintentar): estado `failed` persistente; prueba «Reintentando…».
9. «Ajustar a mano» con el panel forzado por un error: deshabilitado y con etiqueta
   «Ocultar coordenadas» cuando está abierto.
10. Portada con URL rota: el `<img>` se oculta (`onError`) en vez del glifo roto.
11. Fuera de alcance pero en los mismos archivos: trabajo de credenciales en
    `PropertiesUnits.tsx` y `PropertiesAutomation.tsx` → commit por hunks.

Sondeo Playwright a 375/768/1280 (`scratchpad/probe/prop/*.png`): barra y CTA del diálogo
siempre visibles, sin desborde horizontal, aviso de errores con foco en «Nombre».
Preexistente y no tocado: en móvil el avatar del sidebar flota sobre el contenido.

`npm run -s verify` verde (245 archivos, 2168 pruebas), `next build` verde, `design:check`
en 0; mutaciones 13/14: la del punto 1 (volver al `errors` del render) NO la detecta ninguna
prueba porque react-hook-form (`shouldFocusError`) enfoca igual el primer campo registrado
tras el re-render; el arreglo evita depender de ese comportamiento, pero no es observable.
**Segunda revisión (2026-11-17, cinco puntos, todos aplicados):**
1. Diálogo de alojamiento sin estilos a mano: `SwitchField variant="boxed"` para cada bloque
   heredable (horarios, WiFi, amenidades, políticas) con sus campos debajo; sin íconos de
   título, sin `Label text-xs`/`Input h-8`, sin `border-l` ni `Surface` armadas; Check-in y
   Check-out con `Label htmlFor`; Distribución como dos campos planos.
2. Barra al editar: `isCreate || isDirty`, como decía la v3 (se quitó `AUTOSAVE_TABS`); sin
   cambios no hay barra en ninguna pestaña. Prueba corregida.
3. Eliminar propiedad: el diálogo solo se cierra en éxito; con fallo sigue abierto y la acción
   se reactiva (prueba con `delete` rechazado y luego resuelto); `onOpenChange` ignora el
   cierre mientras borra.
4. Confirmación destructiva en rojo (`buttonVariants({ variant: "destructive" })`), como fotos
   y alojamientos.
5. `useCatalog.reload` ya no apaga `failed`: países y zonas muestran «Reintentando…» (prueba
   con la promesa retenida).

Cobertura de la fase 6 que faltaba: doble envío (dos `submit` extra con el PUT en vuelo → un
solo PUT; mata la mutación de quitar `submitLockRef`), recorrido por teclado del formulario
(pestañas con flechas, `tabpanel`, campos, barra) y del diálogo (interruptor, pestañas,
campos, Escape), fallo al eliminar con diálogo abierto, barra ausente al editar sin cambios.

Hallazgo nuevo al probar el teclado: un `Dialog`/`AlertDialog` abierto por estado (sin
`Trigger`) dejaba el foco en `<body>` al cerrar (Radix solo lo devuelve al `DialogTrigger`).
Corregido en la primitiva: `useRestoreFocusToOpener` en `ui/dialog.tsx`, usado por
`DialogContent` y `AlertDialogContent`; prueba en `dialog.test.tsx`; beneficia también a
reserva, fotos y alojamientos. Documentado en docs §5 y en el skill.

`verify` verde (245 archivos, 2173 pruebas), `next build` verde, `design:check` 0,
mutaciones de esta ronda 6/6. Capturas del diálogo tras la limpieza en
`scratchpad/probe/prop/dlg-*.png`.

**Pendiente**: auditoría visual con sesión de PM (catálogos reales, edición); commit solo
cuando el usuario lo pida (`PropertiesUnits.tsx` por hunks).

## 10. Orden de arranque

**Fase 0 aprobada por la revisión del 2026-11-16** (no cambia interfaz ni contrato): congelar
payloads de propiedad y alojamiento, borradores, fotos y secuencia post-creación. Las fases
visuales 1–6 quedan condicionadas a esta v3. Arranca con el visto bueno del usuario.
