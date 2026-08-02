import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PreparacionDetalleModal } from './PreparacionDetalleModal';
import { modificarPedido } from '@/services/bibliaApi';
import type { Preparacion, Pedido, CodigoDespacho } from '../types/biblia';

vi.mock('@/services/bibliaApi', () => ({
  modificarPedido: vi.fn(),
}));

const modificarMock = vi.mocked(modificarPedido);

function makePedido(over: Partial<Pedido> = {}): Pedido {
  return {
    codigo: 'P1',
    codigo_despacho: 'BIG',
    codigo_cliente_ubicacion: null,
    cliente_nombre: 'Cliente Uno',
    cliente_direccion: 'Calle Falsa 123',
    cliente_lat: null,
    cliente_lng: null,
    estado: 'Pendiente',
    pendiente_sigma: true,
    importe: 500,
    peso_text: '2 kg',
    volumen_text: null,
    peso: 2,
    volumen: 0,
    fecha: '2026-07-09',
    ...over,
  };
}

function makePrep(over: Partial<Preparacion> = {}): Preparacion {
  return {
    id: 7,
    tipo: 'Pedidos individuales',
    estado: 'Completada',
    codigo_envio: 'E-7',
    pedidos: [makePedido()],
    cantidad_pedidos: 1,
    cantidad_clientes: 1,
    importe_total: 500,
    peso: 2,
    volumen: 0,
    peso_text: '2 kg',
    volumen_text: '0',
    ...over,
  };
}

const CODIGOS: CodigoDespacho[] = [
  { id: 151, nombre: 'BIG', desactivado: 0, direccion: null },
  { id: 150, nombre: 'PERI 5', desactivado: 0, direccion: null },
];

function renderModal(over: Partial<Parameters<typeof PreparacionDetalleModal>[0]> = {}) {
  const props = {
    preparacion: makePrep(),
    open: true,
    onClose: vi.fn(),
    codigosDespacho: CODIGOS,
    onModificado: vi.fn(),
    bibliaFecha: '2026-07-10',
    ...over,
  };
  const utils = render(<PreparacionDetalleModal {...props} />);
  return { ...props, ...utils };
}

beforeEach(() => {
  vi.clearAllMocks();
  modificarMock.mockResolvedValue(undefined);
});

