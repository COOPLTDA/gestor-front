import { describe, it, expect } from 'vitest';
import type { Preparacion, Pedido, Chofer, CodigoDespacho, RepartoExcepcional } from '../types/biblia';
import {
  computeEstados,
  nextBusinessDay,
  prevBusinessDay,
  selectAsignacionesBiblia,
  selectSigmaEstadoByPrepId,
  selectPedidoCambiosByPrepId,
  selectAsignacionCrossCodeByPrepId,
  selectOcupadasEnOtraBiblia,
  selectCodigosDespachoSet,
  selectCodigosDespachoByChofer,
  selectNombresRepartosZona,
  selectPreparacionesFiltradas,
  selectChoferesPorCodigo,
  selectChoferesPorCodigoExcepcion,
  type AsignacionRaw,
} from './bibliaSelectors';

function pedido(partial: Partial<Pedido> = {}): Pedido {
  return {
    codigo: 'PED-1',
    codigo_despacho: 'BIG',
    codigo_cliente_ubicacion: null,
    cliente_nombre: null,
    cliente_direccion: null,
    cliente_lat: null,
    cliente_lng: null,
    estado: 'Pendiente',
    importe: 100,
    peso_text: null,
    volumen_text: null,
    peso: 1,
    volumen: 1,
    fecha: '2026-07-01',
    ...partial,
  };
}

function preparacion(partial: Partial<Preparacion> = {}): Preparacion {
  return {
    id: 1,
    tipo: 'Pedidos individuales',
    estado: 'Pendiente',
    codigo_envio: null,
    pedidos: [pedido()],
    cantidad_pedidos: 1,
    cantidad_clientes: 1,
    importe_total: 100,
    peso: 1,
    volumen: 1,
    peso_text: '1',
    volumen_text: '1',
    ...partial,
  };
}

function asignacion(partial: Partial<AsignacionRaw> = {}): AsignacionRaw {
  return {
    preparacion_id: 1,
    chofer_codigo: 'GRC',
    biblia_fecha: '2026-07-10',
    preparacion_fecha: '2026-07-09',
    ...partial,
  };
}

describe('computeEstados', () => {
  it('ordena según ORDER_ESTADOS sin importar mayúsculas/minúsculas', () => {
    const preps = [preparacion({ estado: 'completada' }), preparacion({ estado: 'Pendiente' }), preparacion({ estado: 'Remitido' })];
    expect(computeEstados(preps)).toEqual(['Pendiente', 'completada', 'Remitido']);
  });

  it('deduplica y deja los estados desconocidos al final, ordenados alfabéticamente', () => {
    const preps = [preparacion({ estado: 'Zeta' }), preparacion({ estado: 'Pendiente' }), preparacion({ estado: 'Zeta' }), preparacion({ estado: 'Alfa' })];
    expect(computeEstados(preps)).toEqual(['Pendiente', 'Alfa', 'Zeta']);
  });

  it('ignora preparaciones sin estado', () => {
    expect(computeEstados([preparacion({ estado: null })])).toEqual([]);
  });

  it('respeta el orden completo de ORDER_ESTADOS con los 6 valores', () => {
    const preps = [
      preparacion({ estado: 'Eliminado' }),
      preparacion({ estado: 'Remitido' }),
      preparacion({ estado: 'Completo' }),
      preparacion({ estado: 'Completada' }),
      preparacion({ estado: 'En preparacion' }),
      preparacion({ estado: 'Pendiente' }),
    ];
    expect(computeEstados(preps)).toEqual(['Pendiente', 'En preparacion', 'Completada', 'Completo', 'Remitido', 'Eliminado']);
  });

  it('"Eliminado" (conocido, último en ORDER_ESTADOS) sigue yendo antes que un estado desconocido', () => {
    // Si "Eliminado" dejara de reconocerse como conocido, caería a ordenar alfabéticamente
    // junto a "Alfa" (desconocido) y quedaría ANTES de "Alfa", no después.
    const preps = [preparacion({ estado: 'Alfa' }), preparacion({ estado: 'Pendiente' }), preparacion({ estado: 'Eliminado' })];
    expect(computeEstados(preps)).toEqual(['Pendiente', 'Eliminado', 'Alfa']);
  });
});

