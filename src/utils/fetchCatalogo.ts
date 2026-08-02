// frontend/src/utils/fetchCatalogo.ts
import { fetchWithAuth } from "./fetchWithAuth";

export async function getCatalogoToken() {
  const res = await fetch("/api/catalogo/token-publico");
  const data = await res.json();
  if (data.success && data.token) {
    localStorage.setItem("catalogoToken", data.token);
  } else {
    console.error("No se pudo obtener el token del catálogo");
  }
}

/**
 * fetchCatalogo
 * Igual que fetchWithAuth, pero gestiona el token público del catálogo
 */
export async function fetchCatalogo(endpoint: string, options: RequestInit = {}) {
  let token = localStorage.getItem("catalogoToken");
  if (!token) {
    await getCatalogoToken();
    token = localStorage.getItem("catalogoToken");
  }

  // Adjunta el token manualmente al header para fetchWithAuth
  const headers = {
    ...options.headers,
    Authorization: `Bearer ${token}`,
  };

  return fetchWithAuth(endpoint, { ...options, headers });
}
