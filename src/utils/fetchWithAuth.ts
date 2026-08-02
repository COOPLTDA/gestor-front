import { STORAGE_KEYS, API } from '@/constants/api';

// Singleton promise para evitar múltiples refresh simultáneos
let refreshPromise: Promise<string | null> | null = null;

function forceLogout() {
  // Limpiar solo datos de usuario (los tokens están en cookies httpOnly gestionadas por el servidor)
  Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
  window.location.href = '/login';
}

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = fetch(API.AUTH.REFRESH, {
      method: 'POST',
      credentials: 'include', // El refresh_token viene en cookie httpOnly automáticamente
      headers: { 'Content-Type': 'application/json' },
    })
      .then(async (res) => {
        if (!res.ok) return null;
        const json = await res.json();
        return (json as { data?: { access_token?: string } })?.data?.access_token ?? null;
      })
      .catch(() => null)
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

export type FetchWithAuthOptions = RequestInit & {
  signal?: AbortSignal;
};

export type FetchWithAuthResult = {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
  [key: string]: unknown;
};

/**
 * Wrapper de fetch que:
 * 1. Envía cookies httpOnly automáticamente (credentials: 'include')
 * 2. Reintenta UNA VEZ con token refreshado si recibe 401
 * 3. Fuerza logout si el refresh también falla
 * 4. Soporta AbortController para cancelar requests en vuelo
 */
export async function fetchWithAuth(
  url: string,
  options: FetchWithAuthOptions = {},
  retry = true
): Promise<FetchWithAuthResult> {
  const headers = new Headers(options.headers);

  if (
    options.body &&
    !headers.has('Content-Type') &&
    !(options.body instanceof FormData)
  ) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include', // Siempre enviar cookies (access_token + refresh_token)
  });

  if (response.status === 401 && retry) {
    const newToken = await refreshAccessToken();

    if (!newToken) {
      forceLogout();
      throw new Error('Sesión expirada');
    }

    // Notificar al AuthContext que se renovó el token (para sincronizar estado interno)
    window.dispatchEvent(new CustomEvent('token-refreshed', { detail: { token: newToken } }));

    return fetchWithAuth(url, options, false);
  }

  let json: Record<string, unknown>;
  try {
    json = await response.json();
  } catch {
    json = { success: false, message: 'Error procesando respuesta del servidor' };
  }

  return {
    ...json,
    ok: response.ok,
    status: response.status,
    json: async () => json,
  };
}

/**
 * Crea un AbortController con timeout automático.
 * Uso: const { signal, cleanup } = createAbortController(5000);
 *      fetchWithAuth(url, { signal })
 *      .finally(() => cleanup());
 */
export function createAbortController(timeoutMs = 30_000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  return {
    signal: controller.signal,
    abort: () => {
      clearTimeout(timeoutId);
      controller.abort();
    },
    cleanup: () => clearTimeout(timeoutId),
  };
}
