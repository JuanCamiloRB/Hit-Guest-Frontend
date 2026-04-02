# Configuración de Variables de Entorno

## ⚠️ IMPORTANTE: Configuración Correcta de la API

La URL base de la API **NO debe incluir** `/auth` al final. La configuración correcta es:

```bash
# ✅ CORRECTO
NEXT_PUBLIC_API_URL_GUEST=https://www.kunas.co/api/v1
NEXT_PUBLIC_API_URL_HIT=https://www.kunas.co/api/v1

# ❌ INCORRECTO - Causa duplicación de /auth/auth
NEXT_PUBLIC_API_URL_GUEST=https://www.kunas.co/api/v1/auth
NEXT_PUBLIC_API_URL_HIT=https://www.kunas.co/api/v1/auth
```

## Variables de Entorno Requeridas

### Archivo `.env` o `.env.local`

```bash
# API Configuration
NEXT_PUBLIC_API_URL_GUEST=https://www.kunas.co/api/v1
NEXT_PUBLIC_API_URL_HIT=https://www.kunas.co/api/v1

# App Token
NEXT_PUBLIC_APP_API_TOKEN=fiKyAWOMlaC2ziUhpbDwtkcSgukPLjkIQuyyOBAie7f5c4f8

# Mock Mode (set to true for development without API)
NEXT_PUBLIC_ENABLE_MOCKS=false
```

## Estructura de URLs Generadas

Con la configuración correcta, las URLs se generarán así:

```
Base: https://www.kunas.co/api/v1

Auth Endpoints:
✅ POST https://www.kunas.co/api/v1/auth/login
✅ POST https://www.kunas.co/api/v1/auth/verify-otp
✅ POST https://www.kunas.co/api/v1/auth/resend-otp
✅ POST https://www.kunas.co/api/v1/auth/logout

Account Endpoints:
✅ POST https://www.kunas.co/api/v1/account/register

Properties Endpoints:
✅ POST https://www.kunas.co/api/v1/properties
✅ GET  https://www.kunas.co/api/v1/properties
✅ GET  https://www.kunas.co/api/v1/properties/{uuid}
✅ PUT  https://www.kunas.co/api/v1/properties/{uuid}
✅ DELETE https://www.kunas.co/api/v1/properties/{uuid}
✅ POST https://www.kunas.co/api/v1/properties/{uuid}/restore

Catalogs Endpoints:
✅ GET https://www.kunas.co/api/v1/catalogs
✅ GET https://www.kunas.co/api/v1/catalogs/category/{category}

Countries Endpoints:
✅ GET https://www.kunas.co/api/v1/countries
✅ GET https://www.kunas.co/api/v1/countries/{id}
```

## Problema Común: Duplicación de /auth

Si ves URLs como:
```
❌ https://www.kunas.co/api/v1/auth/auth/login
```

Esto significa que tu variable de entorno está configurada incorrectamente:
```bash
# ❌ INCORRECTO
NEXT_PUBLIC_API_URL_GUEST=https://www.kunas.co/api/v1/auth
```

**Solución:**
```bash
# ✅ CORRECTO
NEXT_PUBLIC_API_URL_GUEST=https://www.kunas.co/api/v1
```

## Verificación

Después de corregir las variables de entorno:

1. Detén el servidor de desarrollo
2. Limpia el caché de Next.js:
   ```bash
   rm -rf .next
   ```
3. Reinicia el servidor:
   ```bash
   npm run dev
   ```

## Archivos que Usan estas Variables

- `src/features/auth/services/auth-service.ts`
- `src/features/properties/services/properties-service.ts`
- `src/services/catalogs-service.ts`
- `src/services/countries-service.ts`

Todos estos archivos usan:
```typescript
const API_BASE = process.env.NEXT_PUBLIC_API_URL_GUEST || 'https://www.kunas.co/api/v1'
```

Y luego concatenan las rutas específicas:
```typescript
`${API_BASE}/auth/login`  // Resulta en: /api/v1/auth/login
`${API_BASE}/properties`  // Resulta en: /api/v1/properties
```
