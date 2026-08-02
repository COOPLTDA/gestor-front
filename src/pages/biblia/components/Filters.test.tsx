// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { Filters } from './Filters';

const TODAY = new Date().toISOString().slice(0, 10);

function renderFilters(over: Partial<Parameters<typeof Filters>[0]> = {}) {
  const props = {
    estados: ['Completada', 'Remitido'],
    estadosSeleccionados: [] as string[],
    onToggleEstado: vi.fn(),
    zonas: [
      { id: 1, nombre: 'LOMAS' },
      { id: 2, nombre: 'SUR' },
    ],
    zonasSeleccionadas: [] as number[],
    onToggleZona: vi.fn(),
    onSetZonas: vi.fn(),
    fechaDesde: '2026-07-01',
    fechaHasta: '2026-07-02',
    bibliaFecha: TODAY,
    onFechaDesdeChange: vi.fn(),
    onFechaHastaChange: vi.fn(),
    onBibliaFechaChange: vi.fn(),
    ...over,
  };
  const utils = render(<Filters {...props} />);
  return { ...props, ...utils };
}

beforeEach(() => vi.clearAllMocks());

function getDateInputs(container: HTMLElement): HTMLInputElement[] {
  return Array.from(container.querySelectorAll('input[type="date"]'));
}

