import { describe, it, expect, vi, beforeEach } from 'vitest';
import { request } from './zonificacionRequest';
import { fetchPdv, fetchGrupos, crearGrupo, actualizarGrupo, eliminarGrupo } from './zonificacionApi';

vi.mock('./zonificacionRequest', () => ({
  request: vi.fn(),
}));

const requestMock = vi.mocked(request);

beforeEach(() => {
  requestMock.mockReset();
  requestMock.mockResolvedValue(undefined);
});

describe('zonificacionApi', () => {
  it('fetchPdv consulta /api/distrigestion/zonificacion/pdv', async () => {
    await fetchPdv();
    expect(requestMock).toHaveBeenCalledWith('/api/distrigestion/zonificacion/pdv');
  });

  it('fetchGrupos consulta /api/distrigestion/zonificacion/grupos', async () => {
    await fetchGrupos();
    expect(requestMock).toHaveBeenCalledWith('/api/distrigestion/zonificacion/grupos');
  });

  it('crearGrupo hace POST con el body serializado', async () => {
    const nuevo = { nombre: 'Zona Sur', tipo: 'ruta_flete' as const, editablePorOtros: false };
    await crearGrupo(nuevo);
    expect(requestMock).toHaveBeenCalledWith('/api/distrigestion/zonificacion/grupos', {
      method: 'POST',
      body: JSON.stringify(nuevo),
    });
  });

  it('actualizarGrupo hace PUT contra el id con el body serializado', async () => {
    const cambios = { nombre: 'Renombrado' };
    await actualizarGrupo(5, cambios);
    expect(requestMock).toHaveBeenCalledWith('/api/distrigestion/zonificacion/grupos/5', {
      method: 'PUT',
      body: JSON.stringify(cambios),
    });
  });

  it('eliminarGrupo hace DELETE contra el id', async () => {
    await eliminarGrupo(5);
    expect(requestMock).toHaveBeenCalledWith('/api/distrigestion/zonificacion/grupos/5', { method: 'DELETE' });
  });
});