describe('nextBusinessDay / prevBusinessDay', () => {
  it('nextBusinessDay salta el fin de semana', () => {
    // 2026-07-10 es viernes
    expect(nextBusinessDay('2026-07-10')).toBe('2026-07-13');
  });

  it('nextBusinessDay en un día de semana normal solo avanza un día', () => {
    expect(nextBusinessDay('2026-07-06')).toBe('2026-07-07'); // lunes -> martes
  });

  it('prevBusinessDay salta el fin de semana hacia atrás', () => {
    // 2026-07-13 es lunes
    expect(prevBusinessDay('2026-07-13')).toBe('2026-07-10');
  });
});

describe('selectAsignacionesBiblia', () => {
  it('solo incluye asignaciones de la biblia_fecha pedida', () => {
    const raw = [asignacion({ preparacion_id: 1, biblia_fecha: '2026-07-10' }), asignacion({ preparacion_id: 2, biblia_fecha: '2026-07-11' })];
    const map = selectAsignacionesBiblia(raw, '2026-07-10');
    expect(map.get(1)).toBe('GRC');
    expect(map.has(2)).toBe(false);
  });
});

describe('selectSigmaEstadoByPrepId', () => {
  it('ignora no_aplica', () => {
    const raw = [asignacion({ sigma_sync_estado: 'no_aplica' })];
    expect(selectSigmaEstadoByPrepId(raw, [], '2026-07-10').size).toBe(0);
  });

  it('prioriza fallido/bloqueado por sobre pendiente y ok (regresión de reasignación cruzada)', () => {
    const raw = [asignacion({ preparacion_id: 1, sigma_sync_estado: 'pendiente' })];
    const cambios = [{ preparacion_id: 1, estado: 'fallido' as const }];
    expect(selectSigmaEstadoByPrepId(raw, cambios, '2026-07-10').get(1)).toBe('fallido');
  });

  it('no mezcla asignaciones de otra biblia_fecha', () => {
    const raw = [asignacion({ preparacion_id: 1, biblia_fecha: '2026-07-11', sigma_sync_estado: 'ok' })];
    expect(selectSigmaEstadoByPrepId(raw, [], '2026-07-10').has(1)).toBe(false);
  });
});

describe('selectPedidoCambiosByPrepId', () => {
  it('agrupa varios cambios bajo la misma preparación', () => {
    const cambios = [{ preparacion_id: 1, x: 'a' }, { preparacion_id: 1, x: 'b' }, { preparacion_id: 2, x: 'c' }];
    const map = selectPedidoCambiosByPrepId(cambios);
    expect(map.get(1)).toHaveLength(2);
    expect(map.get(2)).toHaveLength(1);
  });
});

describe('selectAsignacionCrossCodeByPrepId', () => {
  const codigos: CodigoDespacho[] = [{ id: 150, nombre: 'VI HPC 1', desactivado: 0, direccion: null }];

  it('resuelve destino_nombre buscando el id de Sigma entre los códigos de despacho', () => {
    const raw = [asignacion({ preparacion_id: 1, codigo_despacho_destino: '150', sigma_sync_estado: 'ok' })];
    const map = selectAsignacionCrossCodeByPrepId(raw, '2026-07-10', codigos);
    expect(map.get(1)).toEqual({ destino_nombre: 'VI HPC 1', destino_id: '150', sigma_sync_estado: 'ok' });
  });

  it('omite asignaciones sin destino o con estado no_aplica', () => {
    const raw = [
      asignacion({ preparacion_id: 1, codigo_despacho_destino: null, sigma_sync_estado: 'ok' }),
      asignacion({ preparacion_id: 2, codigo_despacho_destino: '150', sigma_sync_estado: 'no_aplica' }),
    ];
    expect(selectAsignacionCrossCodeByPrepId(raw, '2026-07-10', codigos).size).toBe(0);
  });
});

