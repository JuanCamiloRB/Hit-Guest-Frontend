# AWS Textract para OCR de Documentos — Hit Guest Backend

## 🎯 Recomendación: Amazon Textract (no Rekognition)

| Servicio AWS | Para qué sirve | ¿Usar en Hit Guest? |
|--------------|----------------|---------------------|
| **Amazon Textract** | OCR inteligente + análisis de documentos estructurados | ✅ **SÍ** — Extrae texto y campos clave de cédulas/pasaportes |
| **Amazon Rekognition** | Reconocimiento facial, objetos, escenas en imágenes | ❌ NO — No es OCR de documentos |

### ¿Por qué Textract y no solo "OCR genérico"?

Textract tiene un feature específico: **Analyze ID**
- Detecta automáticamente si es pasaporte, cédula, licencia
- Extrae campos estructurados: `FIRST_NAME`, `LAST_NAME`, `DATE_OF_BIRTH`, `DOCUMENT_NUMBER`, `EXPIRATION_DATE`, etc.
- No necesitas parsear el texto crudo — viene ya estructurado

---

## 🔧 Qué necesita el Backend (Laravel)

### 1. Dependencias

```bash
# AWS SDK para PHP (oficial)
composer require aws/aws-sdk-php

# Opcional: Laravel wrapper para AWS
composer require aws/aws-sdk-php-laravel
```

### 2. Configuración AWS (.env)

```env
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
AWS_BUCKET=hitguest-documents
AWS_TEXTRACT_ANALYZE_ID=true
```

### 3. Flujo de procesamiento OCR

```
1. Huésped sube foto de documento (frontend)
      ↓
2. Backend recibe imagen en Base64 o URL temporal
      ↓
3. Backend sube imagen a S3 (bucket temporal)
      ↓
4. Backend llama AWS Textract: AnalyzeDocument o AnalyzeID
      ↓
5. Textract devuelve JSON con campos estructurados
      ↓
6. Backend mapea campos extraídos → campos del formulario
      ↓
7. Backend elimina imagen de S3 (solo si es temporal/privada)
      ↓
8. Backend retorna datos estructurados al frontend
```

---

## 📡 Payload de ejemplo: Analyze ID (para documentos de identidad)

### Request (PHP/Laravel)

```php
use Aws\Textract\TextractClient;

$client = new TextractClient([
    'region' => env('AWS_REGION'),
    'version' => 'latest',
    'credentials' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
    ]
]);

$result = $client->analyzeID([
    'DocumentPages' => [
        [
            'S3Object' => [
                'Bucket' => 'hitguest-documents',
                'Name' => 'uploads/passport-alejandro.jpg'
            ]
        ]
    ]
]);
```

### Response (campos extraídos automáticamente)

```json
{
  "IdentityDocuments": [
    {
      "DocumentIndex": 1,
      "IdentityDocumentFields": [
        {
          "Type": {"Text": "FIRST_NAME"},
          "ValueDetection": {"Text": "ALEJANDRO", "Confidence": 99.8}
        },
        {
          "Type": {"Text": "LAST_NAME"},
          "ValueDetection": {"Text": "APOLO", "Confidence": 99.7}
        },
        {
          "Type": {"Text": "DATE_OF_BIRTH"},
          "ValueDetection": {"Text": "1983-06-02", "Confidence": 98.5}
        },
        {
          "Type": {"Text": "DOCUMENT_NUMBER"},
          "ValueDetection": {"Text": "B0947794", "Confidence": 99.9}
        },
        {
          "Type": {"Text": "EXPIRATION_DATE"},
          "ValueDetection": {"Text": "2028-06-15", "Confidence": 97.2}
        },
        {
          "Type": {"Text": "NATIONALITY"},
          "ValueDetection": {"Text": "ECU", "Confidence": 96.5}
        }
      ]
    }
  ]
}
```

### Mapeo automático a campos del formulario Hit Guest

