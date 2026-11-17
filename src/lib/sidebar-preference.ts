/**
 * Dónde vive la preferencia «barra lateral contraída».
 *
 * Módulo SIN `"use client"` a propósito: `AdminLayout` (servidor) necesita el
 * nombre de la cookie, y una constante exportada desde un módulo cliente llega
 * al servidor como referencia, no como valor (`cookieStore.get(undefined)`
 * devolvía nada aunque la cookie viajara: se vio en producción local).
 */
export const SIDEBAR_STORAGE_KEY = "hitguest:sidebar-collapsed"
export const SIDEBAR_COOKIE_NAME = "hitguest_sidebar"
export const SIDEBAR_COOKIE_COLLAPSED = "collapsed"
export const SIDEBAR_COOKIE_EXPANDED = "expanded"