describe('selectOcupadasEnOtraBiblia', () => {
  it('incluye una preparación asignada a otra biblia_fecha con chofer', () => {
    const raw = [asignacion({ preparacion_id: 1, biblia_fecha: '2026-07-11', chofer_codigo: 'GRC' })];
    expect(selectOcupadasEnOtraBiblia(raw, '2026-07-10').get(1)).toBe('2026-07-11');
  });

  it('ignora asignaciones legacy sin chofer o sin biblia_fecha', () => {
    const raw = [
      asignacion({ preparacion_id: 1, biblia_fecha: '2026-07-11', chofer_codigo: '' }),
      asignacion({ preparacion_id: 2, biblia_fecha: '', chofer_codigo: 'GRC' }),
    ];
    expect(selectOcupadasEnOtraBiblia(raw, '2026-07-10').size).toBe(0);
  });
});

describe('selectCodigosDespachoSet', () => {
  it('solo toma códigos de tipos visibles', () => {
    const preps = [
      preparacion({ tipo: 'Pedidos individuales', pedidos: [pedido({ codigo_despacho: 'BIG' })] }),
      preparacion({ tipo: 'Agrupa por direccion de entrega', pedidos: [pedido({ codigo: 'P2', codigo_despacho: 'AGRUPA' })] }),
      preparacion({ tipo: 'Consolidado de pedidos', pedidos: [pedido({ codigo: 'P3', codigo_despacho: 'CONSOL' })] }),
      preparacion({ tipo: 'Tipo no listado', pedidos: [pedido({ codigo: 'P4', codigo_despacho: 'OCULTO' })] }),
    ];
    const set = selectCodigosDespachoSet(preps);
    expect(set).toEqual(new Set(['BIG', 'AGRUPA', 'CONSOL']));
  });

  it('ignora pedidos sin codigo_despacho (falsy) dentro de un tipo visible', () => {
    const preps = [
      preparacion({
        tipo: 'Pedidos individuales',
        pedidos: [pedido({ codigo_despacho: null }), pedido({ codigo: 'P2', codigo_despacho: 'BIG' })],
      }),
    ];
    const set = selectCodigosDespachoSet(preps);
    expect(set).toEqual(new Set(['BIG']));
  });
});

describe('selectCodigosDespachoByChofer', () => {
  it('incluye repartos permanentes activos y agrega repartos excepcionales como virtuales', () => {
    const codigos: CodigoDespacho[] = [{ id: 1, nombre: 'BIG', desactivado: 0, direccion: null, choferes: ['GRC'] }];
    const excepciones: RepartoExcepcional[] = [{ id: 9, chofer_codigo: 'LOP', chofer_nombre: 'López', codigo_reparto: 'CENTRO', codigo_despacho_id: '5', fecha: '2026-07-10' }];
    const map = selectCodigosDespachoByChofer(codigos, new Set(['BIG']), excepciones);
    expect(map.get('GRC')?.map(c => c.nombre)).toEqual(['BIG']);
    expect(map.get('LOP')?.[0]).toMatchObject({ nombre: 'CENTRO', es_excepcion: true, excepcion_id: 9 });
  });

  it('excluye códigos desactivados o que no están en el set visible', () => {
    const codigos: CodigoDespacho[] = [
      { id: 1, nombre: 'BIG', desactivado: 1, direccion: null, choferes: ['GRC'] },
      { id: 2, nombre: 'FUERA_DE_SET', desactivado: 0, direccion: null, choferes: ['GRC'] },
    ];
    const map = selectCodigosDespachoByChofer(codigos, new Set(['BIG']), []);
    expect(map.has('GRC')).toBe(false);
  });
});

