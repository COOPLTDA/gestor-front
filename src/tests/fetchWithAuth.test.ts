import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchWithAuth, createAbortController } from '@/utils/fetchWithAuth';

// Mock de constantes
vi.mock('@/constants/api', () => ({
  API: {
    AUTH: { REFRESH: '/api/auth/refresh', LOGIN: '/api/auth/login', LOGOUT: '/api/auth/logout' }
  },
  STORAGE_KEYS: { USER_DATA: 'user_data', USER_PAGES: 'user_pages' },
}));

describe('fetchWithAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('envía credentials: include en cada request', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: [] }), { status: 200 })
    );
    global.fetch = mockFetch;

    await fetchWithAuth('/api/test');

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/test',
      expect.objectContaining({ credentials: 'include' })
    );
  });

  it('reintenta con refresh cuando recibe 401', async () => {
    const mockFetch = vi
      .fn()
      // Primera llamada → 401
      .mockResolvedValueOnce(new Response('{}', { status: 401 }))
      // Llamada al refresh → OK
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { access_token: 'new-token' } }), { status: 200 })
      )
      // Segundo intento del request original → OK
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true }), { status: 200 })
      );

    global.fetch = mockFetch;

    const result = await fetchWithAuth('/api/protegido');

    // Debería haber 3 llamadas: request original + refresh + request reintentado
    expect(mockFetch).toHaveBeenCalledTimes(3);
    expect(result.ok).toBe(true);
  });

  it('fuerza logout cuando refresh también falla', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(new Response('{}', { status: 401 }))
      .mockResolvedValueOnce(new Response('{}', { status: 401 })); // refresh falla

    global.fetch = mockFetch;

    await expect(fetchWithAuth('/api/protegido')).rejects.toThrow('Sesión expirada');
  });

  it('agrega Content-Type application/json cuando hay body no-FormData', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true }), { status: 200 })
    );
    global.fetch = mockFetch;

    await fetchWithAuth('/api/test', {
      method: 'POST',
      body: JSON.stringify({ data: 'test' }),
    });

    const calledHeaders = mockFetch.mock.calls[0][1].headers as Headers;
    expect(calledHeaders.get('Content-Type')).toBe('application/json');
  });

  it('no sobreescribe Content-Type si ya está definido', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true }), { status: 200 })
    );
    global.fetch = mockFetch;

    await fetchWithAuth('/api/test', {
      method: 'POST',
      headers: { 'Content-Type': 'multipart/form-data' },
      body: JSON.stringify({}),
    });

    const calledHeaders = mockFetch.mock.calls[0][1].headers as Headers;
    expect(calledHeaders.get('Content-Type')).toBe('multipart/form-data');
  });
});

describe('createAbortController', () => {
  it('crea un controller con signal', () => {
    const { signal, cleanup } = createAbortController(5000);
    expect(signal).toBeInstanceOf(AbortSignal);
    expect(signal.aborted).toBe(false);
    cleanup();
  });

  it('abort cancela la señal', () => {
    const { signal, abort } = createAbortController(10000);
    abort();
    expect(signal.aborted).toBe(true);
  });
});
