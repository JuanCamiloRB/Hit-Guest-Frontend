# HiTGuest - Sistema de Gestión Hotelera

## 📋 Resumen del Proyecto

**HiTGuest** es un sistema integral de gestión hotelera diseñado para el mercado de rentas cortas que automatiza las operaciones de check-in y check-out de huéspedes, permitiendo a los administradores y huéspedes interactuar de manera eficiente.

## 🏗️ Arquitectura del Proyecto

### Stack Tecnológico
- **Frontend**: React 18+ con Next.js 14 (App Router)
- **Lenguaje**: TypeScript
- **Estilos**: TailwindCSS + Design System Personalizado
- **Componentes**: shadcn/ui + Componentes Base Reutilizables
- **Estado**: Zustand + React Query
- **Formularios**: React Hook Form + Zod
- **Integraciones**: Stripe, Google Maps, Canvas para firma

### Estructura del Proyecto

```
src/
├── app/                     # App Router (Next.js 14)
│   ├── (auth)/             # Rutas de autenticación
│   ├── (dashboard)/        # Admin Panel
│   ├── guest/              # Guest Portal
│   └── globals.css
├── components/             # Componentes reutilizables
│   ├── ui/                # Componentes base (shadcn/ui)
│   ├── base-components.tsx # Componentes base HiTGuest
│   └── forms/             # Componentes de formularios
├── features/              # Módulos de negocio
│   ├── auth/             # Autenticación
│   ├── properties/       # Gestión de propiedades
│   ├── reservations/     # Gestión de reservas
│   └── operations/       # Panel de operaciones
├── lib/                  # Utilidades y configuración
│   ├── design-system.ts  # Sistema de diseño completo
│   ├── colors.ts         # Paleta de colores HiTGuest
│   ├── typography.ts     # Sistema de tipografía
│   ├── spacing.ts        # Sistema de espaciado
│   ├── shadows.ts        # Sistema de sombras
│   └── borders.ts        # Sistema de bordes
├── templates/            # Plantillas
│   └── welcome-email.tsx # Email de bienvenida
└── types/               # Definiciones TypeScript
```

## 🎨 Design System HiTGuest

### Colores de Marca
- **Azul Principal**: `#5c6fb1` (derivado del logo)
- **Púrpura Acento**: `#9333ea` (punto del logo)
- **Gris Oscuro**: `#1e293b` (texto del logo)
- **Escala Completa**: 50-900 shades para cada color

### Tipografía
- **Font Principal**: Inter (system-ui fallback)
- **Escala Responsiva**: Mobile-first
- **Pesos**: 100-900
- **Semantic Text Styles**: Headings, body, labels, etc.

### Componentes Base Reutilizables
- **Button**: 5 variantes (primary, secondary, outline, ghost, destructive)
- **Input**: 3 variantes (default, filled, outlined)
- **Card**: 3 variantes (default, elevated, outlined)
- **Badge**: 6 variantes de color
- **Avatar**: Circle/Square, múltiples tamaños
- **Separator**: Horizontal/Vertical, 3 estilos

## 🚀 Módulos Principales

### 1. Autenticación y Cuenta
- Magic link login
- Gestión de usuarios y roles
- Integración Stripe para suscripciones
- Formulario de registro con validaciones

### 2. Propiedades y Unidades
- CRUD completo de propiedades
- Integración iCal (Airbnb)
- Upload de fotos
- Configuración de amenities

### 3. Gestión de Reservas
- CRUD manual + sincronización iCal
- Filtros avanzados
- Estados visuales
- Búsqueda y búsqueda

### 4. Panel de Operaciones (Core)
- **Semáforos de estados**: Reserva → Link → Check-in → Contrato → Instrucciones → TRA → SIRE → Check-out → Factura
- Contador de check-ins pendientes
- Vista de foto del alojamiento
- Indicadores visuales de estado

### 5. Guest Portal
- Acceso por link único (sin login)
- Formulario de registro de huésped
- Carga de documentos (drag & drop)
- Campos condicionales para extranjeros (SIRE)
- Barra de progreso del check-in
- Firma digital

### 6. Configuraciones por Propiedad
- Plantillas de mensajes personalizadas
- Editor de contratos con variables dinámicas
- Instrucciones de llegada
- Integraciones (TRA, SIRE, cerraduras)

