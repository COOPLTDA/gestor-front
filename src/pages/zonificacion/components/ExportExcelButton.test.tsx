import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExportExcelButton } from './ExportExcelButton';
import { exportExcel } from '../lib/exportExcel';
import { FILTROS_VACIOS } from '../types';
import type { Zona } from '../types';

vi.mock('../lib/exportExcel', () => ({
  exportExcel: vi.fn(),
}));

const mockExportExcel = vi.mocked(exportExcel);

function baseProps(overrides: Partial<Parameters<typeof ExportExcelButton>[0]> = {}) {
  return {
    zonas: [] as Zona[],
    currentData: [],
    allData: [],
    filtros: FILTROS_VACIOS,
    excluidos: [],
    rangoVentas: { desde: '2025-07-28', hasta: '2026-07-28' },
    onError: vi.fn(),
    onSuccess: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ExportExcelButton', () => {
  it('está deshabilitado si no hay zonas', () => {
    render(<ExportExcelButton {...baseProps({ zonas: [] })} />);
    expect(screen.getByRole('button', { name: 'Exportar Excel' })).toBeDisabled();
  });

  it('está habilitado si hay al menos una zona', () => {
    render(<ExportExcelButton {...baseProps({ zonas: [{ nombre: 'Z', color: '#000', vertices: [], criterios: null }] })} />);
    expect(screen.getByRole('button', { name: 'Exportar Excel' })).not.toBeDisabled();
  });

  it('al hacer click, exporta y llama a onSuccess con el nombre del archivo', () => {
    mockExportExcel.mockReturnValue('archivo.xlsx');
    const onSuccess = vi.fn();
    const onError = vi.fn();
    render(<ExportExcelButton {...baseProps({ zonas: [{ nombre: 'Z', color: '#000', vertices: [], criterios: null }], onSuccess, onError })} />);

    fireEvent.click(screen.getByRole('button', { name: 'Exportar Excel' }));

    expect(onSuccess).toHaveBeenCalledWith('archivo.xlsx');
    expect(onError).not.toHaveBeenCalled();
  });

  it('si exportExcel tira un error, llama a onError con el mensaje', () => {
    mockExportExcel.mockImplementation(() => { throw new Error('No hay zonas dibujadas.'); });
    const onSuccess = vi.fn();
    const onError = vi.fn();
    render(<ExportExcelButton {...baseProps({ zonas: [{ nombre: 'Z', color: '#000', vertices: [], criterios: null }], onSuccess, onError })} />);

    fireEvent.click(screen.getByRole('button', { name: 'Exportar Excel' }));

    expect(onError).toHaveBeenCalledWith('No hay zonas dibujadas.');
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
