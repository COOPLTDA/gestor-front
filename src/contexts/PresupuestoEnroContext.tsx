import { createContext, useContext, useReducer, ReactNode } from "react";

type Nivel =
  | "empresa"
  | "zona"
  | "supervisor"
  | "vendedor"
  | "cliente";

type Cambio = {
  keys: Record<string, any>;
  crecimiento?: number;
  def_crec_dir?: number;
  def_crec_ger?: number;
};

type State = {
  mesObjetivo: string;           // 🔹 obligatorio
  proveedor?: string;            // 🔹 opcional
  division?: string;             // 🔹 opcional
  zona?: string;                 // 🔹 futuro
  supervisor?: string;           // 🔹 futuro
  vendedor?: string;             // 🔹 futuro
  cambios: Record<Nivel, Cambio[]>;
  modoGuardado: "auto" | "manual";
  pageSize: number;
  fullscreen: boolean;
};

type Action =
  | {
      type: "SET_FILTROS";
      payload: Partial<{
        mesObjetivo: string;
        proveedor: string;
        division: string;
        zona: string;
        supervisor: string;
        vendedor: string;
      }>;
    }
  | { type: "ADD_CAMBIO"; payload: { nivel: Nivel; cambio: Cambio } }
  | { type: "CLEAR_NIVEL"; payload: { nivel: Nivel } }
  | { type: "CLEAR_ALL" }
  | { type: "SET_MODO_GUARDADO"; payload: "auto" | "manual" }
  | { type: "SET_PAGE_SIZE"; payload: number }
  | { type: "SET_FULLSCREEN"; payload: boolean };

const initialState: State = {
  mesObjetivo: "",
  proveedor: undefined,
  division: undefined,
  zona: undefined,
  supervisor: undefined,
  vendedor: undefined,
  cambios: {
    empresa: [],
    zona: [],
    supervisor: [],
    vendedor: [],
    cliente: []
  },
  modoGuardado: "auto",
  pageSize: 15,
  fullscreen: false
};

function reducer(state: State, action: Action): State {
  switch (action.type) {

    // 🔥 MERGE INTELIGENTE (clave)
    case "SET_FILTROS":
      return {
        ...state,
        ...action.payload
      };

    case "ADD_CAMBIO":
      return {
        ...state,
        cambios: {
          ...state.cambios,
          [action.payload.nivel]: [
            ...state.cambios[action.payload.nivel],
            action.payload.cambio
          ]
        }
      };

    case "CLEAR_NIVEL":
      return {
        ...state,
        cambios: {
          ...state.cambios,
          [action.payload.nivel]: []
        }
      };

    case "CLEAR_ALL":
      return initialState;

    case "SET_MODO_GUARDADO":
      return { ...state, modoGuardado: action.payload };

    case "SET_PAGE_SIZE":
      return { ...state, pageSize: action.payload };

    case "SET_FULLSCREEN":
      return { ...state, fullscreen: action.payload };

    default:
      return state;
  }
}

const PresupuestoContext = createContext<{
  state: State;
  dispatch: React.Dispatch<Action>;
} | null>(null);

export function PresupuestoProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  return (
    <PresupuestoContext.Provider value={{ state, dispatch }}>
      {children}
    </PresupuestoContext.Provider>
  );
}

export function usePresupuesto() {
  const context = useContext(PresupuestoContext);
  if (!context) {
    throw new Error("usePresupuesto debe usarse dentro de PresupuestoProvider");
  }
  return context;
}