describe('selectNombresRepartosZona', () => {
  it('devuelve null cuando no hay zonas seleccionadas (sin filtro)', () => {
    expect(selectNombresRepartosZona([], [])).toBeNull();
  });

  it('filtra los códigos de despacho por zona_id', () => {
    const codigos: CodigoDespacho[] = [
      { id: 1, nombre: 'BIG', desactivado: 0, direccion: null, zona_id: 5 },
      { id: 2, nombre: 'CENTRO', desactivado: 0, direccion: null, zona_id: 6 },
    ];
    expect(selectNombresRepartosZona(codigos, [5])).toEqual(new Set(['BIG']));
  });
});

describe('selectPreparacionesFiltradas', () => {
  it('filtra por estado seleccionado', () => {
    const preps = [preparacion({ id: 1, estado: 'Pendiente' }), preparacion({ id: 2, estado: 'Completada' })];
    const result = selectPreparacionesFiltradas(preps, null, ['Completada']);
    expect(result.map(p => p.id)).toEqual([2]);
  });

  it('sin estados seleccionados no filtra por estado', () => {
    const preps = [preparacion({ id: 1, estado: 'Pendiente' }), preparacion({ id: 2, estado: 'Completada' })];
    expect(selectPreparacionesFiltradas(preps, null, [])).toHaveLength(2);
  });

  it('ordena según ORDER_ESTADOS', () => {
    const preps = [preparacion({ id: 1, estado: 'Remitido' }), preparacion({ id: 2, estado: 'Pendiente' })];
    expect(selectPreparacionesFiltradas(preps, null, []).map(p => p.id)).toEqual([2, 1]);
  });

  it('filtra por zona cuando se pasa un set de nombres', () => {
    const preps = [
      preparacion({ id: 1, pedidos: [pedido({ codigo_despacho: 'BIG' })] }),
      preparacion({ id: 2, pedidos: [pedido({ codigo_despacho: 'CENTRO' })] }),
    ];
    expect(selectPreparacionesFiltradas(preps, new Set(['BIG']), []).map(p => p.id)).toEqual([1]);
  });
});

describe('selectChoferesPorCodigo', () => {
  it('excluye choferes desactivados', () => {
    const choferes: Chofer[] = [{ codigo: 'GRC', descripcion: 'García', desactivado: 0 }, { codigo: 'INA', descripcion: 'Inactivo', desactivado: 1 }];
    const codigos: CodigoDespacho[] = [{ id: 1, nombre: 'BIG', desactivado: 0, direccion: null, choferes: ['GRC', 'INA'] }];
    expect(selectChoferesPorCodigo(codigos, choferes).get('BIG')).toEqual(['GRC']);
  });

  it('no incluye el código si ningún chofer activo lo atiende', () => {
    const choferes: Chofer[] = [{ codigo: 'INA', descripcion: 'Inactivo', desactivado: 1 }];
    const codigos: CodigoDespacho[] = [{ id: 1, nombre: 'BIG', desactivado: 0, direccion: null, choferes: ['INA'] }];
    expect(selectChoferesPorCodigo(codigos, choferes).has('BIG')).toBe(false);
  });
});

describe('selectChoferesPorCodigoExcepcion', () => {
  it('agrupa choferes por código de reparto excepcional', () => {
    const excepciones: RepartoExcepcional[] = [
      { id: 1, chofer_codigo: 'GRC', chofer_nombre: 'García', codigo_reparto: 'CENTRO', codigo_despacho_id: '5', fecha: '2026-07-10' },
      { id: 2, chofer_codigo: 'LOP', chofer_nombre: 'López', codigo_reparto: 'CENTRO', codigo_despacho_id: '5', fecha: '2026-07-10' },
    ];
    expect(selectChoferesPorCodigoExcepcion(excepciones).get('CENTRO')).toEqual(['GRC', 'LOP']);
  });
});

// --- Refuerzos de mutation testing: comparadores, prioridades y bordes ---

function codigoDespacho(partial: Partial<CodigoDespacho> = {}): CodigoDespacho {
  return {
    id: 151,
    nombre: 'BIG',
    desactivado: 0,
    direccion: null,
    ...partial,
  };
}

