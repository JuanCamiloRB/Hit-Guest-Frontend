export const es = {
  common: {
    welcome: "Bienvenido",
    loading: "Cargando...",
    error: "Ocurrió un error",
    save: "Guardar",
    cancel: "Cancelar",
    retry: "Reintentar",
    previous: "Anterior",
    next: "Siguiente",
    /** Formato de fechas y montos (Intl). */
    dateLocale: "es-CO",
    search: "Buscar...",
  },
  navigation: {
    home: "Inicio",
    about: "Nosotros",
    services: "Servicios",
    contact: "Contacto",
  },
  header: {
    myProfile: "Mi Perfil",
    users: "Usuarios",
    logout: "Cerrar Sesión",
  },
  dashboard: {
    home: "Inicio",
    title: "Consumo y facturación",
    description: "Tu saldo, el consumo de las automatizaciones y el detalle por reserva",
    filters: "Filtros",
    newReservation: "Nueva Reserva",
  },
  errors: {
    unparsableResponse: "No se pudo leer la respuesta del servidor.",
  },
  /** Títulos de la pestaña del navegador (`metadata` de cada página). */
  meta: {
    login: { title: "Iniciar sesión - Hit Guest", description: "Inicia sesión en tu cuenta" },
    dashboard: { title: "Panel - Hit Guest", description: "Gestiona tus propiedades y reservas" },
    properties: { title: "Propiedades - Hit Guest", description: "Gestiona tus propiedades" },
    reservation: {
      title: "Operación de la reserva - Hit Guest",
      description: "Gestión detallada de la reserva y estado de las automatizaciones",
    },
  },
  reservations: {
    noListings: "No hay alojamientos disponibles",
  },
  billing: {
    customAmountPlaceholder: "Monto personalizado (mín. {{min}})",
    addCredits: "Recargar créditos",
    checkoutError: "No se pudo conectar con el pago. Inténtalo de nuevo.",
    banner: {
      depleted: "Tus automatizaciones están en pausa: tu cuenta se quedó sin créditos.",
      low: "Tu saldo se está agotando (quedan {{amount}}). Recarga para evitar interrupciones.",
      dismiss: "Descartar",
    },
    success: {
      title: "¡Pago exitoso!",
      body: "Recibimos tu pago: el saldo se actualizará en unos momentos. Te llevamos a facturación…",
      goToBilling: "Ir a facturación",
    },
    history: {
      title: "Historial de transacciones",
      loadError: "No se pudo cargar el historial.",
      empty: "Aún no hay transacciones. Recarga créditos para empezar.",
      showing: "Mostrando {{from}}–{{to}} de {{total}}",
      page: "Página {{page}} de {{last}}",
      columns: {
        date: "Fecha",
        description: "Descripción",
        type: "Tipo",
        source: "Origen",
        amount: "Monto",
        balance: "Saldo",
        status: "Estado",
      },
      /*
       * Etiquetas de los CÓDIGOS que manda el backend. Un código que no está
       * aquí se muestra tal cual.
       */
      types: { credit: "Crédito", debit: "Débito" },
      sources: {
        trial: "Prueba",
        stripe: "Stripe",
        automation: "Automatización",
        automation_refund: "Reembolso",
        manual: "Manual",
      },
      statuses: { completed: "Completada", refunded: "Reembolsada" },
    },
  },
} as const;
