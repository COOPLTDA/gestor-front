import { describe, it, expect } from 'vitest';
import {
  formatDate, formatDisplayDate, nextBusinessDay, casoRowClass, rangoRowClass, codKey,
  buildChoferGrupos, applyCodigoOverrides, filterByCaso, filterByBiblia,
  choferGrupoKeyPorCaso, choferGrupoKeyPorBiblia,
} from './reporteUtils';
import type { GrupoDireccion } from '@/pages/biblia/types/biblia';

function makeReparto(over: Partial<GrupoDireccion['repartos'][number]> = {}): GrupoDireccion['repartos'][number] {
  return {
    codigo_numerico: 1,
    nombre: 'BIG',
    chofer_codigo: 'CH1',
    chofer_nombre: 'García',
    tipo_agrupa_direccion: 1,
    tipo_consolidado: 0,
    tipo_individual: 2,
    total_importe: 1000,
    total_pedidos: 3,
    total_clientes: 2,
    clientes_unicos: ['CL1', 'CL2'],
    detalle: [{ preparacion_id: 11, tipo: 'Pedidos individuales', importe: 1000, pedidos: 3, clientes: 2 }],
    caso: 'propia',
    biblia_fecha_asignada: '2026-07-10',
    ...over,
  };
}

describe('formatDate / formatDisplayDate', () => {
  it('formatDate devuelve YYYY-MM-DD en UTC', () => {
    expect(formatDate(new Date(Date.UTC(2026, 6, 9)))).toBe('2026-07-09');
  });

  it('formatDisplayDate convierte YYYY-MM-DD a DD/MM/YYYY', () => {
    expect(formatDisplayDate('2026-07-09')).toBe('09/07/2026');
  });
});

describe('nextBusinessDay', () => {
  it('un día de semana normal avanza exactamente 1 día', () => {
    // 2026-07-08 es miércoles → jueves 09
    expect(nextBusinessDay('2026-07-08')).toBe('2026-07-09');
  });

  it('un viernes salta el fin de semana hasta el lunes', () => {
    // 2026-07-10 es viernes → lunes 13 (no sábado 11 ni domingo 12)
    expect(nextBusinessDay('2026-07-10')).toBe('2026-07-13');
  });

  it('un sábado también salta hasta el lunes', () => {
    // 2026-07-11 es sábado → lunes 13
    expect(nextBusinessDay('2026-07-11')).toBe('2026-07-13');
  });

  it('un domingo avanza solo hasta el lunes siguiente', () => {
    // 2026-07-12 es domingo → lunes 13
    expect(nextBusinessDay('2026-07-12')).toBe('2026-07-13');
  });
});

describe('casoRowClass', () => {
  it('sin_asignar es rojo', () => {
    expect(casoRowClass('sin_asignar')).toBe('bg-red-200 print:bg-red-200');
  });
  it('otra_biblia es ámbar', () => {
    expect(casoRowClass('otra_biblia')).toBe('bg-amber-100 print:bg-amber-100');
  });
  it('propia (o cualquier otro valor) no lleva color', () => {
    expect(casoRowClass('propia')).toBe('hover:bg-slate-50');
    expect(casoRowClass('lo-que-sea')).toBe('hover:bg-slate-50');
  });
});

describe('rangoRowClass', () => {
  it('con biblia asignada no lleva color', () => {
    expect(rangoRowClass('2026-07-09')).toBe('hover:bg-slate-50');
  });
  it('sin biblia asignada (null) es rojo', () => {
    expect(rangoRowClass(null)).toBe('bg-red-200 print:bg-red-200');
  });
});

describe('codKey', () => {
  it('arma una key estable con todos los campos, usando el string vacío si no hay biblia_fecha_asignada', () => {
    const r = makeReparto({ biblia_fecha_asignada: null });
    expect(codKey('LOMAS', r)).toBe('LOMAS|1|García|propia|');
  });

  it('incluye la fecha de biblia asignada cuando existe', () => {
    const r = makeReparto({ biblia_fecha_asignada: '2026-07-10' });
    expect(codKey('LOMAS', r)).toBe('LOMAS|1|García|propia|2026-07-10');
  });

  it('dos repartos con distinta fecha asignada generan keys distintas (no colisionan)', () => {
    const a = codKey('LOMAS', makeReparto({ biblia_fecha_asignada: '2026-07-10' }));
    const b = codKey('LOMAS', makeReparto({ biblia_fecha_asignada: '2026-07-11' }));
    expect(a).not.toBe(b);
  });
});