describe('computeEstados — orden del comparador', () => {
  it('un estado conocido va antes que uno desconocido, en ambas direcciones', () => {
    // "Aaa Rara" empieza con "A", antes que "Remitido" alfabéticamente: si el comparador
    // no forzara "conocido primero" y cayera al localeCompare, el orden se invertiría.
    expect(computeEstados([
      preparacion({ id: 1, estado: 'Aaa Rara' }),
      preparacion({ id: 2, estado: 'Remitido' }),
    ])).toEqual(['Remitido', 'Aaa Rara']);
    expect(computeEstados([
      preparacion({ id: 1, estado: 'Remitido' }),
      preparacion({ id: 2, estado: 'Aaa Rara' }),
    ])).toEqual(['Remitido', 'Aaa Rara']);
  });

  it('dos desconocidos se ordenan alfabéticamente', () => {
    expect(computeEstados([
      preparacion({ id: 1, estado: 'zzz' }),
      preparacion({ id: 2, estado: 'aaa' }),
    ])).toEqual(['aaa', 'zzz']);
  });

  it('el orden conocido es case-insensitive (toLowerCase)', () => {
    expect(computeEstados([
      preparacion({ id: 1, estado: 'REMITIDO' }),
      preparacion({ id: 2, estado: 'COMPLETADA' }),
    ])).toEqual(['COMPLETADA', 'REMITIDO']);
  });
});

describe('selectSigmaEstadoByPrepId — empates de prioridad', () => {
  it('ante prioridades iguales gana el primero (fallido no es pisado por bloqueado)', () => {
    const map = selectSigmaEstadoByPrepId(
      [
        asignacion({ preparacion_id: 1, sigma_sync_estado: 'fallido' }),
      ],
      [{ preparacion_id: 1, estado: 'bloqueado' as never }],
      '2026-07-10',
    );
    expect(map.get(1)).toBe('fallido');
  });

  it('un estado de mayor prioridad sí reemplaza al anterior', () => {
    const map = selectSigmaEstadoByPrepId(
      [asignacion({ preparacion_id: 1, sigma_sync_estado: 'ok' })],
      [{ preparacion_id: 1, estado: 'pendiente' as never }],
      '2026-07-10',
    );
    expect(map.get(1)).toBe('pendiente');
  });

  it('ignora asignaciones de otra biblia y estados no_aplica', () => {
    const map = selectSigmaEstadoByPrepId(
      [
        asignacion({ preparacion_id: 1, sigma_sync_estado: 'ok', biblia_fecha: '2000-01-01' }),
        asignacion({ preparacion_id: 2, sigma_sync_estado: 'no_aplica' }),
      ],
      [],
      '2026-07-10',
    );
    expect(map.size).toBe(0);
  });
});

describe('selectAsignacionCrossCodeByPrepId — bordes', () => {
  it('destino_nombre queda null si el código no existe en la lista', () => {
    const map = selectAsignacionCrossCodeByPrepId(
      [asignacion({ preparacion_id: 1, codigo_despacho_destino: '999', sigma_sync_estado: 'pendiente' })],
      '2026-07-10',
      [codigoDespacho({ id: 151, nombre: 'BIG' })],
    );
    expect(map.get(1)).toEqual({ destino_nombre: null, destino_id: '999', sigma_sync_estado: 'pendiente' });
  });

  it('excluye otra biblia, sin destino y no_aplica', () => {
    const map = selectAsignacionCrossCodeByPrepId(
      [
        asignacion({ preparacion_id: 1, codigo_despacho_destino: '151', sigma_sync_estado: 'ok', biblia_fecha: '2000-01-01' }),
        asignacion({ preparacion_id: 2, codigo_despacho_destino: null, sigma_sync_estado: 'ok' }),
        asignacion({ preparacion_id: 3, codigo_despacho_destino: '151', sigma_sync_estado: 'no_aplica' }),
      ],
      '2026-07-10',
      [codigoDespacho({ id: 151, nombre: 'BIG' })],
    );
    expect(map.size).toBe(0);
  });
});

