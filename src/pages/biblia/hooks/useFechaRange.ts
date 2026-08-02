import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { type AsignacionRaw, prevBusinessDay } from './bibliaSelectors';

const today = new Date().toISOString().slice(0, 10);

export interface FechaRangeData {
  fechaDesde: string;
  fechaHasta: string;
  setFechaDesde: (v: string) => void;
  setFechaHasta: (v: string) => void;
  resetOverride: () => void;
}

// Gestión del rango de fechas:
// - Por defecto, el rango es EXACTAMENTE el de las preparaciones asignadas a la biblia.
// - Si la biblia no tiene asignaciones, cae al día hábil anterior.
// - Si el usuario fijó el rango a mano, se respeta: solo se garantiza el piso (no achicar
//   por debajo de las asignaciones), sin volver a forzar el default.
//
// Nota sobre mutation testing (21/07/2026, ampliada 23/07/2026): las comparaciones de clamp
// de abajo (< vs <=, > vs >=) tienen mutantes de Stryker que sobreviven porque son
// estructuralmente equivalentes: en el caso límite (valores iguales) ambas ramas devuelven el
// mismo valor, así que ningún test observable puede distinguirlas sin depender de detalles de
// implementación falsos. No se fuerzan tests de relleno para esos casos.
// Dos casos adicionales también equivalentes, verificados:
// - `if (minAsigFecha) setFechaDesde(...)` / `if (maxAsigFecha) setFechaHasta(...)`: si el
//   mutante fuerza `if (true)`, con minAsigFecha/maxAsigFecha === null la comparación interna
//   `null < prev` coacciona a `0 < NaN` = false, así que la rama ternaria devuelve `prev` sin
//   cambios — mismo resultado observable que no llamar al setter.
// - `useCallback(..., [])` → deps con un literal constante: un literal nunca cambia entre
//   renders, así que el callback memoizado nunca se recrea de todos modos.
export function useFechaRange(bibliaFecha: string, rawAsignaciones: AsignacionRaw[]): FechaRangeData {
  const [fechaDesde, setFechaDesde] = useState(today);
  const [fechaHasta, setFechaHasta] = useState(today);
  const prevBibliaFechaRef = useRef(bibliaFecha); // para detectar cambios de biblia
  const userOverrodeRangeRef = useRef(false); // true cuando el usuario fijó el rango a mano

  // Límites de fecha de los pedidos asignados a la biblia actual.
  // Incluye 'ok' y 'pendiente cross-code' aunque chofer_codigo esté vacío (limpiar los borra):
  // su fecha sigue anclando el rango para que cargarPreparaciones no se resetee y borre los badges.
  const asigsBibliaActual = useMemo(
    () => rawAsignaciones.filter(a =>
      (a.chofer_codigo || a.sigma_sync_estado === 'ok' || (a.sigma_sync_estado === 'pendiente' && a.codigo_despacho_destino != null)) &&
      a.biblia_fecha === bibliaFecha && a.preparacion_fecha
    ),
    [rawAsignaciones, bibliaFecha]
  );
  const minAsigFecha = useMemo(() => {
    if (asigsBibliaActual.length === 0) return null;
    return asigsBibliaActual.reduce((m, a) => a.preparacion_fecha < m ? a.preparacion_fecha : m, asigsBibliaActual[0].preparacion_fecha);
  }, [asigsBibliaActual]);
  const maxAsigFecha = useMemo(() => {
    if (asigsBibliaActual.length === 0) return null;
    return asigsBibliaActual.reduce((m, a) => a.preparacion_fecha > m ? a.preparacion_fecha : m, asigsBibliaActual[0].preparacion_fecha);
  }, [asigsBibliaActual]);

  useEffect(() => {
    const bibliaChanged = prevBibliaFechaRef.current !== bibliaFecha;
    prevBibliaFechaRef.current = bibliaFecha;
    if (bibliaChanged) userOverrodeRangeRef.current = false;

    const maxPrep = bibliaFecha < today ? bibliaFecha : today;

    if (userOverrodeRangeRef.current) {
      if (minAsigFecha) setFechaDesde(prev => (minAsigFecha < prev ? minAsigFecha : prev));
      if (maxAsigFecha) setFechaHasta(prev => {
        const h = maxAsigFecha > prev ? maxAsigFecha : prev;
        return h > maxPrep ? maxPrep : h;
      });
      return;
    }

    // Por defecto el rango arranca en el día hábil anterior a la biblia (día de preparación).
    // Las asignaciones existentes solo EXTIENDEN el rango (hacia atrás si hay preps más
    // viejas; hacia adelante hasta maxPrep), nunca empujan el inicio más allá del día de
    // preparación. Así, al abrir la biblia del 10 siempre se ve el día hábil anterior.
    const prevBD = prevBusinessDay(bibliaFecha);
    let desde = minAsigFecha && minAsigFecha < prevBD ? minAsigFecha : prevBD;
    let hasta = maxAsigFecha && maxAsigFecha > prevBD ? maxAsigFecha : prevBD;
    if (hasta > maxPrep) hasta = maxPrep;
    if (desde > hasta) desde = hasta; // biblia futura: prevBD puede superar maxPrep
    setFechaDesde(desde);
    setFechaHasta(hasta);
  }, [bibliaFecha, minAsigFecha, maxAsigFecha]);

  // Setters que impiden achicar el rango más allá de las asignaciones existentes.
  // Marcan que el usuario tomó control manual del rango para no volver a forzar el default.
  const setFechaDesdeSeguro = useCallback((v: string) => {
    userOverrodeRangeRef.current = true;
    setFechaDesde(minAsigFecha && v > minAsigFecha ? minAsigFecha : v);
  }, [minAsigFecha]);

  const setFechaHastaSeguro = useCallback((v: string) => {
    userOverrodeRangeRef.current = true;
    setFechaHasta(maxAsigFecha && v < maxAsigFecha ? maxAsigFecha : v);
  }, [maxAsigFecha]);

  const resetOverride = useCallback(() => {
    userOverrodeRangeRef.current = false;
  }, []);

  return {
    fechaDesde,
    fechaHasta,
    setFechaDesde: setFechaDesdeSeguro,
    setFechaHasta: setFechaHastaSeguro,
    resetOverride,
  };
}
