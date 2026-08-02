import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { API, STORAGE_KEYS } from '@/constants/api';

// ─────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────
interface User {
  id: number;
  username: string;
  email: string;
  nombre: string;
  role: string;
}

interface Page {
  clave: string;
  nombre: string;
  ruta: string;
}

interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  pages: Page[];
  loading: boolean;
}

type AuthAction =
  | { type: 'LOGIN_START' }
  | { type: 'LOGIN_SUCCESS'; payload: { user: User; pages: Page[] } }
  | { type: 'LOGIN_FAILURE' }
  | { type: 'LOGOUT' }
  | { type: 'SET_LOADING'; payload: boolean };

const initialState: AuthState = {
  isAuthenticated: false,
  user: null,
  pages: [],
  loading: true
};

// ─────────────────────────────────────────
// REDUCER
// ─────────────────────────────────────────
const authReducer = (state: AuthState, action: AuthAction): AuthState => {
  switch (action.type) {
    case 'LOGIN_START':
      return { ...state, loading: true };

    case 'LOGIN_SUCCESS':
      return {
        ...state,
        isAuthenticated: true,
        user: action.payload.user,
        pages: action.payload.pages,
        loading: false
      };

    case 'LOGIN_FAILURE':
      return { ...initialState, loading: false };

    case 'LOGOUT':
      return { ...initialState, loading: false };

    case 'SET_LOADING':
      return { ...state, loading: action.payload };

    default:
      return state;
  }
};

// ─────────────────────────────────────────
// CONTEXT
// ─────────────────────────────────────────
interface AuthContextType extends AuthState {
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hasPage: (pageKey: string) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

// ─────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────
function clearUserStorage() {
  // Solo limpiamos datos de usuario — los tokens están en cookies httpOnly
  // y el servidor las borra en logout con Set-Cookie: expires=past
  Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
}

// ─────────────────────────────────────────
// PROVIDER
// ─────────────────────────────────────────
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // ──────────────────────────────────────
  // Restaurar sesión desde localStorage
  // Los tokens NO están en localStorage; solo guardamos user_data y user_pages.
  // Si la cookie de acceso expiró, el primer request autenticado recibirá 401
  // y fetchWithAuth disparará el refresh automáticamente.
  // ──────────────────────────────────────
  useEffect(() => {
    const userData = localStorage.getItem(STORAGE_KEYS.USER_DATA);
    const pagesData = localStorage.getItem(STORAGE_KEYS.USER_PAGES);

    if (userData && pagesData) {
      try {
        const user = JSON.parse(userData) as User;
        const pages = JSON.parse(pagesData) as Page[];
        dispatch({ type: 'LOGIN_SUCCESS', payload: { user, pages } });
      } catch {
        clearUserStorage();
      }
    }

    dispatch({ type: 'SET_LOADING', payload: false });
  }, []);

  // ──────────────────────────────────────
  // LOGIN
  // ──────────────────────────────────────
  const login = async (username: string, password: string) => {
    dispatch({ type: 'LOGIN_START' });

    try {
      const response = await fetch(API.AUTH.LOGIN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',  // El servidor seteará las cookies httpOnly en la respuesta
        body: JSON.stringify({ username, password })
      });

      if (!response.ok) {
        const text = await response.text();
        let err: { message?: string };
        try { err = JSON.parse(text); }
        catch { err = { message: 'Error de autenticación' }; }
        throw new Error(err.message || 'Error de autenticación');
      }

      const data = await response.json() as {
        success: boolean;
        message?: string;
        data: { user: User; pages: Page[] };
      };

      if (!data.success) {
        throw new Error(data.message || 'Error de autenticación');
      }

      // Persistir solo datos de usuario (no tokens — están en cookies httpOnly)
      localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(data.data.user));
      localStorage.setItem(STORAGE_KEYS.USER_PAGES, JSON.stringify(data.data.pages));

      dispatch({
        type: 'LOGIN_SUCCESS',
        payload: { user: data.data.user, pages: data.data.pages }
      });
    } catch (error) {
      dispatch({ type: 'LOGIN_FAILURE' });
      throw error;
    }
  };

  // ──────────────────────────────────────
  // LOGOUT
  // ──────────────────────────────────────
  const logout = async () => {
    try {
      await fetch(API.AUTH.LOGOUT, {
        method: 'POST',
        credentials: 'include',  // El servidor borrará las cookies en la respuesta
      });
    } catch {
      // Aunque falle la API, cerramos sesión localmente
    } finally {
      clearUserStorage();
      dispatch({ type: 'LOGOUT' });
    }
  };

  const hasPage = (pageKey: string): boolean =>
    state.pages.some(p => p.clave === pageKey);

  return (
    <AuthContext.Provider value={{ ...state, login, logout, hasPage }}>
      {children}
    </AuthContext.Provider>
  );
};