describe('selectCodigosDespachoByChofer — bordes', () => {
  it('devuelve exactamente los choferes con códigos (sin claves fantasma)', () => {
    const map = selectCodigosDespachoByChofer(
      [codigoDespacho({ id: 151, nombre: 'BIG', choferes: undefined })],
      new Set(['BIG']),
      [],
    );
    expect([...map.keys()]).toEqual([]);
  });

  it('la excepción sin codigo_despacho_id usa el id sintético ex-<id>', () => {
    const map = selectCodigosDespachoByChofer(
      [],
      new Set(),
      [{ id: 7, chofer_codigo: 'CH1', chofer_nombre: 'López', codigo_reparto: 'RUTA X', codigo_despacho_id: '', fecha: '2026-07-10' }],
    );
    expect(map.get('CH1')![0].id).toBe('ex-7');
  });

  it('la excepción con codigo_despacho_id lo usa como id', () => {
    const map = selectCodigosDespachoByChofer(
      [],
      new Set(),
      [{ id: 7, chofer_codigo: 'CH1', chofer_nombre: 'López', codigo_reparto: 'RUTA X', codigo_despacho_id: '150', fecha: '2026-07-10' }],
    );
    expect(map.get('CH1')![0]).toMatchObject({ id: '150', nombre: 'RUTA X', es_excepcion: true, excepcion_id: 7 });
  });
});

describe('selectPreparacionesFiltradas — bordes', () => {
  it('estado null con filtro activo queda excluido', () => {
    const r = selectPreparacionesFiltradas(
      [preparacion({ id: 1, estado: null })],
      null,
      ['Completada'],
    );
    expect(r).toEqual([]);
  });

  it('alcanza con que UN pedido esté en la zona (some, no every)', () => {
    const r = selectPreparacionesFiltradas(
      [preparacion({
        id: 1,
        pedidos: [pedido({ codigo_despacho: 'BIG' }), pedido({ codigo: 'P2', codigo_despacho: 'OTRA' })],
      })],
      new Set(['BIG']),
      [],
    );
    expect(r.map(p => p.id)).toEqual([1]);
  });

  it('ordena por estado conocido y deja los desconocidos después, estable', () => {
    // "Aaa Rarísimo" es alfabéticamente anterior a "Completada"/"Pendiente": si el comparador
    // no forzara "conocido primero" y cayera al criterio de desempate, quedaría primero.
    const r = selectPreparacionesFiltradas(
      [
        preparacion({ id: 1, estado: 'Aaa Rarísimo' }),
        preparacion({ id: 2, estado: 'Completada' }),
        preparacion({ id: 3, estado: 'Pendiente' }),
      ],
      null,
      [],
    );
    expect(r.map(p => p.id)).toEqual([3, 2, 1]);
  });

  it('el orden por estado es case-insensitive', () => {
    const r = selectPreparacionesFiltradas(
      [
        preparacion({ id: 1, estado: 'REMITIDO' }),
        preparacion({ id: 2, estado: 'PENDIENTE' }),
      ],
      null,
      [],
    );
    expect(r.map(p => p.id)).toEqual([2, 1]);
  });

  it('el orden por estado es case-insensitive incluso con 3+ estados en mayúsculas desordenados', () => {
    const r = selectPreparacionesFiltradas(
      [
        preparacion({ id: 1, estado: 'ELIMINADO' }),
        preparacion({ id: 2, estado: 'COMPLETO' }),
        preparacion({ id: 3, estado: 'PENDIENTE' }),
        preparacion({ id: 4, estado: 'REMITIDO' }),
      ],
      null,
      [],
    );
    expect(r.map(p => p.id)).toEqual([3, 2, 4, 1]);
  });

  it('un estado conocido en el índice 1 ("En preparacion") sigue yendo antes que uno desconocido', () => {
    // Regresión de un mutante que cambia el chequeo "!== -1" a "!== +1": con índice 1 (que
    // sí es distinto de -1 pero es igual a +1) el comparador dejaría de reconocerlo como
    // conocido y lo trataría como desconocido.
    const r = selectPreparacionesFiltradas(
      [
        preparacion({ id: 1, estado: 'Zzz Desconocido' }),
        preparacion({ id: 2, estado: 'En preparacion' }),
      ],
      null,
      [],
    );
    expect(r.map(p => p.id)).toEqual([2, 1]);
  });

  it('con exactamente 2 elementos, desconocido primero y conocido segundo, el conocido pasa adelante', () => {
    const r = selectPreparacionesFiltradas(
      [
        preparacion({ id: 1, estado: 'Zzz Desconocido' }),
        preparacion({ id: 2, estado: 'Pendiente' }),
      ],
      null,
      [],
    );
    expect(r.map(p => p.id)).toEqual([2, 1]);
  });

  it('3 elementos con comparaciones mixtas (conocido/conocido, conocido/desconocido, desconocido/desconocido)', () => {
    // Fuerza que el comparador de sort se invoque con las 3 combinaciones posibles de
    // (conocido, desconocido) en ambos órdenes, para que Stryker cubra cada rama.
    const r = selectPreparacionesFiltradas(
      [
        preparacion({ id: 1, estado: 'Zzz Desconocido' }),
        preparacion({ id: 2, estado: 'Completada' }),
        preparacion({ id: 3, estado: 'Pendiente' }),
        preparacion({ id: 4, estado: 'Aaa Desconocido' }),
      ],
      null,
      [],
    );
    // Entre desconocidos no hay desempate alfabético (a diferencia de computeEstados):
    // el comparador devuelve 0 y el sort estable conserva el orden original (id1 antes que id4).
    expect(r.map(p => p.id)).toEqual([3, 2, 1, 4]);
  });

  it('dos estados conocidos donde el primero es índice 1 ("En preparacion") se ordenan por índice, no por posición original', () => {
    // Regresión de un mutante que cambia "ea !== -1" a "ea !== +1" en el chequeo combinado:
    // con ea=1 (índice de "En preparacion") ese chequeo daría false y el par nunca entraría
    // a comparar por índice numérico.
    const r = selectPreparacionesFiltradas(
      [
        preparacion({ id: 1, estado: 'En preparacion' }),
        preparacion({ id: 2, estado: 'Pendiente' }),
      ],
      null,
      [],
    );
    expect(r.map(p => p.id)).toEqual([2, 1]);
  });
});

