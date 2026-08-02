import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFechaRange } from './useFechaRange';
import { type AsignacionRaw, prevBusinessDay, nextBusinessDay } from './bibliaSelectors';

// Tests unitarios del sub-hook, complementarios a los de useBibliaData.test.tsx (caja
// negra): acá se cubren los bordes finos del rango (min/max con fixtures desordenadas,
// clamps, override manual) que el hook compuesto no discrimina.

const today = new Date().toISOString().slice(0, 10);
const bibliaHoy = today;
const prevBD = prevBusinessDay(bibliaHoy);

// Fechas viejas fijas, muy anteriores a cualquier prevBusinessDay real
const OLD_1 = '2026-01-05'; // mínima
const OLD_2 = '2026-01-07';
const OLD_3 = '2026-01-09';

function asig(preparacion_fecha: string, extra: Partial<AsignacionRaw> = {}): AsignacionRaw {
  return {
    preparacion_id: Math.floor(Math.random() * 100000),
    chofer_codigo: 'CH1',
    biblia_fecha: bibliaHoy,
    preparacion_fecha,
    ...extra,
  };
}

function render(bibliaFecha: string, asigs: AsignacionRaw[]) {
  return renderHook(
    ({ bf, a }: { bf: string; a: AsignacionRaw[] }) => useFechaRange(bf, a),
    { initialProps: { bf: bibliaFecha, a: asigs } }
  );
}

describe('useFechaRange — default sin asignaciones', () => {
  it('sin asignaciones el rango es el día hábil previo a la biblia', () => {
    const { result } = render(bibliaHoy, []);
    expect(result.current.fechaDesde).toBe(prevBD);
    expect(result.current.fechaHasta).toBe(prevBD);
  });

  it('arranca en modo default aunque el estado inicial fuera hoy (override no marcado)', () => {
    // Si el ref de override arrancara en true, el efecto no pisaría el estado inicial
    // (hoy) con el día hábil previo.
    const { result } = render(bibliaHoy, []);
    expect(result.current.fechaDesde).toBe(prevBD);
  });
});

describe('useFechaRange — min/max de asignaciones (fixtures desordenadas)', () => {
  it('desde toma la mínima aunque no sea la primera ni la última', () => {
    // min (OLD_1) en el medio; última con fecha distinta para matar mutantes de reduce
    const { result } = render(bibliaHoy, [asig(OLD_2), asig(OLD_1), asig(today), asig(OLD_3)]);
    expect(result.current.fechaDesde).toBe(OLD_1);
  });

  it('hasta toma la máxima aunque no sea la primera ni la última', () => {
    // max (today) en el medio; today > prevBD y <= maxPrep, así que hasta = today
    const { result } = render(bibliaHoy, [asig(OLD_2), asig(OLD_1), asig(today), asig(OLD_3)]);
    expect(result.current.fechaHasta).toBe(today);
  });

  it('una única asignación de hoy no empuja el desde por encima del día hábil previo', () => {
    // min (today) > prevBD: el default nunca arranca después del día de preparación
    const { result } = render(bibliaHoy, [asig(today)]);
    expect(result.current.fechaDesde).toBe(prevBD);
    expect(result.current.fechaHasta).toBe(today);
  });
});

describe('useFechaRange — qué asignaciones anclan', () => {
  it('una fallida sin chofer no ancla aunque tenga destino', () => {
    const { result } = render(bibliaHoy, [
      asig(OLD_1, { chofer_codigo: '', sigma_sync_estado: 'fallido', codigo_despacho_destino: '150' }),
    ]);
    expect(result.current.fechaDesde).toBe(prevBD);
  });

  it('una bloqueada sin chofer no ancla aunque tenga destino', () => {
    const { result } = render(bibliaHoy, [
      asig(OLD_1, { chofer_codigo: '', sigma_sync_estado: 'bloqueado', codigo_despacho_destino: '150' }),
    ]);
    expect(result.current.fechaDesde).toBe(prevBD);
  });

  it('asignaciones sin preparacion_fecha no anclan', () => {
    const { result } = render(bibliaHoy, [asig('', {})]);
    expect(result.current.fechaDesde).toBe(prevBD);
    expect(result.current.fechaHasta).toBe(prevBD);
  });
});

describe('useFechaRange — clamp a maxPrep', () => {
  it('para una biblia pasada, una asignación de hoy se clampa a la fecha de la biblia', () => {
    const bibliaPasada = '2026-03-10';
    const { result } = render(bibliaPasada, [asig(today, { biblia_fecha: bibliaPasada })]);
    expect(result.current.fechaHasta).toBe(bibliaPasada);
  });

  it('para una biblia futura sin asignaciones, hasta no supera hoy', () => {
    const bibliaFutura = nextBusinessDay(nextBusinessDay(today));
    const { result } = render(bibliaFutura, []);
    expect(result.current.fechaHasta <= today).toBe(true);
    expect(result.current.fechaDesde <= result.current.fechaHasta).toBe(true);
  });
});

