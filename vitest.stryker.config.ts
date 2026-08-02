import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

// Config de Vitest solo para Stryker: acota el dry run a los tests de Biblia y
// Zonificación (todo lo que puede cubrir una mutación en src/pages/biblia/**
// y src/pages/zonificacion/**), evitando la flakiness conocida de la suite
// completa de DistriGestión bajo carga (ver MANTENIMIENTO.md / enro-knowledge,
// ReportePage.test.tsx).
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./src/tests/setup.ts'],
    include: [
      'src/pages/biblia/**/*.{test,spec}.{ts,tsx}',
      'src/pages/zonificacion/**/*.{test,spec}.{ts,tsx}',
      'src/services/zonificacionApi.test.ts',
    ],
    // Con 7 workers de Stryker compitiendo por CPU, el default de 5s se queda corto.
    testTimeout: 15000,
  },
});