describe('applyCodigoOverrides', () => {
  function makeGrupo(over: Partial<GrupoDireccion> = {}): GrupoDireccion {
    return {
      direccion: 'LOMAS',
      total_clientes_unicos: 2,
      repartos: [makeReparto()],
      ...over,
    };
  }

  it('sin overrides, devuelve los repartos con el mismo nombre', () => {
    const grupos = [makeGrupo()];
    const [g] = applyCodigoOverrides(grupos, {});
    expect(g.repartos[0].nombre).toBe('BIG');
  });

  it('reemplaza el nombre del reparto cuya codKey está en overrides', () => {
    const r = makeReparto();
    const grupos = [makeGrupo({ repartos: [r] })];
    const k = codKey('LOMAS', r);
    const [g] = applyCodigoOverrides(grupos, { [k]: 'EDITADO' });
    expect(g.repartos[0].nombre).toBe('EDITADO');
  });

  it('no toca repartos cuya codKey no está en overrides', () => {
    const grupos = [makeGrupo()];
    const [g] = applyCodigoOverrides(grupos, { 'otra-key': 'EDITADO' });
    expect(g.repartos[0].nombre).toBe('BIG');
  });
});

describe('filterByCaso', () => {
  function makeGrupo(over: Partial<GrupoDireccion> = {}): GrupoDireccion {
    return { direccion: 'LOMAS', total_clientes_unicos: 1, repartos: [], ...over };
  }

  it('con 0 casos seleccionados, no filtra (devuelve los grupos tal cual)', () => {
    const repartos = [makeReparto({ caso: 'propia' }), makeReparto({ caso: 'sin_asignar', codigo_numerico: 2 })];
    const grupos = [makeGrupo({ repartos })];
    expect(filterByCaso(grupos, [])).toEqual(grupos);
  });

  it('con los 3 casos seleccionados, no filtra', () => {
    const repartos = [makeReparto({ caso: 'propia' })];
    const grupos = [makeGrupo({ repartos })];
    expect(filterByCaso(grupos, ['propia', 'sin_asignar', 'otra_biblia'])).toEqual(grupos);
  });

  it('con 1 o 2 casos seleccionados, filtra los repartos que no matchean', () => {
    const propia = makeReparto({ caso: 'propia' });
    const sinAsignar = makeReparto({ caso: 'sin_asignar', codigo_numerico: 2 });
    const grupos = [makeGrupo({ repartos: [propia, sinAsignar] })];
    const [g] = filterByCaso(grupos, ['propia']);
    expect(g.repartos).toEqual([propia]);
  });

  it('si un grupo queda sin repartos tras filtrar, se excluye del resultado', () => {
    const grupos = [makeGrupo({ repartos: [makeReparto({ caso: 'otra_biblia' })] })];
    expect(filterByCaso(grupos, ['propia'])).toEqual([]);
  });
});

describe('filterByBiblia', () => {
  function makeGrupo(over: Partial<GrupoDireccion> = {}): GrupoDireccion {
    return { direccion: 'LOMAS', total_clientes_unicos: 1, repartos: [], ...over };
  }

  it('sin fechas seleccionadas, no filtra', () => {
    const repartos = [makeReparto({ biblia_fecha_asignada: '2026-07-10' })];
    const grupos = [makeGrupo({ repartos })];
    expect(filterByBiblia(grupos, [])).toEqual(grupos);
  });

  it('"_sin" incluye solo los repartos sin fecha de biblia asignada', () => {
    const sinFecha = makeReparto({ biblia_fecha_asignada: null });
    const conFecha = makeReparto({ biblia_fecha_asignada: '2026-07-10', codigo_numerico: 2 });
    const grupos = [makeGrupo({ repartos: [sinFecha, conFecha] })];
    const [g] = filterByBiblia(grupos, ['_sin']);
    expect(g.repartos).toEqual([sinFecha]);
  });

  it('una fecha específica incluye solo los repartos de esa fecha (no "_sin" ni otras)', () => {
    const del10 = makeReparto({ biblia_fecha_asignada: '2026-07-10' });
    const del11 = makeReparto({ biblia_fecha_asignada: '2026-07-11', codigo_numerico: 2 });
    const sinFecha = makeReparto({ biblia_fecha_asignada: null, codigo_numerico: 3 });
    const grupos = [makeGrupo({ repartos: [del10, del11, sinFecha] })];
    const [g] = filterByBiblia(grupos, ['2026-07-10']);
    expect(g.repartos).toEqual([del10]);
  });

  it('combina "_sin" y fechas específicas', () => {
    const del10 = makeReparto({ biblia_fecha_asignada: '2026-07-10' });
    const del11 = makeReparto({ biblia_fecha_asignada: '2026-07-11', codigo_numerico: 2 });
    const sinFecha = makeReparto({ biblia_fecha_asignada: null, codigo_numerico: 3 });
    const grupos = [makeGrupo({ repartos: [del10, del11, sinFecha] })];
    const [g] = filterByBiblia(grupos, ['_sin', '2026-07-10']);
    expect(g.repartos).toEqual([del10, sinFecha]);
  });

  it('si un grupo queda sin repartos tras filtrar, se excluye del resultado', () => {
    const grupos = [makeGrupo({ repartos: [makeReparto({ biblia_fecha_asignada: '2026-07-10' })] })];
    expect(filterByBiblia(grupos, ['2026-07-11'])).toEqual([]);
  });
});

