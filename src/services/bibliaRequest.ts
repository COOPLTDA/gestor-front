import { fetchWithAuth, type FetchWithAuthOptions } from '@/utils/fetchWithAuth';

// Adaptador para el módulo Biblia (migrado desde front-biblia, donde services/api.ts
// manejaba token en localStorage). Acá la sesión viaja en cookies httpOnly vía
// fetchWithAuth, que además maneja el refresh automático ante 401 y el logout forzado.
// Mantiene el contrato original de request<T>: devuelve el JSON parseado y ante un
// error HTTP lanza Error con el mensaje del backend ({ error } — errorHandler del
// módulo biblia — o { message } del errorHandler global del host).
export async function request<T = unknown>(url: string, options?: FetchWithAuthOptions): Promise<T> {
  const res = await fetchWithAuth(url, options ?? {});

  if (!res.ok) {
    const body = (await res.json()) as { error?: string; message?: string } | null;
    throw new Error(body?.error || body?.message || `Error ${res.status}`);
  }

  return (await res.json()) as T;
}
