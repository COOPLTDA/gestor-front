import '@testing-library/jest-dom';
import { configure } from '@testing-library/dom';

// El timeout default de waitFor/findBy (1000ms) puede no alcanzar bajo carga
// (ej: corridas con muchos test files en paralelo, o Stryker con varios workers).
// Sube el margen sin cambiar el comportamiento real de los componentes.
configure({ asyncUtilTimeout: 5000 });

// Mock fetch global para tests
global.fetch = vi.fn();

// Mock window.location
Object.defineProperty(window, 'location', {
  value: { href: '', reload: vi.fn() },
  writable: true,
});

// Limpiar mocks entre tests
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});
