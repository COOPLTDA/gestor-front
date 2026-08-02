import { useEffect, useState } from "react";
import { fetchWithAuth } from "@/utils/fetchWithAuth";
import { API } from "@/constants/api";

/**
 * Obtiene el valor de un parámetro por código.
 * Retorna `defaultValor` mientras carga o si el parámetro no existe.
 */
export function useParametro(codigo: string, defaultValor = "S"): string {
  const [valor, setValor] = useState(defaultValor);

  useEffect(() => {
    let cancelled = false;
    fetchWithAuth(API.PARAMETROS)
      .then(r => r.json())
      .then(json => {
        if (cancelled || !json.success) return;
        const found = (json.data as { codigo: string; valor: string; activo: number }[])
          .find(p => p.activo === 1 && p.codigo === codigo);
        if (found) setValor(found.valor);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [codigo]);

  return valor;
}