describe('PreparacionDetalleModal — vista', () => {
  it('muestra el encabezado con código de envío, totales y pedidos', () => {
    renderModal();
    expect(screen.getByText('E-7')).toBeInTheDocument();
    expect(screen.getByText('1 pedido')).toBeInTheDocument();
    expect(screen.getByText('1 cliente')).toBeInTheDocument();
    expect(screen.getAllByText('$ 500').length).toBeGreaterThan(0);
    expect(screen.getByText('P1')).toBeInTheDocument();
    expect(screen.getByText('Cliente Uno')).toBeInTheDocument();
    expect(screen.getByText('Calle Falsa 123')).toBeInTheDocument();
    expect(screen.getByText('· BIG')).toBeInTheDocument();
  });

  it('usa #id si no hay código de envío', () => {
    renderModal({ preparacion: makePrep({ codigo_envio: null }) });
    expect(screen.getByText('#7')).toBeInTheDocument();
  });

  it('en modo readonly no muestra el botón de editar', () => {
    renderModal({ readonly: true });
    expect(screen.queryByTitle('Modificar reparto')).not.toBeInTheDocument();
  });

  it('muestra el código y badge del cross-code de la preparación', () => {
    renderModal({
      asignacionCrossCode: { destino_nombre: 'PERI 5', sigma_sync_estado: 'pendiente' },
    });
    expect(screen.getByText('· PERI 5')).toBeInTheDocument();
    expect(screen.getByText('sigma')).toBeInTheDocument();
  });

  it('el cambio individual pisa al cross-code y muestra su estado', () => {
    renderModal({
      asignacionCrossCode: { destino_nombre: 'PERI 5', sigma_sync_estado: 'ok' },
      pedidoCambios: [{ pedido_codigo: 'P1', preparacion_id: 7, nuevo_codigo_despacho: 'BIG', estado: 'fallido' }],
    });
    expect(screen.getByText('sigma!')).toBeInTheDocument();
    expect(screen.getByText('· editá para reintentar')).toBeInTheDocument();
  });

  it('muestra el badge bloq para cambios bloqueados', () => {
    renderModal({
      pedidoCambios: [{ pedido_codigo: 'P1', preparacion_id: 7, nuevo_codigo_despacho: 'PERI 5', estado: 'bloqueado' as never }],
    });
    expect(screen.getByText('bloq')).toBeInTheDocument();
  });

  it('usa plural para pedidos y clientes cuando hay más de uno', () => {
    renderModal({ preparacion: makePrep({ cantidad_pedidos: 2, cantidad_clientes: 3 }) });
    expect(screen.getByText('2 pedidos')).toBeInTheDocument();
    expect(screen.getByText('3 clientes')).toBeInTheDocument();
  });

  it('usa plural para 0 pedidos/clientes (0 !== 1, solo 1 es singular)', () => {
    renderModal({ preparacion: makePrep({ cantidad_pedidos: 0, cantidad_clientes: 0 }) });
    expect(screen.getByText('0 pedidos')).toBeInTheDocument();
    expect(screen.getByText('0 clientes')).toBeInTheDocument();
  });

it('con peso 0, no muestra la sección de peso/volumen', () => {
    renderModal({ preparacion: makePrep({ peso: 0, peso_text: '0 kg', volumen_text: '0' }) });
    expect(screen.queryByText('0 kg / 0')).not.toBeInTheDocument();
  });

  it('con peso > 0, muestra peso_text y volumen_text de la preparación', () => {
    renderModal({ preparacion: makePrep({ peso: 5, peso_text: '5 kg', volumen_text: '3 m3' }) });
    expect(screen.getByText('5 kg / 3 m3')).toBeInTheDocument();
  });

  it('un pedido sin estado no renderiza ningún span.font-semibold de estado', () => {
    renderModal({ preparacion: makePrep({ pedidos: [makePedido({ estado: '' })] }) });
    const card = screen.getByText('P1').closest('.bg-muted\\/50')!;
    const contenedor = card.querySelector('.flex-wrap.gap-2')!;
    expect(contenedor.querySelector('span.font-semibold')).toBeNull();
  });

  it('un pedido sin peso_text/volumen_text no renderiza esos spans (estructuralmente, no solo el texto)', () => {
    renderModal({ preparacion: makePrep({ pedidos: [makePedido({ peso_text: null, volumen_text: null, codigo_despacho: null, estado: '' })] }) });
    const card = screen.getByText('P1').closest('.bg-muted\\/50')!;
    const contenedor = card.querySelector('.flex-wrap.gap-2')!;
    expect(contenedor.querySelectorAll('span').length).toBe(0);
  });

  it('un pedido sin cliente_nombre no renderiza ese párrafo (ni vacío)', () => {
    renderModal({ preparacion: makePrep({ pedidos: [makePedido({ cliente_nombre: null, cliente_direccion: null })] }) });
    const card = screen.getByText('P1').closest('.bg-muted\\/50')!;
    expect(card.querySelectorAll('p.text-muted-foreground.break-words').length).toBe(0);
  });

  it('un pedido sin cliente_direccion (con cliente_nombre) renderiza un solo párrafo de cliente', () => {
    renderModal({ preparacion: makePrep({ pedidos: [makePedido({ cliente_direccion: null })] }) });
    const card = screen.getByText('P1').closest('.bg-muted\\/50')!;
    const parrafos = card.querySelectorAll('p.text-muted-foreground.break-words');
    expect(parrafos.length).toBe(1);
    expect(parrafos[0].textContent).toBe('Cliente Uno');
  });

  it('un pedido con peso_text lo muestra como badge propio', () => {
    renderModal({ preparacion: makePrep({ pedidos: [makePedido({ peso_text: '2 kg' })] }) });
    const card = screen.getByText('P1').closest('.bg-muted\\/50')!;
    expect(card.querySelector('.flex-wrap.gap-2')!.textContent).toContain('2 kg');
  });

  it('un pedido con volumen_text lo muestra', () => {
    renderModal({ preparacion: makePrep({ pedidos: [makePedido({ volumen_text: '1.5 m3' })] }) });
    expect(screen.getByText('1.5 m3')).toBeInTheDocument();
  });

  it('un pedido sin código de despacho no muestra el span "· código"', () => {
    renderModal({ preparacion: makePrep({ pedidos: [makePedido({ codigo_despacho: null })] }) });
    expect(screen.queryByText('· BIG')).not.toBeInTheDocument();
  });

  it('efectivoEstado "ok" muestra el badge "sync"', () => {
    renderModal({
      pedidoCambios: [{ pedido_codigo: 'P1', preparacion_id: 7, nuevo_codigo_despacho: 'PERI 5', estado: 'ok' }],
    });
    expect(screen.getByText('sync')).toBeInTheDocument();
  });

  it('sin ningún estado efectivo, no muestra ningún badge de sync', () => {
    renderModal();
    expect(screen.queryByText('sigma')).not.toBeInTheDocument();
    expect(screen.queryByText('sync')).not.toBeInTheDocument();
    expect(screen.queryByText('sigma!')).not.toBeInTheDocument();
    expect(screen.queryByText('bloq')).not.toBeInTheDocument();
  });

  it('sin cambio de código (mismo código, solo cross-code informativo), el span no lleva color de alerta', () => {
    renderModal({
      preparacion: makePrep({ pedidos: [makePedido({ codigo_despacho: 'BIG' })] }),
      asignacionCrossCode: { destino_nombre: 'BIG', sigma_sync_estado: 'ok' },
    });
    const span = screen.getByText('· BIG');
    expect(span.className).toBe('');
  });

  it('con cambio de código y estado fallido, el span usa color rojo', () => {
    renderModal({
      pedidoCambios: [{ pedido_codigo: 'P1', preparacion_id: 7, nuevo_codigo_despacho: 'PERI 5', estado: 'fallido' }],
    });
    const span = screen.getByText('· PERI 5');
    expect(span.className).toContain('text-red-700');
  });

  it('con cambio de código y estado bloqueado, el span usa color rojo', () => {
    renderModal({
      pedidoCambios: [{ pedido_codigo: 'P1', preparacion_id: 7, nuevo_codigo_despacho: 'PERI 5', estado: 'bloqueado' as never }],
    });
    const span = screen.getByText('· PERI 5');
    expect(span.className).toContain('text-red-700');
  });

  it('con cambio de código y estado pendiente (no fallido/bloqueado), el span usa color ámbar', () => {
    renderModal({
      pedidoCambios: [{ pedido_codigo: 'P1', preparacion_id: 7, nuevo_codigo_despacho: 'PERI 5', estado: 'pendiente' }],
    });
    const span = screen.getByText('· PERI 5');
    expect(span.className).toContain('text-amber-700');
    expect(span.className).not.toContain('text-red-700');
  });

  it('con estado fallido pero SIN cambio de código real, no usa color rojo', () => {
    renderModal({
      asignacionCrossCode: { destino_nombre: 'BIG', sigma_sync_estado: 'fallido' },
      preparacion: makePrep({ pedidos: [makePedido({ codigo_despacho: 'BIG' })] }),
    });
    const span = screen.getByText('· BIG');
    expect(span.className).toBe('');
  });

  it('estado fallido en modo readonly no muestra "editá para reintentar"', () => {
    renderModal({
      readonly: true,
      pedidoCambios: [{ pedido_codigo: 'P1', preparacion_id: 7, nuevo_codigo_despacho: 'PERI 5', estado: 'fallido' }],
    });
    expect(screen.queryByText('· editá para reintentar')).not.toBeInTheDocument();
  });

  it('estado fallido proveniente solo del cross-code (sin serverCambio) no muestra "editá para reintentar"', () => {
    renderModal({
      asignacionCrossCode: { destino_nombre: 'PERI 5', sigma_sync_estado: 'fallido' },
    });
    expect(screen.getByText('sigma!')).toBeInTheDocument();
    expect(screen.queryByText('· editá para reintentar')).not.toBeInTheDocument();
  });

  it('el cambio individual (serverCambio) tiene prioridad sobre el cross-code al precargar el form de edición', () => {
    renderModal({
      asignacionCrossCode: { destino_nombre: 'PERI 5', sigma_sync_estado: 'ok' },
      pedidoCambios: [{ pedido_codigo: 'P1', preparacion_id: 7, nuevo_codigo_despacho: 'BIG', estado: 'ok' }],
    });
    fireEvent.click(screen.getByTitle('Modificar reparto'));
    expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('151'); // BIG, no PERI 5
  });

  it('el cross-code se usa para precargar el form si no hay cambio individual', () => {
    renderModal({ asignacionCrossCode: { destino_nombre: 'PERI 5', sigma_sync_estado: 'ok' } });
    fireEvent.click(screen.getByTitle('Modificar reparto'));
    expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('150'); // PERI 5
  });

  it('sin cross-code ni cambio individual, precarga con el código original del pedido', () => {
    renderModal();
    fireEvent.click(screen.getByTitle('Modificar reparto'));
    expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('151'); // BIG
  });
});