## 📧 Plantillas de Email

### Email de Bienvenida Bilingüe
- **Español e Inglés**: Soporte completo para ambos idiomas
- **Branding Consistente**: Logo HiTGuest y colores de marca
- **Diseño Responsivo**: Mobile-first
- **Contenido Dinámico**: Nombre de usuario, cliente, URL de login

## 🔧 Configuración del Entorno

### Variables de Entorno
```env
NEXT_PUBLIC_API_URL_HIT=https://www.kunas.co/api/v1
NEXT_PUBLIC_API_URL_GUEST=https://www.kunas.co/api/v1/hitguest
NEXT_PUBLIC_ENABLE_MOCKS=true
NEXT_PUBLIC_APP_API_TOKEN=your_token_here
```

### Instalación
```bash
npm install
npm run dev
```

### Build
```bash
npm run build
npm start
```

## 🎯 Características Técnicas

### Clean Architecture
- **Separación de Responsabilidades**: Features, lib, components
- **Componentes Reutilizables**: Base components con variantes
- **Type Safety**: TypeScript en todo el proyecto
- **Design System Centralizado**: Tokens CSS y utilidades

### Responsive Design
- **Mobile-First**: Diseño optimizado para móviles
- **Breakpoints**: sm (640px), md (768px), lg (1024px), xl (1280px)
- **Componentes Adaptativos**: Tamaños y espaciado responsive

### Performance
- **Next.js 14**: App Router con optimizaciones
- **Lazy Loading**: Componentes y rutas bajo demanda
- **Optimización de Imágenes**: Next.js Image component
- **CSS Variables**: Para theming y performance

## 🌍 Internacionalización

### Idiomas Soportados
- **Español**: Principal para Colombia y LATAM
- **Inglés**: Para mercados internacionales

### Configuraciones por País
- **Colombia**: TRA y SIRE habilitados
- **Otros Países**: Configuraciones básicas sin TRA/SIRE

## 🔐 Seguridad

### Validaciones Frontend
- **Form Security**: Honeypot, rate limiting, time validation
- **Input Sanitization**: Zod schemas para todos los formularios
- **XSS Protection**: Sanitización automática de React

### Autenticación
- **Magic Links**: Sin contraseñas para usuarios
- **OTP Verification**: Códigos de 6 dígitos
- **JWT Tokens**: Para sesiones activas

## 📊 Integraciones

### APIs Externas
- **Kunas API**: Backend principal
- **Stripe**: Pagos y suscripciones
- **Google Maps**: Ubicaciones y direcciones
- **iCal**: Sincronización con Airbnb

### Servicios de Terceros
- **Email Service**: Envío de correos transaccionales
- **File Storage**: Upload de documentos
- **Analytics**: Métricas de uso (futuro)

## 🚀 Despliegue

### Producción
- **Vercel**: Recomendado para Next.js
- **Environment Variables**: Configuración segura
- **CDN**: Para assets estáticos
- **SSL**: HTTPS obligatorio

### Monitoreo
- **Error Tracking**: Sentry o similar
- **Performance**: Web Vitals
- **Analytics**: Google Analytics 4

## 📝 Próximos Pasos

### Fase 1: MVP (4 meses)
1. ✅ Configuración inicial y design system
2. ✅ Componentes base reutilizables
3. ⏳ Autenticación y registro
4. ⏳ Gestión de propiedades
5. ⏳ Panel de operaciones
6. ⏳ Guest Portal

### Fase 2: Avanzado (4 meses)
- Backend cerraduras (TTLOCK)
- Módulo pagos de reservas
- Chat con IA
- Revenue Management
- Gestión de limpiezas
- Reportes avanzados

## 🤝 Contribución

### Guía de Estilo
- **Component Pattern**: Base + variantes
- **Naming Convention**: camelCase para componentes
- **File Structure**: Por features/módulos
- **TypeScript**: Estricto para todo el código

### Code Review
- **Design System Compliance**: Uso de tokens y componentes
- **Performance**: Optimización de renderizado
- **Accessibility**: WCAG 2.1 AA compliance
- **Testing**: Unit tests para componentes críticos

---

**© 2024 HiTGuest** - Sistema de Gestión Hotelera Profesional
