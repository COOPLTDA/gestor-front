import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// ─────────────────────────────────────────
// Schemas del Login (replicamos para probar la lógica)
// ─────────────────────────────────────────
const loginSchema = z.object({
  username: z.string().min(3, 'El usuario debe tener al menos 3 caracteres').max(50),
  password: z.string().min(3, 'La contraseña es requerida').max(72),
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Ingresá un email válido'),
});

describe('Login validation schema', () => {
  it('acepta credenciales válidas', () => {
    const result = loginSchema.safeParse({ username: 'marcos', password: 'pass123' });
    expect(result.success).toBe(true);
  });

  it('rechaza username menor a 3 caracteres', () => {
    const result = loginSchema.safeParse({ username: 'ab', password: 'pass123' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('3 caracteres');
    }
  });

  it('rechaza password vacío', () => {
    const result = loginSchema.safeParse({ username: 'marcos', password: '' });
    expect(result.success).toBe(false);
  });

  it('rechaza password mayor a 72 caracteres', () => {
    const result = loginSchema.safeParse({ username: 'marcos', password: 'a'.repeat(73) });
    expect(result.success).toBe(false);
  });
});

describe('Forgot password schema', () => {
  it('acepta email válido', () => {
    const result = forgotPasswordSchema.safeParse({ email: 'test@example.com' });
    expect(result.success).toBe(true);
  });

  it('rechaza email inválido', () => {
    const result = forgotPasswordSchema.safeParse({ email: 'no-es-email' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('válido');
    }
  });

  it('rechaza email vacío', () => {
    const result = forgotPasswordSchema.safeParse({ email: '' });
    expect(result.success).toBe(false);
  });
});