describe('PreparacionDetalleModal — edición de pedido', () => {
  it('abre el form de edición precargado con el código actual', () => {
    renderModal();
    fireEvent.click(screen.getByTitle('Modificar reparto'));
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.value).toBe('151'); // BIG
  });

  it('guarda la modificación y notifica', async () => {
    const { onModificado } = renderModal();
    fireEvent.click(screen.getByTitle('Modificar reparto'));
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '150' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(modificarMock).toHaveBeenCalledWith(
      'P1',
      { repartoId: 150, nuevoCodigo: 'PERI 5', fechaReparto: undefined, observacion: undefined },
      7,
      '2026-07-10',
    ));
    expect(onModificado).toHaveBeenCalled();
    expect(await screen.findByText('✓ Cambio guardado')).toBeInTheDocument();
    // el código efectivo local pasa a ser el nuevo
    expect(screen.getByText('· PERI 5')).toBeInTheDocument();
  });

  it('si la prep estaba asignada y cambió el código, desasigna y lo avisa', async () => {
    const onDesasignar = vi.fn();
    renderModal({ isAsignada: true, onDesasignarAlEditar: onDesasignar });
    fireEvent.click(screen.getByTitle('Modificar reparto'));
    expect(screen.getByText('Guardar desasignará esta preparación de su chofer.')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '150' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('✓ Cambio guardado — la preparación fue desasignada')).toBeInTheDocument();
    expect(onDesasignar).toHaveBeenCalled();
  });

  it('si no cambió el código, no desasigna', async () => {
    const onDesasignar = vi.fn();
    renderModal({ isAsignada: true, onDesasignarAlEditar: onDesasignar });
    fireEvent.click(screen.getByTitle('Modificar reparto'));
    fireEvent.change(screen.getByPlaceholderText('Agregar observación'), { target: { value: 'nota' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('✓ Cambio guardado')).toBeInTheDocument();
    expect(onDesasignar).not.toHaveBeenCalled();
    expect(modificarMock).toHaveBeenCalledWith(
      'P1',
      expect.objectContaining({ observacion: 'nota' }),
      7,
      '2026-07-10',
    );
  });

  it('permite editar la fecha de reparto', async () => {
    renderModal();
    fireEvent.click(screen.getByTitle('Modificar reparto'));
    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: '2026-07-15' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(modificarMock).toHaveBeenCalledWith(
      'P1',
      expect.objectContaining({ fechaReparto: '2026-07-15' }),
      7,
      '2026-07-10',
    ));
  });

  it('muestra el error si la API falla', async () => {
    modificarMock.mockRejectedValue(new Error('Sigma rechazó el cambio'));
    renderModal();
    fireEvent.click(screen.getByTitle('Modificar reparto'));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('Sigma rechazó el cambio')).toBeInTheDocument();
  });

  it('advierte cuando el pedido podría no estar Pendiente en Sigma', () => {
    renderModal({
      preparacion: makePrep({ pedidos: [makePedido({ pendiente_sigma: false })] }),
    });
    fireEvent.click(screen.getByTitle('Modificar reparto'));
    expect(screen.getByText(/podría no estar en estado Pendiente/)).toBeInTheDocument();
  });

  it('Cancelar cierra el form sin guardar', () => {
    renderModal();
    fireEvent.click(screen.getByTitle('Modificar reparto'));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(modificarMock).not.toHaveBeenCalled();
  });

  it('deseleccionar el reparto (volver a "Seleccionar código de despacho") guarda nuevoCodigo null', async () => {
    renderModal();
    fireEvent.click(screen.getByTitle('Modificar reparto'));
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(modificarMock).toHaveBeenCalledWith(
      'P1',
      { repartoId: undefined, nuevoCodigo: null, fechaReparto: undefined, observacion: undefined },
      7,
      '2026-07-10',
    ));
  });

  it('mientras guarda, muestra el spinner y deshabilita Guardar/Cancelar', async () => {
    let resolveModificar!: () => void;
    modificarMock.mockReturnValue(new Promise<void>(res => { resolveModificar = res; }));
    renderModal();
    fireEvent.click(screen.getByTitle('Modificar reparto'));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(screen.getByRole('button', { name: /Guardar/ })).toBeDisabled());
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();

    resolveModificar();
    await waitFor(() => expect(screen.queryByRole('combobox')).not.toBeInTheDocument());
  });

  it('si el rechazo no es un Error, usa el mensaje default', async () => {
    modificarMock.mockRejectedValue('boom');
    renderModal();
    fireEvent.click(screen.getByTitle('Modificar reparto'));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('Error al modificar pedido')).toBeInTheDocument();
  });

  it('sin error ni éxito, no muestra ningún banner', () => {
    renderModal();
    expect(screen.queryByText(/Cambio guardado|Error al modificar/)).not.toBeInTheDocument();
    expect(document.querySelector('.bg-red-50.border-red-200')).toBeNull();
  });

  it('tras un error, deja de mostrar el spinner y reactiva Guardar', async () => {
    modificarMock.mockRejectedValue(new Error('falló'));
    renderModal();
    fireEvent.click(screen.getByTitle('Modificar reparto'));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await screen.findByText('falló');
    expect(document.querySelector('.animate-spin')).toBeNull();
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeEnabled();
  });

  it('tras guardar, el pedido modificado pasa a mostrar el badge "sigma" (pendiente)', async () => {
    renderModal();
    fireEvent.click(screen.getByTitle('Modificar reparto'));
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '150' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await screen.findByText('· PERI 5');
    expect(screen.getByText('sigma')).toBeInTheDocument();
  });

  it('el badge visible respeta la prioridad: cambio individual pisa al cross-code también en la fila (no solo al precargar el form)', () => {
    renderModal({
      asignacionCrossCode: { destino_nombre: 'PERI 5', sigma_sync_estado: 'ok' },
      pedidoCambios: [{ pedido_codigo: 'P1', preparacion_id: 7, nuevo_codigo_despacho: 'BIG', estado: 'fallido' }],
    });
    expect(screen.getByText('· BIG')).toBeInTheDocument();
    expect(screen.queryByText('· PERI 5')).not.toBeInTheDocument();
    expect(screen.getByText('sigma!')).toBeInTheDocument();
  });
});
