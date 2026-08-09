// ============================================================
// API ROUTES
// Centralizar todas las rutas de la API en un único lugar.
// ============================================================

const DG = '/api/gestor';

export const API = {
  AUTH: {
    LOGIN: '/api/auth/login',
    LOGOUT: '/api/auth/logout',
    REFRESH: '/api/auth/refresh',
    FORGOT_PASSWORD: '/api/auth/forgot-password',
    RESET_PASSWORD: '/api/auth/reset-password',
  },
  USERS: {
    BASE: `${DG}/users`,
    BY_ID: (id: number | string) => `${DG}/users/${id}`,
    PAGINAS: (id: number | string) => `${DG}/users/${id}/paginas`,
    CHANGE_PASSWORD: `${DG}/users/change-password`,
  },
  ROLES: `${DG}/roles`,
  DASHBOARD: `${DG}/dashboard`,
  PEDIDOS: `${DG}/pedidos`,
  ARTICULOS: `${DG}/articulos`,
  CONTACTOS: `${DG}/contactos`,
  CLIENTES: `${DG}/clients`,
  PRODUCTOS: `${DG}/products`,
  RECIBOS: {
    BASE: `${DG}/recibos`,
    VALORES: (hojaRuta: string) => `${DG}/recibos-valores/${hojaRuta}`,
    ACTUALIZAR_OBSERVACION: `${DG}/recibos-valores/actualizar-observacion`,
  },
  HOJAS_RUTA: `${DG}/hojas-ruta`,
  TIPOS_COBRO: `${DG}/tipos-cobro`,
  CONCILIACION: {
    HDR_ESTADO: `${DG}/conciliacion/hdr/estado`,
  },
  ERP: {
    TRANSMITIR: `${DG}/erp/transmitir`,
    CANCELAR: `${DG}/erp/cancelar`,
  },
  EXTRACTOS: `${DG}/extractos`,
  IMPORTADORES: `${DG}/importadores`,
  PARAMETROS: `${DG}/parametros`,
  CATALOGO: '/api/catalogo',
  FICHAJES: {
    BASE: `${DG}/fichajes`,
    DETALLE: (empleado: string) => `${DG}/fichajes/detalle/${empleado}`,
    ANALYTICS: `${DG}/fichajes/analytics`,
    ANALYTICS_VENDEDOR: (empleado: string) => `${DG}/fichajes/analytics/vendedor/${empleado}`,
    ANALYTICS_ASISTENCIA:   `${DG}/fichajes/analytics/asistencia`,
    ANALYTICS_REPORTE:      `${DG}/fichajes/analytics/reporte-diario`,
  },
  // Administración de apps mobile (gestionado desde CoopGestion web)
  MOBILE_ADMIN: {
    USUARIOS: `${DG}/mobile-admin/usuarios`,
    ROLES: `${DG}/mobile-admin/roles`,
    PARAMETROS: `${DG}/mobile-admin/parametros`,
    VENDEDORES: `${DG}/mobile-admin/vendedores`,
  },
  // APIs consumidas por los dispositivos mobile
  MOBILE: {
    VENDEDORES_APP: {
      AUTH: '/api/mobile/vendedores/auth',
      SYNC: '/api/mobile/vendedores/sync',
    },
    // CLIENTES_APP: { ... }  // futura app de clientes
  },
} as const;

// ============================================================
// STORAGE KEYS
// Si se usa localStorage (ej. para la app móvil), usar estas constantes.
// La web usa httpOnly cookies (sin localStorage de tokens).
// ============================================================
export const STORAGE_KEYS = {
  USER_DATA: 'user_data',
  USER_PAGES: 'user_pages',
} as const;

// ============================================================
// RUTAS DEL FRONTEND
// ============================================================
export const ROUTES = {
  LOGIN: '/login',
  RESET_PASSWORD: '/reset-password',
  APP: '/app',
  DASHBOARD: '/app/dashboard',
  PEDIDOS: '/app/pedidos',
  USUARIOS: '/app/usuarios',
  ROLES: '/app/roles',
  RECIBOS: '/app/recibos',
  PARAMETROS: '/app/parametros',
  IMPORTADORES: '/app/importadores',
  IMPORTACION_EXTRACTOS: '/app/importacion-extractos',
  FICHAJES: '/app/fichajes',
} as const;
