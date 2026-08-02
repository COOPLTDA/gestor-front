import { fetchWithAuth, type FetchWithAuthOptions } from '@/utils/fetchWithAuth';

// Adaptador para el módulo Zonificación (migrado desde el repo standalone
// zonificacion/frontend, donde src/api/*.ts hacía fetch directo contra
// localhost:3010). Acá la sesión viaja en cookies httpOnly vía fetchWithAuth, que
// además maneja el refresh automático ante 401 y el logout forzado. Mismo
// contrato que bibliaRequest.ts: devuelve el JSON parseado y ante un error HTTP
// lanza Error con el mensaje del backend ({ error } — errorHandler del módulo
// zonificación — o { message } del errorHandler global del host).
export async function request<T = unknown>(url: string, options?: FetchWithAuthOptions): Promise<T> {
  const res = await fetchWithAuth(url, options ?? {});

  if (!res.ok) {
    const body = (await res.json()) as { error?: string; message?: string } | null;
    throw new Error(body?.error || body?.message || `Error ${res.status}`);
  }

  return (await res.json()) as T;
}