describe('Filters — fechas de preparación', () => {
  it('no muestra el aviso de clamp antes de ningún cambio', () => {
    renderFilters();
    expect(screen.queryByText('Ajustada a la fecha máxima permitida')).not.toBeInTheDocument();
  });

  it('con una biblia futura, el máximo sigue siendo hoy (no la fecha de biblia)', () => {
    const manana = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const { onFechaHastaChange, container } = renderFilters({ bibliaFecha: manana });
    const inputs = getDateInputs(container);
    fireEvent.change(inputs[1], { target: { value: '2099-01-01' } });
    expect(onFechaHastaChange).toHaveBeenCalledWith(TODAY);
  });

  it('un segundo clamp cancela el timer del aviso anterior (no lo apaga antes de tiempo)', () => {
    vi.useFakeTimers();
    try {
      const { container } = renderFilters();
      const [desde] = getDateInputs(container);
      fireEvent.change(desde, { target: { value: '2099-01-01' } });
      act(() => { vi.advanceTimersByTime(2000); });
      // Segundo clamp a los 2s: reinicia el timer a 4s más desde acá.
      fireEvent.change(desde, { target: { value: '2099-02-02' } });
      act(() => { vi.advanceTimersByTime(2000); }); // total 4s desde el primer clamp
      // Si no se hubiera cancelado el timer viejo, el aviso ya habría desaparecido acá.
      expect(screen.getByText('Ajustada a la fecha máxima permitida')).toBeInTheDocument();
      act(() => { vi.advanceTimersByTime(2000); }); // total 4s desde el segundo clamp
      expect(screen.queryByText('Ajustada a la fecha máxima permitida')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('limpia el timer del aviso al desmontar', () => {
    vi.useFakeTimers();
    const clearSpy = vi.spyOn(global, 'clearTimeout');
    try {
      const { container, unmount } = renderFilters();
      const [desde] = getDateInputs(container);
      fireEvent.change(desde, { target: { value: '2099-01-01' } });
      clearSpy.mockClear();
      unmount();
      expect(clearSpy).toHaveBeenCalled();
    } finally {
      clearSpy.mockRestore();
      vi.useRealTimers();
    }
  });

  it('propaga un cambio de fecha desde válido', () => {
    const { onFechaDesdeChange, container } = renderFilters();
    const [desde] = getDateInputs(container);
    fireEvent.change(desde, { target: { value: '2026-06-25' } });
    expect(onFechaDesdeChange).toHaveBeenCalledWith('2026-06-25');
  });

  it('los inputs de fecha tienen el estilo esperado', () => {
    const { container } = renderFilters();
    const [desde] = getDateInputs(container);
    expect(desde.className).toContain('border-border');
    expect(desde.className).toContain('bg-white');
  });

  it('un valor exactamente igual al máximo no dispara el aviso de clamp', () => {
    const { onFechaDesdeChange, container } = renderFilters({ bibliaFecha: TODAY });
    const [desde] = getDateInputs(container);
    fireEvent.change(desde, { target: { value: TODAY } }); // === maxPrep, no > maxPrep
    expect(onFechaDesdeChange).toHaveBeenCalledWith(TODAY);
    expect(screen.queryByText('Ajustada a la fecha máxima permitida')).not.toBeInTheDocument();
  });

  it('un desde exactamente igual a hasta no arrastra hasta (no es "mayor que")', () => {
    const { onFechaHastaChange, container } = renderFilters({ fechaDesde: '2026-07-01', fechaHasta: '2026-07-02' });
    const [desde] = getDateInputs(container);
    fireEvent.change(desde, { target: { value: '2026-07-02' } }); // === fechaHasta, no > fechaHasta
    expect(onFechaHastaChange).not.toHaveBeenCalled();
  });

  it('un hasta exactamente igual a desde no arrastra desde (no es "menor que")', () => {
    const { onFechaDesdeChange, container } = renderFilters({ fechaDesde: '2026-07-01', fechaHasta: '2026-07-02' });
    const inputs = getDateInputs(container);
    fireEvent.change(inputs[1], { target: { value: '2026-07-01' } }); // === fechaDesde, no < fechaDesde
    expect(onFechaDesdeChange).not.toHaveBeenCalled();
  });

  it('ignora un valor vacío también en el input hasta', () => {
    const { onFechaHastaChange, container } = renderFilters();
    const inputs = getDateInputs(container);
    fireEvent.change(inputs[1], { target: { value: '' } });
    expect(onFechaHastaChange).not.toHaveBeenCalled();
  });

  it('un valor de hasta exactamente igual al máximo no dispara el aviso', () => {
    const { onFechaHastaChange, container } = renderFilters({ bibliaFecha: TODAY });
    const inputs = getDateInputs(container);
    fireEvent.change(inputs[1], { target: { value: TODAY } });
    expect(onFechaHastaChange).toHaveBeenCalledWith(TODAY);
    expect(screen.queryByText('Ajustada a la fecha máxima permitida')).not.toBeInTheDocument();
  });

  it('clampa la fecha desde al máximo permitido y avisa', async () => {
    const { onFechaDesdeChange, container } = renderFilters();
    const [desde] = getDateInputs(container);
    fireEvent.change(desde, { target: { value: '2099-01-01' } });
    expect(onFechaDesdeChange).toHaveBeenCalledWith(TODAY);
    expect(await screen.findByText('Ajustada a la fecha máxima permitida')).toBeInTheDocument();
  });

  it('si la biblia es pasada, el máximo es la fecha de la biblia', () => {
    const { onFechaHastaChange, container } = renderFilters({ bibliaFecha: '2026-01-05' });
    const inputs = getDateInputs(container);
    fireEvent.change(inputs[1], { target: { value: '2026-06-01' } });
    expect(onFechaHastaChange).toHaveBeenCalledWith('2026-01-05');
  });

  it('arrastra la fecha hasta cuando desde la supera', () => {
    const { onFechaDesdeChange, onFechaHastaChange, container } = renderFilters({
      fechaDesde: '2026-07-01',
      fechaHasta: '2026-07-02',
    });
    const [desde] = getDateInputs(container);
    fireEvent.change(desde, { target: { value: '2026-07-03' } });
    expect(onFechaDesdeChange).toHaveBeenCalledWith('2026-07-03');
    expect(onFechaHastaChange).toHaveBeenCalledWith('2026-07-03');
  });

  it('arrastra la fecha desde cuando hasta queda por debajo', () => {
    const { onFechaDesdeChange, onFechaHastaChange, container } = renderFilters();
    const inputs = getDateInputs(container);
    fireEvent.change(inputs[1], { target: { value: '2026-06-30' } });
    expect(onFechaHastaChange).toHaveBeenCalledWith('2026-06-30');
    expect(onFechaDesdeChange).toHaveBeenCalledWith('2026-06-30');
  });

  it('ignora un valor vacío', () => {
    const { onFechaDesdeChange, container } = renderFilters();
    const [desde] = getDateInputs(container);
    fireEvent.change(desde, { target: { value: '' } });
    expect(onFechaDesdeChange).not.toHaveBeenCalled();
  });

  it('el aviso de clamp desaparece a los 4 segundos', () => {
    vi.useFakeTimers();
    try {
      const { container } = renderFilters();
      const [desde] = getDateInputs(container);
      fireEvent.change(desde, { target: { value: '2099-01-01' } });
      expect(screen.getByText('Ajustada a la fecha máxima permitida')).toBeInTheDocument();
      act(() => {
        vi.advanceTimersByTime(4000);
      });
      expect(screen.queryByText('Ajustada a la fecha máxima permitida')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('Filters — fecha de biblia', () => {
  it('muestra el día de la semana de la biblia', () => {
    renderFilters({ bibliaFecha: '2026-07-10' }); // viernes
    expect(screen.getByText('viernes')).toBeInTheDocument();
  });

  it('propaga el cambio de fecha de biblia', () => {
    // bibliaFecha explícita (distinta del valor simulado) para no depender de la fecha
    // real del sistema: si TODAY coincidiera con el valor que se simula más abajo, el
    // input ya tendría ese valor y el onChange no llegaría a dispararse (regresión F18).
    const { onBibliaFechaChange, container } = renderFilters({ bibliaFecha: '2026-01-01' });
    const inputs = getDateInputs(container);
    fireEvent.change(inputs[2], { target: { value: '2026-07-15' } });
    expect(onBibliaFechaChange).toHaveBeenCalledWith('2026-07-15');
  });
});

describe('Filters — dropdown de zonas', () => {
  it('abre el dropdown y togglea una zona', () => {
    const { onToggleZona } = renderFilters();
    fireEvent.click(screen.getByRole('button', { name: /Zona/ }));
    fireEvent.click(screen.getByLabelText('LOMAS'));
    expect(onToggleZona).toHaveBeenCalledWith(1);
  });

  it('"Todo" selecciona todas las zonas cuando no estaban todas marcadas', () => {
    const { onSetZonas } = renderFilters({ zonasSeleccionadas: [] });
    fireEvent.click(screen.getByRole('button', { name: /Zona/ }));
    const todo = screen.getByLabelText('Todo') as HTMLInputElement;
    expect(todo.checked).toBe(false);
    fireEvent.click(todo);
    expect(onSetZonas).toHaveBeenCalledWith([1, 2]);
  });

  it('"Todo" deselecciona todas cuando ya estaban todas marcadas (checkbox aparece marcado)', () => {
    const { onSetZonas, container } = renderFilters({ zonasSeleccionadas: [1, 2] });
    fireEvent.click(container.querySelector('button') as HTMLButtonElement);
    const todo = screen.getByLabelText('Todo') as HTMLInputElement;
    expect(todo.checked).toBe(true);
    fireEvent.click(todo);
    expect(onSetZonas).toHaveBeenCalledWith([]);
  });

  it('la etiqueta refleja la selección', () => {
    const { rerender } = renderFilters({ zonasSeleccionadas: [1] });
    expect(screen.getByText('LOMAS')).toBeInTheDocument();

    rerender(<Filters
      estados={[]} estadosSeleccionados={[]} onToggleEstado={vi.fn()}
      zonas={[{ id: 1, nombre: 'LOMAS' }, { id: 2, nombre: 'SUR' }]}
      zonasSeleccionadas={[1, 2]} onToggleZona={vi.fn()} onSetZonas={vi.fn()}
      fechaDesde="2026-07-01" fechaHasta="2026-07-02" bibliaFecha={TODAY}
      onFechaDesdeChange={vi.fn()} onFechaHastaChange={vi.fn()} onBibliaFechaChange={vi.fn()}
    />);
    expect(screen.getByText('Todas las zonas')).toBeInTheDocument();
  });

  it('con una única zona seleccionada que NO es la primera del array, muestra su nombre correcto', () => {
    renderFilters({
      zonas: [{ id: 1, nombre: 'LOMAS' }, { id: 2, nombre: 'SUR' }],
      zonasSeleccionadas: [2],
    });
    expect(screen.getByText('SUR')).toBeInTheDocument();
    expect(screen.queryByText('LOMAS')).not.toBeInTheDocument();
  });

  it('con 2 de 3 zonas seleccionadas (ni una ni todas), muestra "2 zonas"', () => {
    renderFilters({
      zonas: [{ id: 1, nombre: 'LOMAS' }, { id: 2, nombre: 'SUR' }, { id: 3, nombre: 'CENTRO' }],
      zonasSeleccionadas: [1, 2],
    });
    expect(screen.getByText('2 zonas')).toBeInTheDocument();
  });

  it('no muestra el dropdown si no hay zonas', () => {
    renderFilters({ zonas: [] });
    expect(screen.queryByRole('button', { name: /Zona/ })).not.toBeInTheDocument();
  });

  it('el botón usa la clase "activa" (azul) solo cuando hay zonas seleccionadas', () => {
    const { container, rerender } = renderFilters({ estados: [], zonasSeleccionadas: [] });
    const boton = () => container.querySelector('button') as HTMLButtonElement;
    expect(boton().className).toContain('bg-white');
    expect(boton().className).not.toContain('bg-blue-600');

    rerender(<Filters
      estados={[]} estadosSeleccionados={[]} onToggleEstado={vi.fn()}
      zonas={[{ id: 1, nombre: 'LOMAS' }, { id: 2, nombre: 'SUR' }]}
      zonasSeleccionadas={[1]} onToggleZona={vi.fn()} onSetZonas={vi.fn()}
      fechaDesde="2026-07-01" fechaHasta="2026-07-02" bibliaFecha={TODAY}
      onFechaDesdeChange={vi.fn()} onFechaHastaChange={vi.fn()} onBibliaFechaChange={vi.fn()}
    />);
    expect(boton().className).toContain('bg-blue-600');
    expect(boton().className).not.toContain('bg-white');
  });

  it('se cierra al hacer click afuera', () => {
    renderFilters();
    fireEvent.click(screen.getByRole('button', { name: /Zona/ }));
    expect(screen.getByLabelText('LOMAS')).toBeInTheDocument();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByLabelText('LOMAS')).not.toBeInTheDocument();
  });
});

describe('Filters — dropdown de estados', () => {
  it('abre el dropdown y togglea un estado', () => {
    const { onToggleEstado } = renderFilters();
    fireEvent.click(screen.getByRole('button', { name: /Estado/ }));
    fireEvent.click(screen.getByLabelText('Completada'));
    expect(onToggleEstado).toHaveBeenCalledWith('Completada');
  });

  it('la etiqueta muestra el estado único seleccionado', () => {
    renderFilters({ estadosSeleccionados: ['Remitido'] });
    expect(screen.getByRole('button', { name: /Remitido/ })).toBeInTheDocument();
  });

  it('la etiqueta muestra "Todos" con todos seleccionados', () => {
    renderFilters({ estadosSeleccionados: ['Completada', 'Remitido'] });
    expect(screen.getByRole('button', { name: /Todos/ })).toBeInTheDocument();
  });

  it('no muestra el dropdown sin estados', () => {
    renderFilters({ estados: [] });
    expect(screen.queryByRole('button', { name: /Estado/ })).not.toBeInTheDocument();
  });

  it('con 2 de 3 estados seleccionados (ni uno ni todos), muestra "2 estados"', () => {
    renderFilters({
      estados: ['Completada', 'Remitido', 'Eliminado'],
      estadosSeleccionados: ['Completada', 'Remitido'],
    });
    expect(screen.getByText('2 estados')).toBeInTheDocument();
  });

  it('el botón de estados usa la clase "activa" solo cuando hay alguno seleccionado', () => {
    const { container, rerender } = renderFilters({ zonas: [], estadosSeleccionados: [] });
    const boton = () => container.querySelector('button') as HTMLButtonElement;
    expect(boton().className).toContain('bg-white');

    rerender(<Filters
      estados={['Completada', 'Remitido']} estadosSeleccionados={['Remitido']} onToggleEstado={vi.fn()}
      zonas={[]} zonasSeleccionadas={[]} onToggleZona={vi.fn()} onSetZonas={vi.fn()}
      fechaDesde="2026-07-01" fechaHasta="2026-07-02" bibliaFecha={TODAY}
      onFechaDesdeChange={vi.fn()} onFechaHastaChange={vi.fn()} onBibliaFechaChange={vi.fn()}
    />);
    expect(boton().className).toContain('bg-blue-600');
  });

  it('cada estado conocido usa el color de punto correcto', () => {
    const { container } = renderFilters({
      estados: ['pendiente', 'en preparacion', 'completada', 'completo', 'remitido', 'eliminado', 'desconocido'],
    });
    fireEvent.click(screen.getByRole('button', { name: /Estado/ }));
    const dots = Array.from(container.querySelectorAll('label span[class*="rounded-full"]'));
    expect(dots.map(d => d.className)).toEqual([
      expect.stringContaining('bg-slate-500'),
      expect.stringContaining('bg-amber-500'),
      expect.stringContaining('bg-emerald-600'),
      expect.stringContaining('bg-emerald-600'),
      expect.stringContaining('bg-sky-600'),
      expect.stringContaining('bg-red-500'),
      expect.stringContaining('bg-slate-400'), // desconocido -> fallback
    ]);
  });

  it('el color del punto se busca en minúsculas (un estado en mayúsculas igual matchea)', () => {
    const { container } = renderFilters({ estados: ['REMITIDO'] });
    fireEvent.click(screen.getByRole('button', { name: /Estado/ }));
    const dot = container.querySelector('label span[class*="rounded-full"]');
    expect(dot?.className).toContain('bg-sky-600');
  });

  it('se cierra al hacer click afuera', () => {
    renderFilters();
    fireEvent.click(screen.getByRole('button', { name: /Estado/ }));
    expect(screen.getByLabelText('Completada')).toBeInTheDocument();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByLabelText('Completada')).not.toBeInTheDocument();
  });
});