describe('useFechaRange — override manual', () => {
  it('con el rango tomado a mano, el techo se mantiene y no vuelve al default', () => {
    const { result, rerender } = render(bibliaHoy, [asig(OLD_3)]);
    // El usuario achica el techo a mano por debajo del día hábil previo
    act(() => result.current.setFechaHasta(OLD_3));
    expect(result.current.fechaHasta).toBe(OLD_3);

    // Cambian las asignaciones (nueva mínima) sin cambiar de biblia: el override
    // se respeta — el techo no se resetea al día hábil previo.
    rerender({ bf: bibliaHoy, a: [asig(OLD_3), asig(OLD_1)] });
    expect(result.current.fechaHasta).toBe(OLD_3);
    // El piso sí se extiende hacia atrás hasta la nueva mínima
    expect(result.current.fechaDesde).toBe(OLD_1);
  });

  it('con override, una máxima nueva más alta extiende el techo', () => {
    const { result, rerender } = render(bibliaHoy, [asig(OLD_2)]);
    act(() => result.current.setFechaHasta(OLD_3));
    expect(result.current.fechaHasta).toBe(OLD_3);

    // Aparece una asignación de hoy: el techo sube hasta hoy (max > override)
    rerender({ bf: bibliaHoy, a: [asig(OLD_2), asig(today)] });
    expect(result.current.fechaHasta).toBe(today);
  });

  it('con override, si la máxima es menor que el techo manual, el techo no baja', () => {
    const { result, rerender } = render(bibliaHoy, [asig(OLD_2)]);
    act(() => result.current.setFechaHasta(today));
    expect(result.current.fechaHasta).toBe(today);

    // Cambia la mínima (el efecto se re-dispara) pero la máxima sigue vieja:
    // el techo manual (hoy) se mantiene, no baja a la máxima
    rerender({ bf: bibliaHoy, a: [asig(OLD_2), asig(OLD_1)] });
    expect(result.current.fechaHasta).toBe(today);
  });

  it('con override y biblia pasada, el techo extendido se clampa a la biblia', () => {
    const bibliaPasada = '2026-03-10';
    const a1 = asig(OLD_2, { biblia_fecha: bibliaPasada });
    const { result, rerender } = render(bibliaPasada, [a1]);
    act(() => result.current.setFechaDesde(OLD_2)); // marca override
    // Aparece una asignación de hoy (> biblia pasada): el techo sube pero clampa
    rerender({ bf: bibliaPasada, a: [a1, asig(today, { biblia_fecha: bibliaPasada })] });
    expect(result.current.fechaHasta).toBe(bibliaPasada);
  });

  it('cambiar de biblia resetea el override y vuelve al default', () => {
    const { result, rerender } = render(bibliaHoy, []);
    act(() => result.current.setFechaHasta(OLD_3));
    expect(result.current.fechaHasta).toBe(OLD_3);

    const otraBiblia = nextBusinessDay(bibliaHoy);
    rerender({ bf: otraBiblia, a: [] });
    // Default de la nueva biblia: día hábil previo (clampado a hoy si es futura)
    const esperado = prevBusinessDay(otraBiblia) > today ? today : prevBusinessDay(otraBiblia);
    expect(result.current.fechaHasta).toBe(esperado);
  });

  it('resetOverride vuelve al modo default sin cambiar de biblia', () => {
    const { result, rerender } = render(bibliaHoy, [asig(OLD_2)]);
    act(() => result.current.setFechaHasta(OLD_3));
    expect(result.current.fechaHasta).toBe(OLD_3);

    act(() => result.current.resetOverride());
    // Re-disparar el efecto con una mínima nueva: ahora corre la rama default
    rerender({ bf: bibliaHoy, a: [asig(OLD_2), asig(OLD_1)] });
    expect(result.current.fechaHasta).toBe(prevBD);
    expect(result.current.fechaDesde).toBe(OLD_1);
  });

  it('setFechaDesde manual no puede quedar por debajo de la mínima asignada', () => {
    const { result } = render(bibliaHoy, [asig(OLD_2)]);
    act(() => result.current.setFechaDesde(OLD_3)); // por encima de la mínima (OLD_2)
    expect(result.current.fechaDesde).toBe(OLD_2); // se fuerza el piso
  });

  it('setFechaDesde manual SÍ puede extender el rango antes de la mínima asignada (no es un techo)', () => {
    // El piso solo actúa cuando v > minAsigFecha; si v es anterior al mínimo, se respeta tal cual.
    const { result } = render(bibliaHoy, [asig(OLD_2)]);
    act(() => result.current.setFechaDesde(OLD_1)); // OLD_1 es anterior a la mínima (OLD_2)
    expect(result.current.fechaDesde).toBe(OLD_1);
  });

  it('setFechaHasta manual no puede quedar por debajo de la máxima asignada', () => {
    const { result } = render(bibliaHoy, [asig(OLD_2)]);
    act(() => result.current.setFechaHasta(OLD_1)); // por debajo de la máxima (OLD_2)
    expect(result.current.fechaHasta).toBe(OLD_2); // se fuerza el techo
  });

  it('setFechaDesde marca override: un cambio posterior de asignaciones no vuelve al rango default', () => {
    // Mismo patrón que el test de "el techo se mantiene" de más arriba, pero disparando
    // el override desde setFechaDesde (línea aparte que también marca el flag) en vez de
    // setFechaHasta. Si esa asignación no marcara el flag, el próximo efecto recalcularía
    // el default (prevBD) en vez de respetar el valor manual OLD_3.
    const { result, rerender } = render(bibliaHoy, [asig(OLD_2)]);
    act(() => result.current.setFechaDesde(OLD_1)); // marca override, achica el piso a mano
    expect(result.current.fechaDesde).toBe(OLD_1);

    // Cambia la máxima asignada (sin cambiar de biblia): el efecto se re-dispara.
    rerender({ bf: bibliaHoy, a: [asig(OLD_2), asig(today)] });
    // En modo override, el piso manual (OLD_1) se respeta (no es mayor que la nueva mínima).
    // En modo default (si el flag no se marcó), el piso sería prevBD, muy distinto de OLD_1.
    expect(result.current.fechaDesde).toBe(OLD_1);
  });
});