| Campo Textract | Campo Hit Guest (DB) | Tabla |
|----------------|---------------------|-------|
| `FIRST_NAME` | `name` | `guests` |
| `LAST_NAME` | `lastname` | `guests` |
| `DATE_OF_BIRTH` | `date_of_birth` | `guests` |
| `DOCUMENT_NUMBER` | `identificacion_number` | `guests` |
| `NATIONALITY` | `nationality_id` (mapear código EC → país) | `guests` |
| `EXPIRATION_DATE` | `extra.document_expiration` | `reservation_guests` |

---

## 🏗️ Endpoints que necesita el backend

### POST /api/ocr/analyze-document

**Propósito:** Recibe imagen de documento, procesa con Textract, retorna campos extraídos

**Request:**
```json
{
  "imageBase64": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ...",
  "documentType": "passport" // opcional: "cc", "ce", "passport"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "firstName": "ALEJANDRO",
    "lastName": "APOLO",
    "dateOfBirth": "1983-06-02",
    "documentNumber": "B0947794",
    "nationality": "EC",
    "expirationDate": "2028-06-15",
    "confidence": 98.5
  }
}
```

**Flujo interno:**
1. Decodificar Base64 → archivo temporal
2. Subir a S3 bucket privado
3. Llamar Textract `analyzeID()`
4. Mapear respuesta a campos estandarizados
5. Eliminar archivo de S3 (o mover a storage permanente según política)
6. Retornar datos estructurados

---

## 💰 Costos AWS Textract

| Feature | Precio (aprox.) | Uso en Hit Guest |
|---------|-----------------|------------------|
| **Analyze ID** (documentos de identidad) | $0.025 por documento | ✅ Principal — pasaportes, cédulas |
| Detect Document Text (OCR básico) | $0.0015 por página | ❌ No necesario con Analyze ID |
| Analyze Document (forms/tables) | $0.015 por página | ⚠️ Solo si se necesita extraer de contratos |

**Estimación mensual:**
- 1,000 check-ins × $0.025 = **$25 USD/mes**
- 5,000 check-ins × $0.025 = **$125 USD/mes**

---

## 🔐 Seguridad y Privacidad

1. **Bucket S3 privado** — sin acceso público
2. **URL pre-firmadas** — tiempo de expiración corto (5 min)
3. **Eliminación automática** — borrar imagen después del OCR
4. **Cifrado en reposo** — AWS KMS por defecto
5. **No almacenar** las imágenes de documentos más tiempo del necesario (cumplimiento ley de protección de datos)

---

## 📋 Resumen: Qué le pides al backend developer

1. ✅ Instalar AWS SDK PHP
2. ✅ Configurar credenciales AWS y bucket S3
3. ✅ Crear endpoint `POST /api/ocr/analyze-document`
4. ✅ Implementar llamada a Textract `analyzeID()`
5. ✅ Mapear respuesta de Textract a formato Hit Guest
6. ✅ Implementar eliminación automática de imágenes temporales
7. ✅ Documentar límites de tamaño (max 10MB por imagen, formatos: JPEG, PNG, PDF)
8. ✅ Manejar errores (documento borroso, no detectado, timeout)

---

## 🚫 Alternativas descartadas

| Alternativa | ¿Por qué no? |
|-------------|--------------|
| **Google Vision API** | Similar funcionalidad, pero costo mayor para documentos de identidad específicos |
| **Azure Form Recognizer** | Muy bueno, pero AWS Textract tiene mejor precio para volumen medio |
| **OCR local (Tesseract)** | No tiene "Analyze ID" inteligente — requeriría entrenar modelo personalizado |
| **Amazon Rekognition** | Es para faces/imágenes, no OCR de documentos estructurados |

---

## ✅ Recomendación final

**Amazon Textract con Analyze ID** es la mejor opción para Hit Guest porque:

1. ✅ Diseñado específicamente para documentos de identidad (pasaportes, cédulas)
2. ✅ Extrae campos estructurados sin necesidad de regex o parsing manual
3. ✅ Precio competitivo ($0.025 por documento)
4. ✅ Integración directa con AWS SDK para Laravel
5. ✅ No requiere entrenar modelos ni machine learning propio
6. ✅ Soporta múltiples idiomas y formatos de documentos latinoamericanos
