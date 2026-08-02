import React, { createContext, useContext, useEffect, useState, ReactNode, useMemo, useCallback } from "react";
import { fetchWithAuth } from "@/utils/fetchWithAuth";
import { API } from "@/constants/api";

/**
 * CATÁLOGOS CONTEXT
 *
 * Problema resuelto:
 * - Evita que cada Tab cargue catálogos por separado
 * - Catálogos se cargan una sola vez
 * - Compartidos entre todos los componentes
 *
 * Uso:
 * <CatalogosProvider>
 *   <PresupuestoEnro />
 * </CatalogosProvider>
 *
 * Dentro de componentes:
 * const catalogos = useCatalogos();
 */

export type Catalogo = {
  proveedores: Array<{ codigo: number; nombre: string }>;
  divisiones: Array<{ codigo: number; nombre: string }>;
  supervisores: Array<{ id: number; nombre: string }>;
  vendedores: Array<{ id: string; nombre: string; supervisorId: number }>;
  clientes: Array<{
    id: string;
    nombre: string;
    codigo_canal: string;
    canal: string;
  }>;
};

interface CatalogosContextType {
  catalogos: Catalogo | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const CatalogosContext = createContext<CatalogosContextType | null>(null);

export function CatalogosProvider({
  children,
  initialData
}: {
  children: ReactNode;
  initialData?: Catalogo | null;
}) {
  const [catalogos, setCatalogos] = useState<Catalogo | null>(initialData ?? null);
  const [loading, setLoading] = useState(initialData ? false : true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetchWithAuth(API.PRESUPUESTO_ENRO.CATALOGOS);
      if (res.success) {
        const data = await res.json();
        setCatalogos(data.data);
      } else {
        setError("No se pudieron cargar los catálogos");
      }
    } catch (err) {
      setError("Error de conexión al cargar catálogos");
      console.error("Error en CatalogosProvider:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Solo fetchea si no se recibieron datos iniciales
  useEffect(() => {
    if (!initialData) {
      refetch();
    }
  }, []);

  // Memoizar el value para que los consumidores del contexto NO re-rendericen
  // cuando el padre (PresupuestoEnroPage) re-renderiza sin que los datos cambien.
  const value = useMemo<CatalogosContextType>(
    () => ({ catalogos, loading, error, refetch }),
    [catalogos, loading, error, refetch]
  );

  return (
    <CatalogosContext.Provider value={value}>
      {children}
    </CatalogosContext.Provider>
  );
}

// Objeto vacío estable a nivel de módulo: evita que `catalogos.proveedores` tenga
// una referencia nueva en cada render cuando los catálogos aún están cargando.
// Sin esto, todos los useCallback que dependen de `catalogos.proveedores` se
// recrearían en cada render durante la carga, disparando múltiples fetches (parpadeo).
const EMPTY_CATALOGO: Catalogo = {
  proveedores: [],
  divisiones: [],
  supervisores: [],
  vendedores: [],
  clientes: []
};

/**
 * Hook para usar catálogos
 */
export function useCatalogos(): Catalogo {
  const context = useContext(CatalogosContext);

  if (!context) {
    throw new Error(
      "useCatalogos debe usarse dentro de CatalogosProvider"
    );
  }

  if (context.loading) {
    return EMPTY_CATALOGO;
  }

  return context.catalogos || EMPTY_CATALOGO;
}

/**
 * Hook para obtener estado completo del contexto
 */
export function useCatalogosState(): CatalogosContextType {
  const context = useContext(CatalogosContext);

  if (!context) {
    throw new Error(
      "useCatalogosState debe usarse dentro de CatalogosProvider"
    );
  }

  return context;
}

/**
 * Hook helper: obtener mapa de código->nombre para un catálogo
 */
export function useCatalogoMap(type: keyof Catalogo) {
  const catalogos = useCatalogos();
  const items = catalogos[type] as any[];

  return useMemo(() => {
    if (!items) return {};

    // Detectar qué campo es la clave (id, codigo, etc)
    const firstItem = items[0];
    if (!firstItem) return {};

    let keyField = 'codigo' as string;
    if ('id' in firstItem) keyField = 'id';
    else if ('codigo' in firstItem) keyField = 'codigo';

    const map: Record<string, string> = {};
    items.forEach((item: any) => {
      const key = String(item[keyField]);
      const label = item.nombre || item.descripcion || '';
      map[key] = `${key} - ${label}`;
    });

    return map;
  }, [items]);
}