describe('choferGrupoKeyPorCaso / choferGrupoKeyPorBiblia', () => {
  it('choferGrupoKeyPorCaso agrupa por chofer + caso (ignora la fecha de biblia)', () => {
    const a = makeReparto({ chofer_nombre: 'García', caso: 'propia', biblia_fecha_asignada: '2026-07-10' });
    const b = makeReparto({ chofer_nombre: 'García', caso: 'propia', biblia_fecha_asignada: '2026-07-11' });
    expect(choferGrupoKeyPorCaso(a)).toBe(choferGrupoKeyPorCaso(b));
  });

  it('choferGrupoKeyPorCaso distingue por caso, mismo chofer', () => {
    const a = makeReparto({ chofer_nombre: 'García', caso: 'propia' });
    const b = makeReparto({ chofer_nombre: 'García', caso: 'otra_biblia' });
    expect(choferGrupoKeyPorCaso(a)).not.toBe(choferGrupoKeyPorCaso(b));
  });

  it('choferGrupoKeyPorBiblia agrupa por chofer + fecha de biblia (ignora el caso)', () => {
    const a = makeReparto({ chofer_nombre: 'García', caso: 'propia', biblia_fecha_asignada: '2026-07-10' });
    const b = makeReparto({ chofer_nombre: 'García', caso: 'otra_biblia', biblia_fecha_asignada: '2026-07-10' });
    expect(choferGrupoKeyPorBiblia(a)).toBe(choferGrupoKeyPorBiblia(b));
  });

  it('choferGrupoKeyPorBiblia distingue por fecha, mismo chofer, y usa "_sin" si no tiene fecha', () => {
    const conFecha = makeReparto({ chofer_nombre: 'García', biblia_fecha_asignada: '2026-07-10' });
    const sinFecha = makeReparto({ chofer_nombre: 'García', biblia_fecha_asignada: null });
    expect(choferGrupoKeyPorBiblia(conFecha)).not.toBe(choferGrupoKeyPorBiblia(sinFecha));
    expect(choferGrupoKeyPorBiblia(sinFecha)).toBe('García||_sin');
  });
});

describe('buildChoferGrupos', () => {
  it('suma correctamente los totales cuando hay más de un reparto por clave', () => {
    const repartos = [
      makeReparto({ tipo_agrupa_direccion: 1, tipo_consolidado: 3, tipo_individual: 2, total_importe: 1000, total_pedidos: 3, total_clientes: 2 }),
      makeReparto({ codigo_numerico: 2, tipo_agrupa_direccion: 1, tipo_consolidado: 2, tipo_individual: 0, total_importe: 500, total_pedidos: 1, total_clientes: 1 }),
    ];
    const [g] = buildChoferGrupos(repartos, () => 'misma-clave');
    expect(g.tipo_agrupa_direccion).toBe(2);
    expect(g.tipo_consolidado).toBe(5);
    expect(g.tipo_individual).toBe(2);
    expect(g.total_importe).toBe(1500);
    expect(g.total_pedidos).toBe(4);
    expect(g.total_clientes).toBe(3);
  });

  it('agrupa por clave: misma clave concatena, distinta clave separa', () => {
    const repartos = [
      makeReparto({ chofer_nombre: 'García' }),
      makeReparto({ chofer_nombre: 'López', codigo_numerico: 2 }),
    ];
    const grupos = buildChoferGrupos(repartos, r => r.chofer_nombre);
    expect(grupos).toHaveLength(2);
    expect(grupos[0].codigos).toHaveLength(1);
    expect(grupos[1].codigos).toHaveLength(1);
  });
});