describe('selectChoferesPorCodigo — bordes', () => {
  it('un código atendido solo por choferes inactivos no aparece en el mapa', () => {
    const map = selectChoferesPorCodigo(
      [codigoDespacho({ id: 151, nombre: 'BIG', choferes: ['CH1'] })],
      [{ codigo: 'CH1', descripcion: 'López', desactivado: 1 }],
    );
    expect(map.has('BIG')).toBe(false);
  });

  it('códigos sin lista de choferes no rompen ni aparecen', () => {
    const map = selectChoferesPorCodigo(
      [codigoDespacho({ id: 151, nombre: 'BIG', choferes: undefined })],
      [{ codigo: 'CH1', descripcion: 'López', desactivado: 0 }],
    );
    expect(map.size).toBe(0);
  });

  it('un código con nombre null (no desactivado) no aparece en el mapa', () => {
    const map = selectChoferesPorCodigo(
      [codigoDespacho({ id: 151, nombre: null, choferes: ['CH1'] })],
      [{ codigo: 'CH1', descripcion: 'López', desactivado: 0 }],
    );
    expect(map.size).toBe(0);
  });

  it('un código activo con nombre no aparece filtrado (caso positivo, distingue de los dos anteriores)', () => {
    const map = selectChoferesPorCodigo(
      [codigoDespacho({ id: 151, nombre: 'BIG', desactivado: 0, choferes: ['CH1'] })],
      [{ codigo: 'CH1', descripcion: 'López', desactivado: 0 }],
    );
    expect(map.get('BIG')).toEqual(['CH1']);
  });
});
